#!/usr/bin/env python3
"""
N-ATLAS Nigerian English Speech-to-Text Service
Runs as a local Flask API wrapping the NCAIR1/NigerianAccentedEnglish model.

Usage:
    python n_atlas_service.py [--port 5000] [--model-dir ./model_cache]
"""

import os
import sys
import argparse
import logging
import torch

# Force offline mode for transformers and huggingface_hub
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_OFFLINE'] = '1'

from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
from transformers import pipeline, AutoModelForSpeechSeq2Seq, AutoProcessor
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

# Suppress Flask banner
import flask.cli
flask.cli.show_server_banner = lambda *args: None

# Default Configuration
MODEL_NAME = "NCAIR1/NigerianAccentedEnglish"
SAMPLE_RATE = 16000
MAX_AUDIO_DURATION = 30 

# Global ASR pipeline (loaded once on startup)
asr_pipeline = None
device = None

def load_model(cache_dir):
    """Load N-ATLAS model on startup."""
    global asr_pipeline, device
    
    if asr_pipeline is not None:
        return asr_pipeline
    
    try:
        # Determine device
        device = 0 if torch.cuda.is_available() else -1
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        device_name = "GPU" if device == 0 else "CPU"
        
        # Resolve the model path
        # If we have a local cache with a hub structure, we find the snapshot
        absolute_cache = Path(cache_dir).resolve()
        model_path = MODEL_NAME
        
        # Hugging Face local hub structure: hub/models--USER--REPO/snapshots/COMMIT
        hub_path = absolute_cache / "hub" / f"models--{MODEL_NAME.replace('/', '--')}" / "snapshots"
        if hub_path.exists():
            snapshots = list(hub_path.iterdir())
            if snapshots:
                model_path = str(snapshots[0].resolve())
                logger.info(f"Resolved local snapshot: {model_path}")

        logger.info(f"Loading N-ATLAS model from {model_path} on {device_name}...")
        
        # Load model and processor directly
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_path, 
            torch_dtype=torch_dtype, 
            low_cpu_mem_usage=True, 
            use_safetensors=False,
            local_files_only=True
        )
        model.to(device if device >= 0 else "cpu")

        processor = AutoProcessor.from_pretrained(
            model_path, 
            local_files_only=True
        )

        # Create pipeline
        asr_pipeline = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            device=device,
        )
        
        logger.info(f"✅ N-ATLAS model loaded successfully on {device_name}")
        return asr_pipeline
    except Exception as e:
        logger.error(f"❌ Failed to load N-ATLAS model: {e}")
        # Log stack trace for deep debugging
        import traceback
        logger.error(traceback.format_exc())
        raise

def process_audio(audio_data, audio_format="wav"):
    try:
        if isinstance(audio_data, bytes):
            import io
            audio_file = io.BytesIO(audio_data)
            waveform, sr = librosa.load(audio_file, sr=None, mono=True)
        else:
            waveform, sr = librosa.load(audio_data, sr=None, mono=True)
        
        if sr != SAMPLE_RATE:
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=SAMPLE_RATE)
        
        max_samples = MAX_AUDIO_DURATION * SAMPLE_RATE
        if len(waveform) > max_samples:
            waveform = waveform[:max_samples]
        
        return waveform
    except Exception as e:
        logger.error(f"❌ Audio processing failed: {e}")
        raise ValueError(f"Failed to process audio: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "model": MODEL_NAME,
        "device": "GPU" if device == 0 else "CPU"
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        audio_format = Path(audio_file.filename).suffix.lstrip('.').lower() or 'wav'
        
        waveform = process_audio(audio_file.read(), audio_format)
        duration = len(waveform) / SAMPLE_RATE
        
        result = asr_pipeline(waveform)
        transcribed_text = result.get("text", "").strip()
        
        return jsonify({
            "text": transcribed_text,
            "confidence": 0.95,
            "duration": duration,
            "model": "NCAIR1/NigerianAccentedEnglish",
            "language": "en-NG"
        })
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/transcribe-raw', methods=['POST'])
def transcribe_raw():
    try:
        audio_bytes = request.get_data()
        if not audio_bytes:
            return jsonify({"error": "No audio data provided"}), 400
        
        audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        result = asr_pipeline(audio_data)
        transcribed_text = result.get("text", "").strip()
        
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
    return jsonify({
        "model": MODEL_NAME,
        "language": "English (Nigerian Accented)",
        "sample_rate": SAMPLE_RATE,
        "max_duration": MAX_AUDIO_DURATION
    })

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='N-ATLAS Speech-to-Text Service')
    parser.add_argument('--port', type=int, default=5000, help='Port to listen on')
    parser.add_argument('--model-dir', type=str, default='./model_cache', help='Path to model cache directory')
    args = parser.parse_args()

    try:
        # Load model on startup
        load_model(args.model_dir)
        
        logger.info(f"🚀 Starting N-ATLAS Service on port {args.port}")
        # Run in threaded mode to handle multiple concurrent small requests
        app.run(host='0.0.0.0', port=args.port, debug=False, threaded=True)
    except Exception as e:
        logger.error(f"❌ Failed to start service: {e}")
        sys.exit(1)
