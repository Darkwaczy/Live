# SermonSync

A Windows desktop/tablet-first church assistant app using Electron + React.

## Features Implemented (Phase 1)

- Local Electron + React skeleton
- Live transcription pipeline mock (low-latency simulated chunks)
- Bible verse detection (book names + abbreviations)
- Lyrics detection/matching with sample song DB
- Sync panel and Socket.IO-based realtime session sync
- Notes panel with context metadata and autosave placeholder
- Multi-panel layout (transcript, bible, lyrics, notes, session info, sync status)
- Supabase integration stubs with offline fallback notes
- Windows installer config via electron-builder (NSIS)

## Folder Structure

- `electron/main.ts`: Electron main process + window setup
- `electron/preload.ts`: IPC bridge and safe API handshake
- `src/App.tsx`: top-level app shell
- `src/components/`: UI panels
- `src/hooks/`: live state + sync logic
- `src/services/`: transcription parser, DB, lyrics, sync
- `src/models/`: data models for sessions, live_state, notes, songs
- `socket-server.ts`: local reference Socket.IO room server

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Start the realtime socket server

```bash
npm run start:sync-server
```

3. Start app in development

```bash
npm run dev
```

4. For production build

```bash
npm run build
```

5. Create installer

```bash
npm run build:electron
```

## Key Integration Notes

- `SpeechService` is currently `provider: 'mock'`; replace with Whisper, Azure, Google streaming for <2s latency
- `bibleParser` uses regex matching for formats like `John 3:16`, `1 Corinthians 13:4-7` and normalized book names
- `lyricsService` contains sample song DB with `SongLine` objects and fuzzy match on sample text
- `RealtimeSync` currently uses Socket.IO `updateState` events. For scaling use Supabase Realtime or custom hosted WebSocket
- `dbService` has Supabase structure and offline warning. Add local sqlite queue, e.g. `better-sqlite3` + journaling

## Electron & Tablet-first Best Practices

- Keep UI landscape-first; prefer grid + resizable split panels.
- Avoid mobile-only touch patterns; support stylus and keyboard shortcuts.
- Use `contextIsolation=true`, `nodeIntegration=false`, secure IPC channels.
- Bundle with `electron-builder` NSIS for Windows installers; sign binaries for distribution.

## TODO (Phase 2 Outline)

- Real microphone capture with `MediaDevices.getUserMedia({ audio: true })` in renderer + worker
- Integrate real streaming speech service with chunked optimistic update
- Support Nigerian English accents via locale or custom acoustic model
- Offline local SQLite cache and sync queue management
- Session login/auth, role-based controls, projector mode fullscreen
- Enhanced Bible parser with full Canon + cross-reference
- Unit tests for parser, hook behavior, realtime sync and note persistence

