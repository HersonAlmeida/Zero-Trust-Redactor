# Zero-Trust Redactor - Architecture & Code Documentation

## 📋 Overview

Zero-Trust Redactor is a **privacy-first, offline-capable** PDF redaction tool that uses AI (BERT and Llama) combined with pattern-based detection to identify and redact Personally Identifiable Information (PII) from documents.

### Key Features
- 🔒 **Zero-Trust**: Files never leave your device - all processing is local
- 🌐 **Controlled Network Use**: Only one-time model/library downloads from trusted CDNs (no document data transmitted)
- 🤖 **AI-Powered**: Uses BERT NER and optional Llama 3.2 for intelligent detection
- 📋 **Intel Database**: Pre-configured patterns for different document types
- 📄 **PDF Support**: View, analyze, and redact PDF documents
- ✋ **Manual Selection**: Click on text to add custom redaction targets

---

## 🗂️ Project Structure

```
Zero-Trust-Redactor/
├── index.html              # Main HTML entry point
├── server.py               # Flask backend for PDF redaction
├── vite.config.js          # Vite build configuration
├── package.json            # Node.js dependencies
│
├── src/
│   ├── main.js             # Main application logic
│   ├── style.css           # All CSS styles
│   └── services/
│       ├── ai-engine.js        # BERT & Llama AI models
│       ├── intel-database.js   # Pattern presets & keywords
│       ├── pdf-processor.js    # PDF text extraction
│       └── redaction-service.js # Redaction API calls
│
├── public/
│   ├── pdf.worker.min.mjs  # PDF.js web worker
│   └── models/             # (Optional) Local model cache
│
├── scripts/
│   └── download-models.js  # Model download utility
│
└── temp/                   # Temporary files during redaction
```

---

## 🔧 Core Components

### 1. Frontend Entry (`index.html`)

The main HTML file that bootstraps the application.

**Key Elements:**
- CDN script for `@huggingface/transformers@3.0.0`
- Drop zone for file upload
- PDF viewer container with toolbar
- Intel Database panel
- Entity list display
- Action buttons (Scan, Redact, Clear)
- Toast notification container

**CDN Dependencies:**
```html
<script type="module">
  import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';
</script>
```

---

### 2. Main Application (`src/main.js`)

The central JavaScript file (~1000 lines) that orchestrates all functionality.

#### State Management
```javascript
let currentFile = null;           // Current uploaded file
let currentMode = 'fast';         // 'fast' (BERT) or 'deep' (Llama)
let detectedEntities = [];        // AI-detected entities
let manualEntities = [];          // User-added entities
let activePresets = [];           // Active Intel presets
let customKeywords = [];          // User custom keywords
let pdfDocument = null;           // PDF.js document instance
let pdfZoom = 1.0;                // Current zoom level
let currentView = 'pdf';          // 'pdf' or 'text' view
let stats = { scanned: 0, entities: 0, redacted: 0 };
```

#### Key Functions

| Function | Description |
|----------|-------------|
| `initApp()` | Initialize app, load models, setup UI |
| `processFile(file)` | Handle file upload, extract text, render PDF |
| `renderPDF(arrayBuffer)` | Render PDF pages to canvas |
| `renderPage(pageNum)` | Render single PDF page with text layer |
| `runScan()` | Execute AI + Intel detection |
| `runRedaction()` | Send redaction request to backend |
| `displayEntities()` | Update entity list UI |
| `switchView(view)` | Toggle PDF/Text view |
| `clearAll()` | Reset all state |

#### Event Flow
```
File Upload → processFile() → extractText() + renderPDF()
                                    ↓
                            displayEntities()
                                    ↓
User clicks "Scan" → runScan() → detectWithBert/Llama() + scanWithIntel()
                                    ↓
                            displayEntities() with results
                                    ↓
User clicks "Redact" → runRedaction() → Flask server → Download redacted PDF
```

---

### 3. AI Engine (`src/services/ai-engine.js`)

Handles AI model loading and inference.

#### Models Used

| Model | Purpose | Source |
|-------|---------|--------|
| `Xenova/bert-base-NER` | Named Entity Recognition | Hugging Face CDN |
| `Llama-3.2-1B-Instruct` | Context-aware deep scan | WebLLM (requires WebGPU) |

#### Key Functions

```javascript
// Initialize BERT model
export async function initBert(progressCallback)

// Initialize Llama model (requires WebGPU)
export async function initLlama(progressCallback)

// Fast scan using BERT + regex
export async function detectWithBert(text)

// Deep scan using Llama + regex
export async function detectWithLlama(text)

// Get model status
export function getModelStatus()
```

#### BERT Detection Flow
```
Input Text
    ↓
BERT Token Classification
    ↓
Merge Subword Tokens (##word → word)
    ↓
Filter by Confidence (>0.5)
    ↓
Add Regex Matches (emails, phones, SSN, etc.)
    ↓
Deduplicate & Return
```

#### Regex Patterns in AI Engine
- Emails: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/`
- Phones: `/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/`
- SSN: `/\d{3}[-\s]?\d{2}[-\s]?\d{4}/`
- Credit Cards: `/(?:\d{4}[-\s]?){3}\d{4}/`
- Dates: Multiple formats
- Addresses: Street patterns
- ZIP Codes, IP Addresses, URLs, Currency

---

### 4. Intel Database (`src/services/intel-database.js`)

Pattern-based detection with document type presets.

#### Available Presets

| Preset ID | Icon | Description |
|-----------|------|-------------|
| `bank-statement` | 🏦 | Account numbers, routing numbers, balances |
| `medical-record` | 🏥 | Patient IDs, diagnoses, medications |
| `legal-document` | ⚖️ | Case numbers, party names, addresses |
| `employment` | 👔 | Employee IDs, salaries, SSN |
| `identity` | 🪪 | Passports, driver licenses, personal info |
| `financial` | 💰 | Tax IDs, investment accounts |
| `insurance` | 🛡️ | Policy numbers, claim info |
| `custom` | ✏️ | User-defined keywords |

#### Preset Structure
```javascript
{
  name: 'Bank Statement',
  icon: '🏦',
  description: '...',
  patterns: [/regex/g, ...],      // Regex patterns to match
  keywords: ['account', ...],      // Keywords to look for
  contextClues: ['statement', ...] // Document type hints
}
```

#### Name Detection Patterns
```javascript
NAME_PATTERNS = {
  titled: /(?:Mr\.?|Mrs\.?|Dr\.?)\s+([A-Z][a-z]+...)/,
  labeled: /(?:name|patient|client):\s*([A-Z][a-z]+...)/,
  lastFirst: /([A-Z][a-z]+),\s+([A-Z][a-z]+)/,
  standalone: /([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15})/
}
```

#### Key Functions
```javascript
export function scanWithIntel(text, activePresets, customKeywords)
export function getPresets()
export function loadCustomKeywords()
export function saveCustomKeywords(keywords)
export function loadActivePresets()
export function saveActivePresets(presets)
```

---

### 5. PDF Processor (`src/services/pdf-processor.js`)

Handles PDF text extraction using PDF.js.

```javascript
export async function extractTextFromPDF(file)
```

- Uses `pdfjs-dist` library
- Extracts text from all pages
- Preserves basic formatting

---

### 6. Redaction Service (`src/services/redaction-service.js`)

API client for the Flask backend.

```javascript
export async function redactPDF(file, entities)
```

- Sends file + entity list to `/redact` endpoint
- Returns redacted PDF blob

---

### 7. Flask Backend (`server.py`)

Python server for actual PDF redaction using PyMuPDF.

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/redact` | Redact PDF with given entities |
| GET | `/health` | Health check |

#### Redaction Process
```python
1. Receive PDF file + entities list
2. Open PDF with PyMuPDF (fitz)
3. For each page:
   a. Search for each entity text
   b. Get text bounds (rectangles)
   c. Draw black rectangles over matches
4. Save and return redacted PDF
```

---

## 🎨 Styling (`src/style.css`)

~1800 lines of CSS with a professional dark theme.

### Key Style Sections

| Section | Description |
|---------|-------------|
| CSS Variables | Color scheme, spacing, animations |
| Base Layout | Grid layout, panels |
| Drop Zone | File upload area with animations |
| PDF Viewer | Canvas display, zoom controls, text layer |
| Intel Panel | Preset cards, checkboxes |
| Entity List | Tags with remove buttons |
| Toast Notifications | Success/error/info messages |
| Action Bar | Sticky bottom buttons |
| Selection Tooltip | Manual text selection popup |

### CSS Variables
```css
:root {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --accent: #22c55e;
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --border: #2d2d2d;
}
```

---

## 🔄 Data Flow

### 1. File Upload Flow
```
User drops PDF
      ↓
processFile(file)
      ↓
┌─────────────────────────────────┐
│ extractTextFromPDF(file)        │ → Text displayed in textarea
│ renderPDF(arrayBuffer)          │ → PDF displayed in viewer
└─────────────────────────────────┘
```

### 2. Scanning Flow
```
User clicks "Scan"
      ↓
runScan()
      ↓
┌─────────────────────────────────┐
│ scanWithIntel()                 │ → Pattern-based matches
│ detectWithBert() or             │
│ detectWithLlama()               │ → AI-based matches
└─────────────────────────────────┘
      ↓
Combine & deduplicate
      ↓
displayEntities()
```

### 3. Redaction Flow
```
User clicks "Redact"
      ↓
runRedaction()
      ↓
POST /redact (Flask)
      ↓
PyMuPDF processing
      ↓
Download redacted.pdf
```

---

## 🚀 Running the Application

### Development Mode
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Flask backend
python server.py
```

### URLs
- Frontend: `http://localhost:3001`
- Backend: `http://localhost:5000`

### Dependencies

**Node.js (package.json):**
- `vite` - Build tool
- `pdfjs-dist` - PDF rendering
- `jspdf` - PDF generation
- `@mlc-ai/web-llm` - Llama model (optional)

**Python (server.py):**
- `flask` - Web framework
- `flask-cors` - CORS support
- `pymupdf` (fitz) - PDF manipulation

---

## 🔐 Security Model

### Zero-Trust Principles
1. **No server upload for analysis** - All AI runs in browser
2. **Local model caching** - Models cached in IndexedDB
3. **Temporary files only** - Backend cleans up immediately
4. **No telemetry** - No data sent to external services

### Data Flow Security
```
┌─────────────────────────────────────────────┐
│              BROWSER (Client)                │
│  ┌─────────────────────────────────────┐    │
│  │  PDF File → AI Models → Entities    │    │
│  │  (Never leaves browser for analysis)│    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                     │
                     │ Only for redaction
                     ↓
┌─────────────────────────────────────────────┐
│              LOCAL SERVER                    │
│  (localhost:5000 - your machine only)       │
│  PDF + Entities → PyMuPDF → Redacted PDF    │
└─────────────────────────────────────────────┘
```

---

## 📝 Configuration

### Vite Config (`vite.config.js`)
```javascript
export default {
  server: { port: 3001 },
  build: {
    rollupOptions: {
      external: ['@huggingface/transformers']
    }
  }
}
```

### Model Configuration
- BERT loaded from CDN via Transformers.js
- Llama requires WebGPU support (Chrome 113+)
- Models cached in browser IndexedDB

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| BERT not loading | Check browser console, clear IndexedDB |
| Llama unavailable | Requires WebGPU (Chrome/Edge) |
| PDF not rendering | Ensure pdf.worker.min.mjs is in public/ |
| Redaction fails | Check Flask server is running |
| Selection not working | Hard refresh (Ctrl+Shift+R) |

---

## 📊 Performance Notes

- **BERT**: ~2-3 seconds for typical documents
- **Llama**: ~10-30 seconds (depends on GPU)
- **Intel Patterns**: <100ms
- **PDF Rendering**: Scales with page count/complexity

---

## 🔮 Future Improvements & Analysis

### 1. Performance & Scalability
- **Web Worker for AI**: Currently, AI inference runs on the main thread, which can freeze the UI during heavy processing. Moving BERT/Llama to a Web Worker would keep the interface responsive.
- **PDF Rendering Optimization**: For large documents (50+ pages), rendering all pages at once will crash the browser. Implement "virtual scrolling" to only render visible pages.
- **Batch Processing**: The current architecture handles one file at a time. Adding a queue system to process multiple PDFs in sequence would be a huge productivity booster.

### 2. Detection Accuracy
- **Custom Regex Builder**: The "Intel Database" is powerful but hardcoded. A UI to let users build and save their own regex patterns (e.g., "Project Codes: `PRJ-\d{4}`") would make it enterprise-ready.
- **Feedback Loop**: When a user manually selects text that AI missed, the system should learn from it (e.g., "You selected 'John Doe', I'll look for other capitalized words in that context").
- **Table Detection**: PDF tables are notoriously hard for NER models. Adding a specific heuristic to detect and redact columns in tables would be valuable for financial docs.

### 3. User Experience (UX)
- **Highlight on PDF**: Currently, detected entities are listed in the sidebar. It would be much better to **draw colored boxes directly on the PDF viewer** to show exactly where the matches are before redacting.
- **Undo/Redo**: Essential for manual selection. If you accidentally add a word, you should be able to Ctrl+Z.
- **Dark/Light Mode Toggle**: The app is currently dark-mode only. A toggle would improve accessibility.

### 4. Architecture & Code Quality
- **TypeScript Migration**: The project is growing complex (~1000 lines of JS). Migrating to TypeScript would prevent many "undefined" errors and make refactoring safer.
- **Component Framework**: `main.js` is doing too much DOM manipulation manually. Moving to React, Vue, or Svelte would make the state management much cleaner and less bug-prone.
- **Electron Packaging**: To truly fulfill the "Offline Privacy Suite" promise, packaging this as an installable `.exe` or `.dmg` (using Electron or Tauri) would remove the need for users to run terminal commands.

### 5. Security
- **Sanitization**: Ensure the filename and metadata of the redacted PDF are also scrubbed. Sometimes PII hides in the PDF metadata (Author, Title).
- **Memory Clearing**: Explicitly overwrite memory buffers for sensitive text after processing to prevent RAM scraping attacks.

---

*Last Updated: December 2024*
