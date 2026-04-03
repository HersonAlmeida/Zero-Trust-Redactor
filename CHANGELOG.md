# Zero-Trust Redactor — Changelog

---

## Session Update — 2026-04-03

### Overview

This session brought two major improvements to the project:

1. **Codebase synced to GitHub** — the local copy was an older simplified fork; it was fully replaced with the latest upstream version.
2. **Dual-Engine Architecture implemented** — Hardware auto-detection + a "Redaction Engine" dropdown that automatically protects weak hardware from heavy AI models.
3. **PDF Analyze endpoint** — New backend endpoint that extracts text with bounding box coordinates and runs YMYL pattern detection, ready for the frontend to draw highlight overlays.

---

## 1. Codebase Sync (Local → GitHub)

**Problem:** The local folder was behind the GitHub repository (`HersonAlmeida/Zero-Trust-Redactor`). Key files were missing or outdated.

**What changed:**

| Area | Before (local) | After (synced from GitHub) |
|---|---|---|
| `server.py` | Basic 120-line version | Full version with security headers, audit logging, GDPR compliance, `/download-models` endpoint |
| `src/main.js` | Older, smaller | Full 59 KB version with multipage PDF, model tier selection, keyboard shortcuts |
| `src/services/ai-engine.js` | Simple BERT/Llama | Full version with `detectHardware()`, model tiers, debug mode |
| `src/style.css` | Older | Full 52 KB version |
| `src/services/model-manager.js` | Missing | Added (new service from GitHub) |
| `requirements.txt` | Missing | Added with pinned versions |
| Docs | Partial | Added: `COMPLIANCE.md`, `DATA_SAFETY.md`, `TERMS_OF_SERVICE.md`, `LICENSE`, `ARCHITECTURE.md`, `PATTERN_DETECTION_GUIDE.md`, and more |
| Launchers | Missing | Added: `start.bat`, `start-prod.bat`, `server_prod.py` |

**Files downloaded:** 38 files, 0 failures.  
**Our new files preserved:** `scripts/check_hardware.py`

---

## 2. Dual-Engine Architecture

### Goal
Give every user the best possible experience automatically:
- **Weak hardware** (< 8 GB RAM or no dedicated GPU) → locked to Fast Mode, Deep AI hidden
- **Strong hardware** (≥ 8 GB RAM + NVIDIA/AMD/Apple Silicon GPU) → Deep AI option unlocked

### New Files

#### `scripts/check_hardware.py` *(new)*

Python hardware detection module. Called once at server startup.

**What it detects:**

| Check | Method |
|---|---|
| Total RAM | `psutil.virtual_memory()` → falls back to `wmic` (Windows) / `/proc/meminfo` (Linux) / `sysctl` (macOS) |
| GPU vendor | `wmic path win32_videocontroller` (Windows) / `nvidia-smi` + `lspci` (Linux) / `system_profiler` (macOS) |
| Dedicated GPU | `True` if vendor is NVIDIA, AMD, or Apple Silicon |

**Returns:**
```json
{
  "ram_gb": 32.0,
  "gpu": {
    "name": "NVIDIA GeForce RTX 5080",
    "vendor": "nvidia",
    "has_dedicated_gpu": true
  },
  "has_enough_ram": true,
  "deep_ai_available": true,
  "recommended_mode": "deep",
  "os": "Windows"
}
```

**Logic:**
- `deep_ai_available = (ram_gb >= 8) AND has_dedicated_gpu`
- `recommended_mode = "deep"` if deep_ai_available, else `"fast"`

---

### Modified Files

#### `server.py`

- Added imports: `sys`, `re`, `base64`
- **Hardware profile** loaded at startup from `scripts/check_hardware.py`, cached in `_HARDWARE_PROFILE`
- **New endpoint:** `GET /system/hardware` — returns cached hardware JSON to the frontend
- **Startup banner** updated to show detected RAM, GPU name, and active engine mode:
  ```
  ╔════════════════════════════════════════════╗
  ║  🔒 Zero-Trust Redactor - Backend Server   ║
  ║  Running at http://localhost:5000          ║
  ║  RAM: 32.0 GB   GPU: RTX 5080             ║
  ║  Engine: Deep AI + Fast                   ║
  ║  Status: Ready ✓                          ║
  ╚════════════════════════════════════════════╝
  ```

#### `src/services/ai-engine.js`

- **New export:** `checkHardwareCapabilities()` — calls `GET /api/system/hardware` (dev proxy) or `/system/hardware` (production). Falls back to a safe fast-only profile if the server is unreachable (5-second timeout).

#### `src/main.js`

- **New import:** `checkHardwareCapabilities` added to the ai-engine import line
- **New state variable:** `let hardwareProfile = null` — stores the server hardware response
- **`initialize()` updated:** Hardware check now runs at the very beginning of startup, before AI model loading. Loading screen shows "Detecting hardware..." first.
- **New function:** `applyHardwareProfile(hw)` — reads the hardware profile and:
  - Populates `#hw-badge` with RAM and GPU stats (green `✓` = meets requirement, amber `⚠` = does not)
  - If `deep_ai_available = false`: disables the Deep AI `<option>`, sets engine to Fast, shows `#hw-warning` with a specific message (RAM or GPU)
  - If `deep_ai_available = true`: sets the dropdown to the recommended mode
- **New function:** `window.setEngine(value)` — handles the engine dropdown `onchange`. Blocks Deep AI selection if hardware is insufficient (shows toast), otherwise updates `currentMode` and status bar.

#### `index.html`

The old **Processing Mode** card section (two clickable cards for Fast/Deep) was **replaced** with a compact **Redaction Engine** dropdown:

```html
<!-- REDACTION ENGINE SELECTOR -->
<div class="section-label">Redaction Engine</div>
<div class="engine-selector">
    <select id="engine-select" onchange="setEngine(this.value)">
        <option value="fast" selected>⚡ Fast Mode (BERT + Regex)</option>
        <option value="deep">🧠 Deep AI (Gemma 4 via Ollama)</option>
    </select>
    <div class="hw-warning hidden" id="hw-warning"></div>
    <div class="hw-badge" id="hw-badge">
        <div class="hw-stat">⏳ Detecting hardware…</div>
    </div>
</div>
```

On load, `applyHardwareProfile()` populates the badge and optionally disables the Deep AI option.

#### `src/style.css`

New CSS classes added:

| Class | Purpose |
|---|---|
| `.engine-selector` | Flex column container for the dropdown group |
| `#engine-select` | Styled `<select>` — dark theme, custom chevron arrow |
| `.hw-warning` | Amber warning box shown when Deep AI is unavailable |
| `.hw-badge` | Container for the RAM/GPU stat rows |
| `.hw-stat` | One row of hardware info (RAM or GPU) |
| `.hw-stat.ok` | Green color — requirement met |
| `.hw-stat.warn` | Amber color — requirement not met |

#### `requirements.txt`

Added `psutil>=5.9.0` for accurate RAM detection.

---

## 3. PDF Analyze Endpoint (`/analyze`)

### Purpose

Enable the frontend to display **colored highlight boxes** over detected PII directly on the PDF image — instead of just listing text strings.

### New additions to `server.py`

#### YMYL Regex Scanner (`_scan_text_for_ymyl`)

Scans extracted page text for 7 pattern categories, ordered by specificity to avoid double-matching:

| Priority | Entity Type | Example |
|---|---|---|
| 1 | Credit Card | `4111 1111 1111 1111` (Visa/MC/Amex/Discover) |
| 2 | SSN | `123-45-6789` |
| 3 | Email | `john.doe@example.com` |
| 4 | Phone | `+1 (555) 555-5555` |
| 5 | Currency | `$1,234.56` |
| 6 | Date | `04/03/2026`, `2026-04-03` |
| 7 | IP Address | `192.168.1.1` |

Uses a `covered` character-index set so higher-priority patterns claim their spans first — a credit card number won't also be flagged as a phone number.

#### Bounding Box Resolution (`_get_bboxes_for_hit`)

Uses `page.search_for(text, flags=fitz.TEXT_DEHYPHENATE)` to locate **exact pixel coordinates** of each matched string on the page. Returns `[x0, y0, x1, y1]` in PDF point units.

#### Page Renderer (`_page_to_base64`)

Renders each page to a PNG at configurable DPI (default 150) using PyMuPDF's `page.get_pixmap()`, then base64-encodes it as a `data:image/png;base64,...` URI ready for `<img src>`.

#### `POST /analyze` Endpoint

**Request** (`multipart/form-data`):

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | PDF file | required | The PDF to analyse |
| `page` | integer | all pages | 1-based page number filter |
| `dpi` | integer | 150 | Render resolution (72–300) |

**Response JSON:**
```json
{
  "pages": [
    {
      "page_number": 1,
      "width": 595.0,
      "height": 842.0,
      "image_b64": "data:image/png;base64,...",
      "entities": [
        {
          "entity_type": "Email",
          "text_found": "john@example.com",
          "bboxes": [[72.5, 134.2, 198.3, 147.8]]
        },
        {
          "entity_type": "Phone",
          "text_found": "555-867-5309",
          "bboxes": [[72.5, 160.0, 155.0, 173.0]]
        }
      ]
    }
  ],
  "total_entities": 2
}
```

The frontend can use `image_b64` as the page background and draw colored rectangles using `bboxes` coordinates (scaled to match the rendered image dimensions).

---

## API Endpoints — Full Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Server health check + compliance info |
| `GET` | `/system/hardware` | Hardware profile (RAM, GPU, deep_ai_available) |
| `POST` | `/analyze` | Extract text + bounding boxes + YMYL scan → JSON |
| `POST` | `/redact` | Permanently redact PDF, return redacted file |
| `POST` | `/download-models` | Download BERT model to local `public/models/` |
| `GET` | `/compliance` | GDPR/CCPA/HIPAA compliance info |

---

## How to Run

```bash
# 1. Install Python dependencies (one time)
pip install -r requirements.txt

# 2a. Windows one-click launcher
start.bat

# 2b. Or manually in two terminals
npm run dev        # Terminal 1 → Vite at http://localhost:3000
python server.py   # Terminal 2 → Flask at http://localhost:5000
```

**For Deep AI (Gemma 4) — additional step:**
```bash
# Install Ollama from https://ollama.com then run:
ollama run gemma3:4b
```
The app will automatically detect your hardware on startup. If you have ≥ 8 GB RAM and a dedicated GPU, the Deep AI option will be unlocked in the sidebar dropdown.

---

## Architecture Diagram (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (localhost:3000)                                        │
│                                                                  │
│  ┌──────────────┐   ┌─────────────────────────────────────┐    │
│  │  index.html  │   │  src/main.js                        │    │
│  │              │   │  ├─ initialize()                     │    │
│  │  Engine      │   │  │   ├─ checkHardwareCapabilities()  │    │
│  │  Dropdown    │   │  │   ├─ applyHardwareProfile()       │    │
│  │  + HW Badge  │   │  │   └─ initAllModels()              │    │
│  └──────────────┘   │  ├─ setEngine()  (new)               │    │
│                     │  ├─ runScan()                         │    │
│                     │  └─ runRedaction()                    │    │
│                     └─────────────────────────────────────┘    │
│                                                                  │
│  AI Engine (browser):  BERT NER (IndexedDB cache)               │
│  Deep AI (optional):   Gemma 4 via Ollama (localhost:11434)     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP (Vite proxy /api → :5000)
┌───────────────────────────▼──────────────────────────────────────┐
│  PYTHON BACKEND (localhost:5000)                                  │
│                                                                  │
│  server.py                                                       │
│  ├─ /health                                                      │
│  ├─ /system/hardware  ← scripts/check_hardware.py (psutil)      │
│  ├─ /analyze          ← PyMuPDF + YMYL regex + base64 render    │
│  ├─ /redact           ← PyMuPDF permanent black-box redaction   │
│  ├─ /download-models                                            │
│  └─ /compliance                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

*All processing is 100% local. No document data ever leaves the device.*
