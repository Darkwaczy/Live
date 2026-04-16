import sys
import argparse
import time
import json
import threading
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

try:
    # We use cyndilib for professional network broadcast output.
    # The IDE might show a warning if the virtual environment is not selected.
    import cyndilib as ndi # type: ignore
except ImportError:
    logger.error("❌ cyndilib NOT FOUND! Ensure you are using the project .venv.")
    logger.error("   Run: .venv\\Scripts\\pip install cyndilib")
    sys.exit(1)


app = Flask(__name__)
CORS(app)

# --- Configuration ---
SOURCE_NAME = "SermonSync Display"
WIDTH = 1920
HEIGHT = 1080
FPS = 30

# Global State
current_text = ""
current_subtext = ""
current_theme = "lower-third" # lower-third, center, overlay
is_visible = False

# --- Rendering Logic ---
def create_frame(text, subtext, theme):
    # Create transparent image (RGBA)
    img = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Try to load a nice font, fallback to default
    try:
        # Looking for common Windows/Mac fonts
        font_path = "C:/Windows/Fonts/arial.ttf" if sys.platform == "win32" else "/System/Library/Fonts/Helvetica.ttc"
        main_font = ImageFont.truetype(font_path, 60)
        sub_font = ImageFont.truetype(font_path, 35)
    except:
        main_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()

    if theme == "lower-third":
        # Draw a semi-transparent box for the third
        padding = 40
        box_height = 180
        box_y = HEIGHT - box_height - 100
        
        # Simple rounded-ish rect for background
        draw.rectangle([padding, box_y, WIDTH - padding, box_y + box_height], fill=(20, 20, 20, 180))
        
        # Text rendering
        draw.text((padding + 40, box_y + 30), text, font=main_font, fill=(255, 255, 255, 255))
        if subtext:
            draw.text((padding + 40, box_y + 110), subtext, font=sub_font, fill=(200, 200, 200, 255))

    elif theme == "center":
        # Full screen centered text for scripture focus
        w, h = draw.textsize(text, font=main_font) if hasattr(draw, 'textsize') else (WIDTH//2, 100)
        draw.text(((WIDTH - w) // 2, (HEIGHT - h) // 2), text, font=main_font, fill=(255, 255, 255, 255), align="center")

    # Convert to BGRA for NDI
    return np.array(img.convert('RGBA'))

# --- NDI Thread ---
def ndi_worker():
    global current_text, current_subtext, current_theme, is_visible
    
    # NDI initialization is handled automatically by cyndilib objects
    pass

    # Create Sender
    sender = ndi.Sender(ndi_name=SOURCE_NAME)
    
    if not sender:
        logger.error("❌ Failed to create NDI sender")
        return

    logger.info(f"🚀 NDI Broadcast started: '{SOURCE_NAME}'")
    
    frame_time = 1.0 / FPS
    video_frame = sender.video_frame(WIDTH, HEIGHT, ndi.FourCC.BGRA)
    
    try:
        while True:
            start_time = time.time()
            
            if is_visible:
                # Optimized: Only re-render if state changed? 
                # For now, just generate every frame for smooth transparency handling
                frame_data = create_frame(current_text, current_subtext, current_theme)
                video_frame.data = frame_data
                sender.send_video(video_frame)
            else:
                # Send a single blank transparent frame to "clear" the stream
                blank_frame = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
                video_frame.data = blank_frame
                sender.send_video(video_frame)
            
            sleep_time = frame_time - (time.time() - start_time)
            if sleep_time > 0:
                time.sleep(sleep_time)
    finally:
        ndi.destroy()

# --- API Endpoints ---
@app.route('/update', methods=['POST'])
def update_display():
    global current_text, current_subtext, current_theme, is_visible
    data = request.json
    current_text = data.get('text', '')
    current_subtext = data.get('subtext', '')
    current_theme = data.get('theme', 'lower-third')
    is_visible = data.get('active', True)
    return jsonify({"status": "updated"})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "running", "source": SOURCE_NAME})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SermonSync Live Stream Output Service')
    parser.add_argument('--port', type=int, default=5004, help='Port to listen on')
    args = parser.parse_args()
    
    # Start NDI thread
    ndi_thread = threading.Thread(target=ndi_worker, daemon=True)
    ndi_thread.start()
    
    logger.info(f"📡 API Controller listening on port {args.port}")
    app.run(host='0.0.0.0', port=args.port, debug=False, threaded=True)
