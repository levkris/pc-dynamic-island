# PC Dynamic Island

A macOS-style Dynamic Island for Windows, built with Electron. Slides down from the top of the screen to show media controls, a clock, app shortcuts, and an integrated AI assistant.

---

## Features

- Animated island widget that slides down on hover or media change
- Live media controls via Windows SMTC (Spotify, Chrome, etc.)
- **DynAI** - local AI assistant powered by Ollama
- Expandable full-screen app mode
- Native C++ notification bridge - intercepts Windows toast notifications and forwards them to the island
- `Alt+Enter` global shortcut to open DynAI from anywhere

---

## Project Structure

```
pc-dynamic-island/
├── assets/
│   ├── icons/                    SVG icons
│   └── styles/                   CSS stylesheets
│       ├── ai.css
│       └── island.css
├── data/
│   ├── games.json                Known game process names
│   └── prompts.json              AI prompt history (auto-generated)
├── native/
│   └── notification_bridge/      C++ WinRT notification interceptor
│       ├── main.cpp
│       └── CMakeLists.txt
├── src/
│   ├── main/
│   │   ├── index.js              Electron main process entry
│   │   ├── ipc.js                IPC handlers
│   │   ├── notifications.js      Notification bridge integration
│   │   └── windows.js            Window creation and management
│   ├── renderer/
│   │   ├── ai/
│   │   │   ├── index.html
│   │   │   └── renderer.js       DynAI UI logic
│   │   └── island/
│   │       ├── index.html
│   │       └── renderer.js       Island UI logic
│   └── shared/
│       └── utils.js              Shared utilities
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | |
| Windows | 10 1803+ (build 17134) or 11 | WinRT notification APIs |
| Ollama | Latest | Only needed for DynAI |
| Visual Studio | 2022 with "Desktop development with C++" | Only needed for notification bridge |
| CMake | 3.20+ | Only needed for notification bridge |

---

## Installation

```bash
npm install
npm run rebuild
```

`npm run rebuild` recompiles native Node modules (`robotjs`, `extract-file-icon`) against the Electron version.

---

## Running

```bash
npm start
```

Ollama must be running locally on port `11434` with the `llama3.2` model pulled:

```bash
ollama pull llama3.2
ollama serve
```

---

## Building the Notification Bridge (C++)

The notification bridge is a standalone C++ executable that uses the Windows `UserNotificationListener` WinRT API. It outputs newline-delimited JSON to stdout, which the Electron main process reads.

**Requirements:** Visual Studio 2022, CMake 3.20+, Windows SDK 10.0.17134+

```bash
cd native/notification_bridge
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

The output binary will be at `native/notification_bridge/build/Release/notification_bridge.exe`.

On first run Windows will show a permission prompt, the user must click **Allow**.

### Notification JSON format

```json
{ "id": 12345, "kind": "added", "app": "Discord", "title": "John", "body": "Hey!" }
{ "id": 12345, "kind": "removed" }
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Enter` | Open DynAI |
| `←` / `→` | Switch island pages |

---

## Environment Variables

Create a `.env` file in the project root if needed. Currently unused but reserved for future API keys.

---

## Architecture Notes

- The island window is a frameless, transparent, always-on-top Electron window pinned to the top center of the screen.
- It animates between a compact bar (400×140) and a full-screen expanded view.
- The notification bridge process is spawned from `src/main/notifications.js` and kept alive for the app lifetime.
- IPC between renderer and main uses Electron's `ipcMain` / `ipcRenderer`.
- AI responses are streamed token-by-token via `ai-stream` IPC events.