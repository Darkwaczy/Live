#!/usr/bin/env python3
"""
N-ATLAS Nigerian English Speech-to-Text Service
Runs as a local Flask API wrapping the NCAIR1/NigerianAccentedEnglish model.
Supports dynamic downloading from Hugging Face on first run.
"""

import os
import sys
import argparse
import logging
import torch
import threading
import time
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline, AutoModelForSpeechSeq2Seq, AutoProcessor
from huggingface_hub import snapshot_download
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

# Default Configuration
MODEL_NAME = "NCAIR1/NigerianAccentedEnglish"
SAMPLE_RATE = 16000
MAX_AUDIO_DURATION = 30 

# Global state
asr_pipeline = None
device = None
download_progress = 0
is_downloading = False
download_error = None

def check_and_download_model(cache_dir):
    """Checks if model exists, if not starts download in background."""
    global download_progress, is_downloading, download_error, asr_pipeline
    
    absolute_cache = Path(cache_dir).resolve()
    hub_path = absolute_cache / "hub" / f"models--{MODEL_NAME.replace('/', '--')}" / "snapshots"
    
    if hub_path.exists() and any(hub_path.iterdir()):
        logger.info("✅ Model already exists locally.")
        download_progress = 100
        return True
    
    # Needs download
    def download_task():
        global download_progress, is_downloading, download_error
        try:
            logger.info(f"📥 Starting download of {MODEL_NAME} from Hugging Face...")
            is_downloading = True
            download_progress = 10 # Initial start
            
            # Note: snapshot_download doesn't have a progress callback, 
            # so we'll simulate steps or just rely on completion.
            snapshot_download(
                repo_id=MODEL_NAME,
                cache_dir=cache_dir,
                resume_download=True
            )
            
            download_progress = 100
            is_downloading = False
            logger.info("✅ Download complete. Triggering model load...")
            load_model(cache_dir)
        except Exception as e:
            logger.error(f"❌ Download failed: {e}")
            download_error = str(e)
            is_downloading = False

    thread = threading.Thread(target=download_task)
    thread.start()
    return False

def load_model(cache_dir):
    """Load N-ATLAS model into memory."""
    global asr_pipeline, device
    
    if asr_pipeline is not None:
        return asr_pipeline
    
    try:
        device = 0 if torch.cuda.is_available() else -1
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        device_name = "GPU" if device == 0 else "CPU"
        
        absolute_cache = Path(cache_dir).resolve()
        model_path = MODEL_NAME
        
        # Resolve the model path from HF cache structure
        hub_path = absolute_cache / "hub" / f"models--{MODEL_NAME.replace('/', '--')}" / "snapshots"
        if hub_path.exists():
            snapshots = list(hub_path.iterdir())
            if snapshots:
                model_path = str(snapshots[0].resolve())
                logger.info(f"Resolved local snapshot: {model_path}")

        logger.info(f"Loading N-ATLAS model from {model_path} on {device_name}...")
        
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_path, 
            torch_dtype=torch_dtype, 
            low_cpu_mem_usage=True, 
            use_safetensors=False,
            cache_dir=cache_dir
        )
        model.to(device if device >= 0 else "cpu")

        processor = AutoProcessor.from_pretrained(
            model_path, 
            cache_dir=cache_dir
        )

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
        return None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok" if asr_pipeline else "initializing",
        "progress": download_progress,
        "is_downloading": is_downloading,
        "error": download_error
    })

@app.route('/download-status', methods=['GET'])
def get_download_status():
    return jsonify({
        "progress": download_progress,
        "is_downloading": is_downloading,
        "error": download_error,
        "ready": asr_pipeline is not None
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if not asr_pipeline:
        return jsonify({"error": "Model is still downloading or initializing"}), 503
        
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        waveform, sr = librosa.load(io.BytesIO(audio_file.read()), sr=None, mono=True)
        
        if sr != SAMPLE_RATE:
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=SAMPLE_RATE)
        
        result = asr_pipeline(waveform)
        return jsonify({
            "text": result.get("text", "").strip(),
            "confidence": 0.95
        })
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return jsonify({"error": str(e)}), 500

import io

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='N-ATLAS Speech-to-Text Service')
    parser.add_argument('--port', type=int, default=5000, help='Port to listen on')
    parser.add_argument('--model-dir', type=str, default='./model_cache', help='Path to model cache directory')
    args = parser.parse_args()

    # Create cache dir if it doesn't exist
    Path(args.model_dir).mkdir(parents=True, exist_ok=True)
    
    # Check if download is needed
    check_and_download_model(args.model_dir)
    
    logger.info(f"🚀 Starting N-ATLAS Service on port {args.port}")
    app.run(host='0.0.0.0', port=args.port, debug=False, threaded=True)
