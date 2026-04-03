<div align="center">

# 🛡️ Zero-Trust Redactor Pro

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success)](.)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.)

**Localhost Privacy Suite** — AI-powered PII redaction that runs entirely on your machine.

Your documents never leave your device. Ever.

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Privacy](#-privacy-guarantee) • [License](#-license)

---

<!-- Add a screenshot here -->
<!-- ![Zero-Trust Redactor Screenshot](docs/screenshot.png) -->

</div>

## 🎯 What is Zero-Trust Redactor?

A desktop-first application for redacting **Personally Identifiable Information (PII)** from PDF documents using local AI. Unlike cloud-based solutions, all processing happens on your machine — your sensitive documents are never uploaded anywhere.

> 💡 **Zero Trust** means we assume the network is hostile. Your document data stays local; only one-time model downloads use the network.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **Fast Mode** | YMYL regex patterns for instant structural PII detection |
| 🧠 **Deep AI Mode** | Gemma 4 (via Ollama) for context-aware, semantic PII analysis |
| 🔍 **Dual-Check** | Gemma vision + YMYL regex run in parallel and merge results |
| 📄 **PDF Preservation** | Redactions maintain original document formatting |
| ✋ **Manual Selection** | Click any word in the PDF to add custom redaction targets |
| 🖱️ **Hover to Locate** | Hover an entity in the panel to instantly highlight it in the PDF |
| 🔒 **100% Local** | Document data never leaves your device |
| 📊 **Hardware-Aware** | Auto-detects GPU/RAM and routes to the right engine |
| 🎨 **Modern UI** | Dark theme, drag-and-drop, zoom, keyboard shortcuts |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.9+
- **[Ollama](https://ollama.ai)** installed and running locally (for Deep AI mode)
- Gemma 4 model pulled: `ollama pull gemma4`
- ~10GB disk space for Gemma 4 (model is cached by Ollama)

### Option 1: One-Click Launch (Windows)

```bash
# Double-click or run:
start.bat
```

### Option 2: Manual Setup

```bash
# 1. Clone the repository
git clone https://github.com/HersonAlmeida/Zero-Trust-Redactor.git
cd Zero-Trust-Redactor

# 2. Install frontend dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Start Ollama (in a separate terminal)
ollama serve

# 5. Start the application
npm run start
```

🌐 Open **http://localhost:3000**

---

## 🧠 Architecture

Zero-Trust Redactor uses a **4-Pass AI pipeline** that grounds every LLM result in verifiable PDF coordinates — so it never blindly trusts the AI output.

```
┌──────────────────────────────────────────────────────────────────┐
│  DEEP AI PIPELINE  (triggered on each uploaded PDF page)         │
│                                                                  │
│  Pass 1 │ Word Map                                               │
│         │ PyMuPDF extracts every word with its exact [x0,y0,x1,y1]│
│         │ bounding box. Stored in a sorted word sequence list.   │
│                                                                  │
│  Pass 2 │ Vision Extraction (Gemma 4)                            │
│         │ The rendered page image is sent to Gemma 4 locally via │
│         │ Ollama. Gemma reads the visual layout and returns a     │
│         │ strict JSON array of PII strings — names, account      │
│         │ numbers, addresses — nothing else.                     │
│                                                                  │
│  Pass 2b│ YMYL Regex Compliance Check                            │
│         │ Structural patterns (sort codes, IBANs, postcodes,     │
│         │ emails) run in parallel. Results are merged with        │
│         │ Gemma's output, deduplicating by value.                │
│                                                                  │
│  Pass 3 │ Sliding Window Matchmaker                              │
│         │ Each PII string from Gemma is split into tokens.       │
│         │ The matcher slides through the word sequence looking    │
│         │ for those tokens in order on the same line.            │
│         │ Matching word bboxes are merged into one tight rect.   │
│         │ → Guarantees pixel-perfect boxes. Never page-wide bars.│
└──────────────────────────────────────────────────────────────────┘
```

### Why This Matters

Most LLM-based redactors have a critical flaw: they trust the AI's text output and use `search_for()` to locate it — which can return the bounding box of an **entire line** when the string spans multiple PDF text blocks, producing page-wide red bars.

Zero-Trust Redactor **never calls `search_for()` for multi-word phrases**. The coordinates come purely from the word-sequence merge — Gemma provides *what* to redact, PyMuPDF provides *where*.

### Dual Engine — Hardware-Aware Routing

```
                    ┌─────────────────────────┐
                    │   Hardware Detection     │
                    │  (GPU, RAM, VRAM check)  │
                    └────────────┬────────────┘
                                 │
               ┌─────────────────┴──────────────┐
               │                                │
        Weak hardware                    Strong hardware
        (or Fast Mode)                   (Deep AI mode)
               │                                │
       ┌───────▼──────┐               ┌─────────▼────────┐
       │  YMYL Regex  │               │  Gemma 4 Vision  │
       │  Fast, zero  │               │  + YMYL fallback │
       │  GPU needed  │               │  Ollama local    │
       └──────────────┘               └──────────────────┘
```

### Setting Up Ollama

1. Download and install Ollama from **https://ollama.ai**
2. Pull the Gemma 4 model (9.6 GB):
   ```bash
   ollama pull gemma4
   ```
3. Ensure Ollama is running before launching the app:
   ```bash
   ollama serve
   ```
4. The app auto-detects Ollama at `http://localhost:11434`. No configuration needed.

> **No GPU?** Fast Mode uses lightweight regex patterns and works on any machine with zero GPU requirement.

---

## 🎯 Usage

<table>
<tr>
<td width="50%">

### Basic Workflow

1. **Upload** — Drag & drop a PDF or click to browse
2. **Scan** — Fast Mode (instant) or Deep AI (Gemma 4)
3. **Review** — Hover entities in the panel to locate them in the PDF
4. **Adjust** — Click words to add/remove targets manually
5. **Redact** — Download the permanently redacted PDF

</td>
<td width="50%">

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Run scan |
| `Ctrl+R` | Redact document |
| `Ctrl+P` | Preview redactions |
| `Ctrl+Z` | Undo last manual target |
| `Esc` | Close modals |

</td>
</tr>
</table>

### Manual Entity Addition

Select any text in the PDF view → it is immediately added to the redaction targets list.

---

## 🔒 Privacy Guarantee

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR DEVICE                          │  INTERNET           │
│  ══════════════════════════════════   │  ═══════════════    │
│  ┌─────────┐    ┌─────────┐           │                     │
│  │   PDF   │───▶│ Gemma 4 │           │  ✗ No document      │
│  │ (local) │    │ (local) │           │    data sent        │
│  └─────────┘    └─────────┘           │                     │
│       │              │                │  ✓ One-time model   │
│       ▼              ▼                │    download only    │
│  ┌─────────────────────┐              │                     │
│  │  Redacted PDF       │              │                     │
│  │  (stays local)      │              │                     │
│  └─────────────────────┘              │                     │
└─────────────────────────────────────────────────────────────┘
```

- ✅ **No cloud uploads** — AI runs 100% locally via Ollama
- ✅ **No telemetry** — Zero analytics or tracking
- ✅ **Original untouched** — A new redacted copy is created; source file never modified
- ✅ **Temp files deleted** — Inputs removed immediately after processing
- ✅ **Metadata scrubbed** — Author/creator fields cleared from output PDF
- ✅ **No incremental saves** — Output saved with `garbage=4` to remove all pre-redaction content streams
- ✅ **Open source** — Audit every line of code yourself

---

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start frontend + backend (recommended) |
| `npm run dev` | Start Vite dev server only |
| `npm run server` | Start Flask backend only |
| `npm run build` | Build for production |

---

## 📁 Project Structure

```
Zero-Trust-Redactor/
├── src/
│   ├── main.js                 # App orchestration, PDF rendering, entity panel
│   ├── style.css               # Dark theme UI
│   └── services/
│       ├── redaction-service.js# Backend API communication
│       └── intel-database.js   # Fast Mode YMYL regex patterns
├── server.py                   # Flask backend
│   ├── /analyze/deep           # 4-Pass Gemma pipeline
│   ├── /redact                 # PDF permanent redaction
│   └── /analyze                # Fast Mode regex endpoint
├── public/                     # Static assets
├── scripts/                    # Setup scripts
├── requirements.txt            # Pinned Python dependencies
├── start.bat                   # Windows one-click launcher
└── package.json
```

---

## 🚧 Troubleshooting

<details>
<summary><b>Deep AI returns no results</b></summary>

Ensure Ollama is running and Gemma 4 is pulled:
```bash
ollama serve
ollama pull gemma4
```
Check Ollama is reachable: `curl http://localhost:11434`

</details>

<details>
<summary><b>Server connection failed</b></summary>

Ensure the Flask backend is running:
```bash
python server.py
# or
npm run server
```

</details>

<details>
<summary><b>Redaction returns 500 error</b></summary>

Install Python dependencies:
```bash
pip install -r requirements.txt
```

</details>

<details>
<summary><b>Highlights are page-wide bars</b></summary>

This was a known bug fixed in v2.0. The Sliding Window Matchmaker (`_find_phrase_bboxes`) replaced `search_for()` for multi-word phrases. Pull the latest version.

</details>

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| **AI Vision (Deep)** | Gemma 4 via Ollama (local) |
| **AI Fallback (Fast)** | YMYL regex patterns |
| **PDF Extraction** | PyMuPDF (`get_text("words")` word-level bboxes) |
| **PDF Rendering** | PDF.js |
| **Frontend** | Vanilla JS + Vite |
| **Backend** | Flask + Flask-CORS |
| **Hardware Detection** | psutil |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

> **Note on AI models:** Gemma 4 is distributed by Google under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms), which permits local personal and commercial use. The model weights are downloaded and run locally via Ollama and are not bundled with this repository.

---

## ⚠️ Disclaimer

This tool runs **100% locally** to ensure data privacy. However, **users are strictly responsible** for verifying that all sensitive information has been successfully redacted before sharing documents.

Automated AI redaction — no matter how sophisticated — may not catch every piece of sensitive data in every document. Always perform a **manual review** of the redacted output before distributing it.

**The creator and contributors assume no liability for missed redactions, data exposure, or any consequences arising from the use of this software.** Use at your own risk.

---

<div align="center">

**Built for YMYL (Your Money or Your Life) data privacy.**

Handle financial, medical, and legal documents with confidence.

⭐ Star this repo if you find it useful!

</div>