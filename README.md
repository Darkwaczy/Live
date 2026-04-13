# 🎙️ SermonSync (Live)

**Enterprise-grade AI Sermon Transcription & Bible Tagging Suite**

SermonSync is a high-performance Windows desktop application designed for churches. It features a multi-engine speech-to-text pipeline optimized for religious contexts and Nigerian accents, combined with real-time metadata tagging.

---

## 🚀 Native Speech Engines

The core of SermonSync is its versatile `AudioService`, which supports multiple industry-leading transcription providers:

*   **🇳🇬 N-ATLAS (Internal)**: A custom-built local service using a fine-tuned Whisper model for **Nigerian Accented English**. Runs locally on port 5003 for maximum privacy and zero latency.
*   **⚡ Deepgram Nova-2**: High-speed WebSocket streaming integration with advanced **Phonetic Boosting** to ensure religious vocabulary (e.g., "Mazzaroth", "Ephesians") is captured accurately.
*   **🤖 Cloud Hybrid**: Native support for **OpenAI Whisper**, **Groq (Llama-3)**, and **Google Cloud Speech** for high-accuracy fallbacks and system-audio transcription.

---

## ✨ Advanced Features

### 📖 Intelligent Bible Tagging
A sophisticated regex-based parser that identifies Bible references in real-time, supporting:
*   Standard formats: `John 3:16`, `1 Corinthians 13:4-7`
*   Nigerian abbreviations and phonetic matches (e.g., `Gen`, `Exo`, `Matt`).
*   Automated cross-referencing with a local Bible database.

### 🎶 Worship Analytics
*   Identifies worship songs via fuzzy matching against a curated song database.
*   Synchronizes lyrics and metadata for live screen display.

### 🔄 Real-time Ecosystem
*   **Sync Panel**: Multi-device synchronization via Socket.IO.
*   **Sidecar Services**: Managed Python services for local AI processing (N-ATLAS).
*   **Contextual Notes**: Rich metadata-aware note-taking that anchors transcription to specific sermon segments.

---

## 🏗️ Technical Architecture

*   **Frontend**: React 18 / TypeScript / TailwindCSS
*   **Backend**: Electron 26 (Secure IPC Handshake)
*   **AI Sidecar**: Python Flask / PyInstaller (N-ATLAS Service)
*   **Database**: Supabase (Cloud) + SQLite/sql.js (Local Cache)

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
