# 🔒 Zero-Trust Redactor Pro

**Localhost Privacy Suite** - Offline-first PII redaction with local AI. No cloud uploads for your documents.

A desktop-first application for redacting Personally Identifiable Information (PII) from documents. AI inference runs locally on your machine—your document data never leaves your device. One-time model/library downloads come from trusted CDNs (Hugging Face, jsDelivr) during setup.

## ✨ Features

- **🚀 Fast Mode** - BERT NER + Regex patterns for instant detection
- **🧠 Deep Scan** - Llama 3.2 1B for context-aware PII detection  
- **📄 PDF Layout Preservation** - Redactions maintain original document formatting
- **✋ Manual Selection** - Highlight text to add to redaction list
- **🔒 Zero Trust** - No document data leaves your device; network only for one-time model/library downloads
- **📋 Report Generation** - Export detection reports as PDF

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Python 3.9+
- ~2GB disk space for AI models
- WebGPU-capable browser (Chrome 113+, Edge 113+) for Llama

### Installation

```bash
# 1. Install dependencies
npm install
pip install -r requirements.txt

# 2. Download AI models from Hugging Face CDNs (one-time, ~1.5GB)
npm run setup

# 3. Start both servers
npm run start
```

This starts:
- **Vite dev server** at `http://localhost:3000` (frontend)
- **Flask API** at `http://localhost:5000` (PDF redaction backend)

### Alternative: Run Servers Separately

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend  
npm run server
# or: python server.py
```

## 📁 Project Structure

```
Zero-Trust-Redactor/
├── src/
│   ├── main.js              # Application entry point
│   ├── style.css            # Styles
│   └── services/
│       ├── ai-engine.js     # BERT & Llama model handling
│       ├── pdf-processor.js # PDF text extraction
│       └── redaction-service.js # Backend communication
├── public/
│   ├── models/              # Downloaded AI models (after setup)
│   └── pdf.worker.min.mjs   # PDF.js worker
├── scripts/
│   └── download-models.js   # Model download automation
├── server.py                # Flask backend for PDF redaction
├── index.html               # Main HTML
├── vite.config.js           # Vite configuration
└── package.json
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run server` | Start Python Flask backend |
| `npm run start` | Start both servers concurrently |
| `npm run setup` | Download all AI models (~1.5GB) |
| `npm run setup:bert` | Download only BERT model (~400MB) |
| `npm run setup:llama` | Download only Llama model (~1GB) |
| `npm run build` | Build for production |

## 🔧 Configuration

### Model Paths

Models are stored in `public/models/`:
- BERT NER: `public/models/transformers/Xenova/bert-base-NER/`
- Llama 3.2: `public/models/llama/Llama-3.2-1B-Instruct-q4f16_1-MLC/`

### Vite Proxy

The dev server proxies `/api/*` requests to `http://127.0.0.1:5000` for Flask backend communication.

## 🎯 Usage

1. **Upload a PDF** - Drag & drop or click to browse
2. **Select Mode**:
   - *Fast Mode*: Quick BERT + regex detection
   - *Deep Scan*: Context-aware Llama analysis
3. **Review Targets** - Check detected entities, add/remove as needed
4. **Process** - Click "Process & Redact PDF" to download redacted version

### Manual Entity Addition

Select text in the "Raw Text" panel to manually add items to the redaction list.

## 🔒 Privacy Guarantee

- **No cloud uploads** - All AI inference runs locally; document bytes never leave your device
- **One-time downloads only** - Models and JS libs are fetched during setup/page load from trusted CDNs; no document data is sent
- **Original files untouched** - New redacted copies are created
- **Temporary files cleaned** - Input files are deleted after processing
- **No telemetry** - No analytics or tracking

## 📦 Dependencies

### Frontend
- `@xenova/transformers` - BERT NER model
- `@mlc-ai/web-llm` - Llama 3 WebGPU inference
- `pdfjs-dist` - PDF text extraction
- `jspdf` - Report generation
- `vite` - Build tool

### Backend
- `flask` - Web server
- `flask-cors` - CORS handling
- `pymupdf` (fitz) - PDF manipulation & redaction

## 🚧 Troubleshooting

### "Models not loading"
Run `npm run setup` to download models. Ensure `public/models/` directory exists.

### "WebGPU not supported"  
Llama 3 requires WebGPU. Use Chrome 113+ or Edge 113+. Fast Mode (BERT) works on all browsers.

### "Server connection failed"
Ensure Python server is running: `npm run server` or `python server.py`

### "PDF worker not found"
The worker should be at `public/pdf.worker.min.mjs`. Re-run `npm run setup` if missing.

## 📄 License

GNU General Public License v3.0 (GPL-3.0-only). See LICENSE for details.

---

Built for YMYL (Your Money or Your Life) data privacy. Handle financial, medical, and legal documents with confidence.
