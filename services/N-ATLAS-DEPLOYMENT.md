# N-ATLAS Integration Guide

## Overview

This application now uses **N-ATLAS** (Nigerian-Accented Automatic Transcription and Language System) as its primary speech recognition engine.

**What This Means:**
- ✅ Optimized for Nigerian English accent
- ✅ 100% local transcription (no cloud dependencies)
- ✅ Free for apps under 1,000 users
- ✅ Trained on Nigerian church/religious content
- ✅ No transcription data sent to external services

---

## Installation & Setup

### 1. **System Requirements**

- **Docker & Docker Compose** (recommended) OR
- **Python 3.10+** with GPU support (optional, uses CPU otherwise)
- **2GB+ VRAM** minimum (4GB+ recommended)
- **Port 5000** available on localhost

### 2. **Option A: Docker (Recommended)**

#### a. Start the N-ATLAS Service

```bash
cd services/
docker-compose up -d n-atlas
```

This will:
- Download the N-ATLAS model (~500MB)
- Start the Flask API on `http://localhost:5000`
- Enable GPU support if available (NVIDIA cards)
- Cache models for faster restarts

#### b. Verify it's Running

```bash
curl http://localhost:5000/health

# Expected response:
{
  "status": "ok",
  "model": "NCAIR1/NigerianAccentedEnglish",
  "device": "GPU" or "CPU",
  "timestamp": "..."
}
```

#### c. Stop the Service

```bash
docker-compose down
```

---

### 3. **Option B: Local Python Installation**

If you prefer running without Docker:

```bash
cd services/

# Install dependencies
pip install -r requirements.txt

# Run the service
python n_atlas_service.py
```

The service will start on `http://localhost:5000`

---

## Frontend Configuration

### 1. **Enable N-ATLAS in Settings**

Open the app and go to **Settings → AI & Detection**

1. Toggle **Live Transcription** on
2. Select **N-ATLAS Nigerian English** from the dropdown
3. Leave API key blank (N-ATLAS is local)
4. Click **Save Preferences**

### 2. **Verify Connection**

The app will automatically check if N-ATLAS is available when you start listening. You should see:
- Console message: `[AudioService] ✅ N-ATLAS service is healthy`
- UI message: "🎤 Listening with N-ATLAS (Nigerian English)..."

---

## How It Works

### Transcription Flow

```
🎤 Audio Input (Microphone)
    ↓
[AudioService] Captures and chunks audio (2-30 seconds max)
    ↓
HTTP POST to N-ATLAS API (localhost:5000/transcribe)
    ↓
Flask Service + NigerianAccentedEnglish Model
    ↓
Transcribed Text JSON
    ↓
✅ Sent to app for Bible detection, lyrics, etc.
```

### Features

| Feature | Status | Details |
|---------|--------|---------|
| **Nigerian Accent Support** | ✅ | Trained on Nigerian English speech |
| **Offline** | ✅ | No internet required after setup |
| **Free** | ✅ | Free tier: ≤1,000 active users |
| **Streaming** | ⚠️ | Chunks processed individually (2-30s max) |
| **Confidence Scores** | ✅ |Provided with each transcription |
| **Formatting** | ✅ | Automatic capitalization and punctuation |

---

## Environment Variables

### Optional: Custom N-ATLAS Endpoint

If running N-ATLAS on a different host:

Create `.env` in your app root:

```env
VITE_N_ATLAS_ENDPOINT=http://192.168.1.100:5000
```

Or set via JavaScript:

```javascript
audioService.setConfig({
  nAtlasEndpoint: 'http://remote-server:5000'
});
```

---

## Troubleshooting

### Issue: "N-ATLAS service is not running"

**Solution:**
```bash
# Check if Docker container is running
docker ps | grep n-atlas

# If not, start it
docker-compose up -d n-atlas

# View logs
docker-compose logs -f n-atlas
```

### Issue: "Failed to load model"

**Solution:**
```bash
# Re-download model
docker-compose down
docker-compose up -d n-atlas --build

# Or check disk space
du -sh ~/.cache/huggingface/
```

### Issue: High CPU usage with slow transcription

**Solution:**
```bash
# Check if GPU is available
docker exec n-atlas python -c "import torch; print(torch.cuda.is_available())"

# If False, install CUDA drivers:
# https://nvidia.com/Download/driverDetails.aspx
```

### Issue: "Connection refused" on localhost:5000

**Solution:**
```bash
# Check if port is in use
lsof -i :5000

# If in use, kill the process or use different port:
# Edit docker-compose.yml, change "5000:5000" to "5001:5000"
```

---

## Performance Notes

### Typical Latency

| Scenario | Latency | Notes |
|----------|---------|-------|
| **GPU (RTX 3080+)** | 1-2s | Best performance |
| **GPU (RTX 2060)** | 2-4s | Good balance |
| **CPU (modern)** | 4-8s | Acceptable for 2-3s chunks |
| **CPU (older)** | 8-15s | Adjust chunk size if needed |

### Optimization Tips

1. **GPU Acceleration**
   - Install CUDA drivers for your GPU
   - Docker will auto-detect and use nvidia-docker

2. **Batch Processing**
   - Process multiple files server-side if needed
   - Use `/transcribe-raw` endpoint for PCM data

3. **Chunk Size**
   - Default: 2-30 seconds
   - Shorter chunks (2s) → faster feedback, more API calls
   - Longer chunks (15-30s) → less overhead, higher latency

---

## Advanced Configuration

### Custom Model Endpoint

To use a different Hugging Face model (experimental):

Edit `services/n_atlas_service.py`:

```python
MODEL_NAME = "NCAIR1/NigerianAccentedEnglish"  # ← Change this
```

Available models:
- `NCAIR1/NigerianAccentedEnglish` (recommended)
- `NCAIR1/N-ATLaS-LLM` (language model, not for ASR)
- Other Whisper variants on Hugging Face

### Scale to Multiple Instances

For high-demand scenarios:

```yaml
# docker-compose.yml
services:
  n-atlas-1:
    build: .
    ports:
      - "5000:5000"
  
  n-atlas-2:
    build: .
    ports:
      - "5001:5000"

  # Use load balancer (nginx) in front
```

---

## Licensing

### Free Tier
- ✅ Non-commercial applications
- ✅ Education & research
- ✅ Up to 1,000 active users (30-day rolling)
- ✅ Full attribution required

### Commercial Tier
- Contact: datasupport@awarri.com
- For applications with >1,000 users

---

## Resources

- **Official**: https://huggingface.co/NCAIR1/NigerianAccentedEnglish
- **Government**: https://ncair.nitda.gov.ng/
- **Technical Support**: datasupport@awarri.com
- **Model Card**: https://huggingface.co/NCAIR1/NigerianAccentedEnglish#model-details

---

## Next Steps

1. ✅ Start N-ATLAS service: `docker-compose up -d n-atlas`
2. ✅ Open app settings and select N-ATLAS
3. ✅ Start listening and verify transcription works
4. ✅ Check browser console for `[N-ATLAS] ✅ Transcribed` messages

Happy transcribing! 🎤🇳🇬
