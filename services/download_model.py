import os
import sys
from transformers import pipeline
import argparse

def download_model(model_name, cache_dir):
    print(f"Downloading model '{model_name}' to '{cache_dir}'...")
    try:
        os.makedirs(cache_dir, exist_ok=True)
        
        # This will download the model and its dependencies
        # We explicitly set device="cpu" to avoid CUDA issues during download
        asr = pipeline(
            "automatic-speech-recognition",
            model=model_name,
            cache_dir=cache_dir,
            device="cpu"
        )
        
        print("Model download attempt complete.")
        
        # Verify if files exist in cache
        if any(os.scandir(cache_dir)):
            print("Successfully verified files in cache directory.")
        else:
            print("Warning: Cache directory is still empty.")
            
    except Exception as e:
        print(f"Error during model download: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Ensure stdout handles UTF-8 or just avoid it
    parser = argparse.ArgumentParser(description='Download N-ATLAS model locally.')
    parser.add_argument('--model', type=str, default="NCAIR1/NigerianAccentedEnglish", help='Model name on Hugging Face')
    parser.add_argument('--cache-dir', type=str, default="./services/model_cache", help='Local cache directory')
    args = parser.parse_args()
    
    download_model(args.model, args.cache_dir)
