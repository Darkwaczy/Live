# 🎙️ SermonSync

**Advanced AI-powered Sermon Transcription & Bible Tagging Church Assistant**

SermonSync is a premium Windows desktop/tablet-first application designed for modern churches. It leverages AI to provide real-time sermon transcription, automated Bible verse detection, worship lyrics matching, and seamless multi-device session synchronization.

---

## ✨ Key Features (Phase 1)

*   **⚡ Real-time Transcription Pipeline** — Low-latency transcription engine with chunk-based streaming (current mock provider).
*   **📖 Smart Bible Verse Detection** — Intelligent regex-based parser supporting standard formats (e.g., `John 3:16`) and common Nigerian Bible abbreviations.
*   **🎶 Worship Lyrics Matching** — High-performance matching engine that identifies worship songs in real-time from a curated database.
*   **🔄 Real-time Session Sync** — Socket.IO-powered synchronization that keeps hosts and screens perfectly aligned across devices.
*   **📝 Contextual Notes Panel** — Intelligent notes system with session metadata, context-aware tagging, and robust autosave.
*   **🖥️ Multi-Panel Architecture** — A fluid, resizable grid layout optimized for landscape tablet and desktop workflows.
*   **📦 Distribution Ready** — Professional Windows installer packaging via `electron-builder` (NSIS).

---

## 🛠️ Tech Stack

*   **Core**: Electron 26, React 18, TypeScript, Vite
*   **Styling**: TailwindCSS
*   **Real-time**: Socket.IO
*   **Data & Auth**: Supabase, sql.js (Local Bible DB), Vosk (Local Speech)
*   **Persistence**: Electron Store, SQLite

---

## 📂 Project Structure

*   `electron/`: Main process and secure IPC bridge configuration.
*   `src/components/`: Modular UI panels built for performance and responsiveness.
*   `src/hooks/`: Reactive state management for live transcription and synchronization.
*   `src/services/`: Core logic for parsers, database interactions, and lyrics engine.
*   `src/models/`: Strongly-typed data models for consistent data handling.

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Installation
```bash
npm install
```

### 3. Start Development
Start the local synchronization server:
```bash
npm run start:sync-server
```

In a new terminal, launch the application:
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build          # Full production build
npm run build:electron # Generate Windows installer (.exe)
```

---

## 🗺️ Roadmap (Phase 2)

- [ ] **Real Audio Capture**: Native microphone integration via `MediaDevices API`.
- [ ] **Streaming AI**: Integration with Whisper or Azure Speech for production-grade transcription.
- [ ] **Locale Support**: Enhanced support for Nigerian English accents and local dialects.
- [ ] **Offline Resilience**: Local SQLite caching and robust sync queue management.
- [ ] **Projector Mode**: Full-screen dedicated output for church displays and projectors.
- [ ] **Authentication**: Role-based access control and secure session management.

---

## 🔐 Security & Best Practices

SermonSync is built with security as a priority:
*   `contextIsolation` and `nodeIntegration` are properly configured for a secure IPC handshake.
*   Landscape-first UI follows tablet-best practices for better usability in church environments.
*   Bundled with code signing readiness for secure distribution.

---

**Built by Darkwaczy** | [Live Preview](https://live-kamalu.vercel.app)

