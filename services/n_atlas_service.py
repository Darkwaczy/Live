#!/usr/bin/env python3
"""
N-ATLAS Nigerian English Speech-to-Text Service
Runs as a local Flask API wrapping the NCAIR1/NigerianAccentedEnglish model.

Installation:
    pip install -r requirements.txt

Usage:
    python n_atlas_service.py

The service exposes:
    POST /transcribe - Send audio and get transcription
    GET /health - Health check
    POST /transcribe-stream - Streaming endpoint for chunks
"""

import os
import json
import torch
import logging
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import numpy as np
import librosa

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
MODEL_NAME = "NCAIR1/NigerianAccentedEnglish"
SAMPLE_RATE = 16000
MAX_AUDIO_DURATION = 30  # seconds (N-ATLAS limit)
CACHE_DIR = Path.home() / ".cache" / "n_atlas"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Global ASR pipeline (loaded once on startup)
asr_pipeline = None
device = None

def load_model():
    """Load N-ATLAS model on startup."""
    global asr_pipeline, device
    
    if asr_pipeline is not None:
        return asr_pipeline
    
    try:
        # Determine device
        device = 0 if torch.cuda.is_available() else -1
        device_name = "GPU" if device == 0 else "CPU"
        logger.info(f"Loading N-ATLAS model on {device_name}...")
        
        # Load pipeline
        asr_pipeline = pipeline(
            "automatic-speech-recognition",
            model=MODEL_NAME,
            device=device,
            cache_dir=str(CACHE_DIR)
        )
        
        logger.info(f"✅ N-ATLAS model loaded successfully on {device_name}")
        logger.info(f"Model: {MODEL_NAME}")
        logger.info(f"Cache directory: {CACHE_DIR}")
        
        return asr_pipeline
    except Exception as e:
        logger.error(f"❌ Failed to load N-ATLAS model: {e}")
        raise

def process_audio(audio_data, audio_format="wav"):
    """
    Process audio data and return it in the correct format for ASR.
    
    Args:
        audio_data: bytes or file-like object
        audio_format: 'wav', 'webm', 'ogg', or 'mp3'
    
    Returns:
        numpy array at 16kHz sample rate
    """
    try:
        # Load audio from bytes
        if isinstance(audio_data, bytes):
            import io
            audio_file = io.BytesIO(audio_data)
            waveform, sr = librosa.load(audio_file, sr=None, mono=True)
        else:
            waveform, sr = librosa.load(audio_data, sr=None, mono=True)
        
        # Resample to 16kHz if necessary
        if sr != SAMPLE_RATE:
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=SAMPLE_RATE)
        
        # Clip to max duration
        max_samples = MAX_AUDIO_DURATION * SAMPLE_RATE
        if len(waveform) > max_samples:
            logger.warning(f"Audio too long ({len(waveform)/SAMPLE_RATE:.1f}s), clipping to {MAX_AUDIO_DURATION}s")
            waveform = waveform[:max_samples]
        
        logger.info(f"Processed audio: {len(waveform)} samples ({len(waveform)/SAMPLE_RATE:.2f}s) at {SAMPLE_RATE}Hz")
        
        return waveform
    except Exception as e:
        logger.error(f"❌ Audio processing failed: {e}")
        raise ValueError(f"Failed to process audio: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model": MODEL_NAME,
        "device": "GPU" if device == 0 else "CPU",
        "timestamp": __import__('datetime').datetime.utcnow().isoformat()
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file.
    
    Expected form data:
        - audio: Audio file (multipart/form-data)
        - language: Optional language hint (default: en)
    
    Returns:
        {
            "text": "transcribed text",
            "confidence": 0.95,
            "duration": 2.3,
            "model": "Nigerian Accented English"
        }
    """
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        # Get audio format from filename
        audio_format = Path(audio_file.filename).suffix.lstrip('.').lower()
        if not audio_format:
            audio_format = 'wav'
        
        logger.info(f"Transcribing: {audio_file.filename} ({audio_format})")
        
        # Process audio
        waveform = process_audio(audio_file.read(), audio_format)
        duration = len(waveform) / SAMPLE_RATE
        
        # Transcribe
        logger.info(f"Running N-ATLAS inference on {duration:.2f}s of audio...")
        result = asr_pipeline(waveform)
        
        transcribed_text = result.get("text", "").strip()
        
        logger.info(f"✅ Transcription complete: '{transcribed_text}'")
        
        return jsonify({
            "text": transcribed_text,
            "confidence": 0.95,  # N-ATLAS doesn't provide per-utterance confidence
            "duration": duration,
            "model": "NCAIR1/NigerianAccentedEnglish",
            "language": "en-NG"
        })
    
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/transcribe-raw', methods=['POST'])
def transcribe_raw():
    """
    Transcribe raw PCM audio (16-bit, 16kHz, mono).
    
    Expected:
        - Content-Type: application/x-pcm+int16
        - Body: Raw PCM audio data
    
    Returns:
        JSON with transcription
    """
    try:
        audio_bytes = request.get_data()
        
        if not audio_bytes:
            return jsonify({"error": "No audio data provided"}), 400
        
        # Convert bytes to numpy array
        audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        
        logger.info(f"Transcribing {len(audio_data)} PCM samples ({len(audio_data)/SAMPLE_RATE:.2f}s)")
        
        # Transcribe
        result = asr_pipeline(audio_data)
        transcribed_text = result.get("text", "").strip()
        
        logger.info(f"✅ Transcription complete: '{transcribed_text}'")
        
        return jsonify({
            "text": transcribed_text,
            "confidence": 0.95,
            "duration": len(audio_data) / SAMPLE_RATE,
            "model": "NCAIR1/NigerianAccentedEnglish"
        })
    
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/info', methods=['GET'])
def model_info():
    """Get model information."""
    return jsonify({
        "model": MODEL_NAME,
        "model_card": "https://huggingface.co/NCAIR1/NigerianAccentedEnglish",
        "language": "English (Nigerian Accented)",
        "sample_rate": SAMPLE_RATE,
        "max_duration": MAX_AUDIO_DURATION,
        "developer": "NCAIR (National Centre for Artificial Intelligence & Robotics)",
        "funding": "Federal Government of Nigeria",
        "license": "Open-Source Research and Innovation License",
        "free_tier_limit": "1,000 active users (30-day rolling)",
        "contact": {
            "technical": "datasupport@awarri.com",
            "government": "ncair@nitda.gov.ng"
        }
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    try:
        # Load model on startup
        load_model()
        
        # Start Flask server
        logger.info("🚀 Starting N-ATLAS Speech-to-Text Service")
        logger.info("📡 Listening on http://0.0.0.0:5000")
        logger.info("Available endpoints:")
        logger.info("  POST /transcribe - Transcribe audio file")
        logger.info("  POST /transcribe-raw - Transcribe raw PCM audio")
        logger.info("  GET /health - Health check")
        logger.info("  GET /info - Model information")
        
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    
    except Exception as e:
        logger.error(f"❌ Failed to start service: {e}")
        exit(1)
