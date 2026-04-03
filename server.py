import os
import sys
import re
import base64
import json
import fitz  # PyMuPDF
import requests as _requests   # for Ollama API calls
from flask import Flask, request, send_file, jsonify, after_this_request
from flask_cors import CORS
from datetime import datetime
import hashlib
from urllib.request import urlretrieve

# ---------------------------------------------------------------------------
# Hardware profile — detected once at startup, cached for all requests
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))
_HARDWARE_PROFILE = None

def _load_hardware_profile():
    global _HARDWARE_PROFILE
    if _HARDWARE_PROFILE is not None:
        return _HARDWARE_PROFILE
    try:
        from scripts.check_hardware import get_hardware_profile
        _HARDWARE_PROFILE = get_hardware_profile()
    except Exception as e:
        _HARDWARE_PROFILE = {
            "ram_gb": 0,
            "gpu": {"name": "Unknown", "vendor": "unknown", "has_dedicated_gpu": False},
            "has_enough_ram": False,
            "deep_ai_available": False,
            "recommended_mode": "fast",
            "os": "Unknown",
            "error": str(e),
        }
    return _HARDWARE_PROFILE

_load_hardware_profile()  # Run at startup so first request is instant

# Flask app configuration
# In production, static files are served from Vite's dist/ folder
# In development, Vite handles static files via proxy
app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000'])

# Security headers for compliance
@app.after_request
def add_security_headers(response):
    """Add security headers for compliance with privacy regulations"""
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    # XSS Protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Content Security Policy - allow fonts, CDN scripts, and data URIs
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com blob:; "
        "worker-src 'self' blob:;"
    )
    # Referrer Policy - don't leak document URLs
    response.headers['Referrer-Policy'] = 'no-referrer'
    # Permissions Policy - restrict browser features
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    # Cache control - don't cache sensitive documents
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response

# Ensure temp directories exist
TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp')
os.makedirs(TEMP_DIR, exist_ok=True)

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

# Audit logging for compliance (local only)
AUDIT_LOG = os.path.join(os.path.dirname(__file__), 'audit.log')

def log_audit(action, details=""):
    """Log actions for compliance audit trail (local file only)"""
    timestamp = datetime.utcnow().isoformat() + 'Z'
    log_entry = f"[{timestamp}] {action}: {details}\n"
    try:
        with open(AUDIT_LOG, 'a') as f:
            f.write(log_entry)
    except:
        pass  # Don't fail on audit log errors

def hash_file(file_path):
    """Create SHA256 hash of file for audit (no content stored)"""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()[:16]  # Short hash for audit

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for frontend to verify server is running"""
    return jsonify({
        "status": "ok", 
        "message": "Redaction server is running",
        "privacy": "All processing is local - no data leaves your device",
        "compliance": ["GDPR", "CCPA", "HIPAA-compatible"]
    })

@app.route('/system/hardware', methods=['GET'])
def hardware_info():
    """
    Returns the cached hardware profile so the frontend can decide
    which redaction engine options to expose to the user.
    deep_ai_available=true  → show Ollama/Llama 4 Deep AI option
    deep_ai_available=false → lock UI to Fast Mode only
    """
    return jsonify(_load_hardware_profile())


def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def download_file(url, dest_path):
    ensure_dir(os.path.dirname(dest_path))
    urlretrieve(url, dest_path)


@app.route('/download-models', methods=['POST'])
def download_models():
    """Download BERT model assets to public/models for first-time users."""
    data = request.get_json(silent=True) or {}
    model = data.get('model', 'bert')
    if model != 'bert':
        return jsonify({"error": "Only 'bert' model auto-download is supported."}), 400

    base_url = 'https://huggingface.co/Xenova/bert-base-NER/resolve/main/'
    model_dir = os.path.join(PUBLIC_DIR, 'models', 'bert')
    files = [
        'config.json',
        'tokenizer.json',
        'tokenizer_config.json',
        'vocab.txt',
        'onnx/model_quantized.onnx'
    ]

    try:
        for file_name in files:
            download_file(base_url + file_name, os.path.join(model_dir, file_name))

        # Write a simple manifest for runtime checks
        manifest_path = os.path.join(model_dir, 'manifest.json')
        manifest = {
            "id": "bert",
            "name": "BERT NER",
            "version": "1.0.0",
            "downloadedAt": datetime.utcnow().isoformat() + 'Z',
            "files": files
        }
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)

        return jsonify({"status": "ok", "model": model, "files": len(files)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/redact', methods=['POST'])
def redact_pdf():
    """
    Redact sensitive words from a PDF while preserving layout.
    Original file is NEVER modified - a new redacted copy is returned.
    
    PRIVACY COMPLIANCE:
    - File is processed in memory/temp only
    - Temp files are deleted immediately after use
    - Metadata is scrubbed from output
    - No data is logged or stored (only hashes for audit)
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    raw_words = request.form.get('words', '[]')
    # Words are JSON-encoded to preserve commas inside entity strings
    try:
        import json as _json
        sensitive_words = _json.loads(raw_words)
    except Exception:
        # Fallback: legacy comma-separated (no commas in values)
        sensitive_words = raw_words.split(',')
    
    # Filter empty words
    sensitive_words = [w.strip() for w in sensitive_words if w.strip()]
    
    if not sensitive_words:
        return jsonify({"error": "No words to redact"}), 400

    # Use unique temp file names to prevent conflicts
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    input_path = os.path.join(TEMP_DIR, f"input_{unique_id}.pdf")
    output_path = os.path.join(TEMP_DIR, f"redacted_{unique_id}.pdf")
    
    file.save(input_path)
    
    # Audit log (hash only, no content)
    file_hash = hash_file(input_path)
    log_audit("REDACTION_START", f"file_hash={file_hash}, entities={len(sensitive_words)}")

    try:
        doc = fitz.open(input_path)
        redact_color = (0, 0, 0)  # Black boxes
        redaction_count = 0

        for page in doc:
            # Build word sequence once per page — used by phrase matcher
            _, word_seq = _build_word_map(page)

            for word in sensitive_words:
                if not word or not word.strip():
                    continue

                word_normalized = ' '.join(word.split())
                tokens = word_normalized.split()

                if len(tokens) == 1:
                    # Single token: search_for is safe (can't return a wider-than-word bbox)
                    areas = page.search_for(word_normalized, flags=fitz.TEXT_PRESERVE_WHITESPACE | 2)
                    if not areas:
                        areas = page.search_for(word_normalized, flags=0)
                    for area in areas:
                        area.x1 += 4
                        page.add_redact_annot(area, fill=redact_color)
                        redaction_count += 1
                else:
                    # Multi-token: use tight word-sequence merge — never search_for
                    merged_boxes = _find_phrase_bboxes(tokens, word_seq)

                    # Fallback A: uppercase variant (all-caps in transaction rows)
                    if not merged_boxes:
                        merged_boxes = _find_phrase_bboxes([t.upper() for t in tokens], word_seq)

                    # Fallback B: per-word boxes (better than a full-line search_for bbox)
                    if not merged_boxes:
                        word_map_pg, _ = _build_word_map(page)
                        for token in tokens:
                            if token in word_map_pg:
                                for box in word_map_pg[token]:
                                    r = fitz.Rect(box)
                                    page.add_redact_annot(r, fill=redact_color)
                                    redaction_count += 1
                    else:
                        for box in merged_boxes:
                            r = fitz.Rect(box)
                            page.add_redact_annot(r, fill=redact_color)
                            redaction_count += 1

                # ── Name variant expansion ───────────────────────────────────
                # If this looks like a full personal name (2+ words each starting
                # uppercase), also search for initial+surname variant that appears
                # in transaction rows (e.g. "H CABRAL D'ALMEIDA").
                parts = word_normalized.split()
                if len(parts) >= 2 and all(p[0].isupper() for p in parts if p):
                    initial  = parts[0][0].upper()
                    rest     = ' '.join(p.upper() for p in parts[1:])
                    variant  = f"{initial} {rest}"
                    if variant.upper() != word_normalized.upper():
                        var_tokens = variant.split()
                        var_boxes  = _find_phrase_bboxes(var_tokens, word_seq)
                        if not var_boxes:
                            var_boxes = _find_phrase_bboxes(
                                [t.upper() for t in var_tokens], word_seq)
                        for box in var_boxes:
                            r = fitz.Rect(box)
                            page.add_redact_annot(r, fill=redact_color)
                            redaction_count += 1

            # Apply all redactions on this page (makes them permanent)
            page.apply_redactions()

        # Set metadata BEFORE final save (avoids incremental-save text recovery risk)
        doc.set_metadata({
            "producer": "Zero-Trust Redactor",
            "creator":  "Zero-Trust Redactor",
            "title":    "Redacted Document",
            "author":   "Anonymous",
            "subject":  "Redacted Content",
            "keywords": "redacted, secure, privacy",
        })

        # Save to new file — garbage=4 aggressively removes all unreferenced objects
        # (including original pre-redaction content streams), deflate compresses,
        # clean removes unused PDF objects. Do NOT use saveIncr() after this — that
        # would append a revision that could expose the original text via forensic tools.
        doc.save(output_path, garbage=4, deflate=True, clean=True)
        doc.close()
        
        # Log success
        log_audit("REDACTION_COMPLETE", f"file_hash={file_hash}, redactions={redaction_count}")
        
        # Clean up input file IMMEDIATELY
        if os.path.exists(input_path):
            os.remove(input_path)

        # Send the redacted file
        response = send_file(
            output_path, 
            as_attachment=True, 
            download_name="redacted_secure.pdf",
            mimetype='application/pdf'
        )
        
        # Schedule cleanup of output file after sending
        @response.call_on_close
        def cleanup():
            try:
                if os.path.exists(output_path):
                    os.remove(output_path)
            except:
                pass
        
        return response
        
    except Exception as e:
        # Log error (no sensitive data)
        log_audit("REDACTION_ERROR", f"file_hash={file_hash if 'file_hash' in dir() else 'unknown'}")
        
        # Clean up ALL temp files on error
        for path in [input_path, output_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        return jsonify({"error": f"Error processing PDF: {str(e)}"}), 500

@app.route('/compliance', methods=['GET'])
def compliance_info():
    """Return compliance information for the application"""
    return jsonify({
        "application": "Zero-Trust Redactor",
        "version": "1.0.0",
        "compliance": {
            "GDPR": {
                "status": "compliant",
                "reason": "No personal data collected or processed externally"
            },
            "CCPA": {
                "status": "compliant", 
                "reason": "No data sale or sharing"
            },
            "HIPAA": {
                "status": "compatible",
                "reason": "PHI never leaves device, suitable for healthcare"
            }
        },
        "data_handling": {
            "collection": "none",
            "storage": "temporary only (deleted after processing)",
            "transmission": "localhost only",
            "retention": "0 seconds"
        },
        "security": {
            "encryption": "browser TLS for localhost",
            "isolation": "local processing only",
            "audit": "local audit log available"
        }
    })


# ============================================================================
#  YMYL FAST-MODE REGEX SCANNER
# ============================================================================

# Patterns ordered by specificity (most specific first)
_YMYL_PATTERNS = [
    # Credit card: 16 digits in groups of 4, optionally separated by space/dash
    ("Credit Card",   re.compile(
        r"\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6011)"
        r"[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b"
    )),
    # IBAN: e.g. GB29NWBK60161331926819
    ("IBAN",          re.compile(
        r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16})\b"
    )),
    # SSN: 3-2-4 (US)
    ("SSN",           re.compile(r"\b\d{3}[\-\s]\d{2}[\-\s]\d{4}\b")),
    # UK Sort code: 12-34-56
    ("Sort Code",     re.compile(r"\b\d{2}[\-\s]\d{2}[\-\s]\d{2}\b")),
    # UK Bank account number: standalone 8-digit number
    ("Account Number", re.compile(r"\b\d{8}\b")),
    # Email
    ("Email",         re.compile(
        r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
    )),
    # Phone: handles +1 (555) 555-5555, 555-555-5555, +44 formats, etc.
    ("Phone",         re.compile(
        r"\b(?:\+?(?:1|44)[\s\-.]?)?"
        r"(?:\(\d{3,4}\)|\d{3,4})[\s\-.]?\d{3,4}[\s\-.]?\d{4}\b"
    )),
    # UK Postcode: WC2H 9JQ, SW1A 1AA, etc.
    ("Postcode",      re.compile(
        r"\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b"
    )),
    # Currency: $ or £  e.g. $1,234.56 or £2,850.96
    ("Currency",      re.compile(r"[$£]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b")),
    # Dates: MM/DD/YYYY, YYYY-MM-DD, or "1 Feb 2026" style
    ("Date",          re.compile(
        r"\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}"
        r"|\d{4}[\/\-]\d{2}[\/\-]\d{2}"
        r"|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b",
        re.IGNORECASE
    )),
    # IP address
    ("IP Address",    re.compile(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    )),
]


def _scan_text_for_ymyl(text: str) -> list[dict]:
    """
    Run YMYL regex patterns against `text`.
    Returns a list of dicts: {entity_type, text_found, start, end}
    sorted by position so duplicates (e.g. phone inside CC) can be resolved.
    """
    hits = []
    covered = set()   # character indices already claimed by a higher-priority hit

    for entity_type, pattern in _YMYL_PATTERNS:
        for m in pattern.finditer(text):
            span = set(range(m.start(), m.end()))
            if span & covered:          # already claimed by higher-priority pattern
                continue
            covered |= span
            hits.append({
                "entity_type": entity_type,
                "text_found":  m.group(0).strip(),
                "start":       m.start(),
                "end":         m.end(),
            })

    return sorted(hits, key=lambda h: h["start"])


def _bbox_from_rect(r: fitz.Rect, phrase: str) -> list[float]:
    """
    Convert a PyMuPDF Rect to a [x0, y0, x1, y1] list.

    PyMuPDF's kerning/rounding occasionally clips the last character's right
    edge — most visibly on dates like "02 Feb 26" where the trailing '6' is
    cut off. Apply +4 px to x1 unconditionally so the redaction box always
    fully envelops the last glyph regardless of character type.
    """
    x0, y0, x1, y1 = round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)
    x1 = round(x1 + 4, 2)
    return [x0, y0, x1, y1]


def _get_bboxes_for_hit(page: fitz.Page, text: str) -> list[list[float]]:
    """
    Use PyMuPDF's built-in search to locate all occurrences of `text`
    on `page`.  Returns a list of [x0, y0, x1, y1] rectangles.
    """
    rects = page.search_for(text, flags=fitz.TEXT_DEHYPHENATE)
    return [_bbox_from_rect(r, text) for r in rects]


def _page_to_base64(page: fitz.Page, dpi: int = 150) -> str:
    """Render `page` to a PNG and return it as a base64-encoded data URI."""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    png_bytes = pix.tobytes("png")
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode()


# ============================================================================
#  /analyze  ENDPOINT
# ============================================================================

@app.route('/analyze', methods=['POST'])
def analyze_pdf():
    """
    Accept a PDF upload, extract text with bounding boxes from every page,
    run YMYL fast-mode regex detection, and return structured results.

    Request (multipart/form-data):
        file      – PDF file
        page      – optional, 1-based page number to analyse (default: all pages)
        dpi       – optional render DPI for the base64 page image (default: 150)

    Response JSON:
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
                        "bboxes": [[x0, y0, x1, y1], ...]   // one per occurrence on page
                    },
                    ...
                ]
            }
        ],
        "total_entities": 7
    }
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file      = request.files['file']
    target_pg = request.form.get('page', None)   # optional 1-based page filter
    dpi       = int(request.form.get('dpi', 150))
    dpi       = max(72, min(dpi, 300))           # clamp to sane range

    import uuid
    uid        = str(uuid.uuid4())[:8]
    input_path = os.path.join(TEMP_DIR, f"analyze_{uid}.pdf")
    file.save(input_path)

    try:
        doc    = fitz.open(input_path)
        pages_out = []
        total_entities = 0

        page_range = range(doc.page_count)
        if target_pg is not None:
            pg_idx = int(target_pg) - 1          # convert to 0-based
            pg_idx = max(0, min(pg_idx, doc.page_count - 1))
            page_range = range(pg_idx, pg_idx + 1)

        for pg_idx in page_range:
            page   = doc[pg_idx]
            rect   = page.rect
            text   = page.get_text("text")        # plain text for regex

            # Run YMYL regex scanner
            raw_hits = _scan_text_for_ymyl(text)

            # Resolve bounding boxes via PyMuPDF search
            entities = []
            seen_texts = set()
            for hit in raw_hits:
                key = (hit["entity_type"], hit["text_found"])
                if key in seen_texts:
                    continue                      # deduplicate same value on page
                seen_texts.add(key)

                bboxes = _get_bboxes_for_hit(page, hit["text_found"])
                if not bboxes:
                    # Fallback: try searching word-by-word for multi-token matches
                    for word in hit["text_found"].split():
                        wb = _get_bboxes_for_hit(page, word)
                        bboxes.extend(wb)

                entities.append({
                    "entity_type": hit["entity_type"],
                    "text_found":  hit["text_found"],
                    "bboxes":      bboxes,
                })
                total_entities += 1

            # Render page to base64 image
            image_b64 = _page_to_base64(page, dpi=dpi)

            pages_out.append({
                "page_number": pg_idx + 1,
                "width":       round(rect.width,  2),
                "height":      round(rect.height, 2),
                "image_b64":   image_b64,
                "entities":    entities,
            })

        doc.close()
        return jsonify({
            "pages":          pages_out,
            "total_entities": total_entities,
        })

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500

    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except Exception:
                pass


# ============================================================================
#  TWO-PASS DEEP AI ENDPOINT  (/analyze/deep)
#  Pass 0 → Gemma 4 classifies the document type
#  Pass 1 → PyMuPDF builds a word→bbox map
#  Pass 2 → Gemma 4 runs expert extraction with a type-specific prompt
#  Pass 3 → Matchmaker: look up Gemma hits in the word map → exact coords
# ============================================================================

OLLAMA_BASE  = "http://localhost:11434"
OLLAMA_MODEL = "gemma4"   # Gemma 4 via Ollama

# ---------------------------------------------------------------------------
# Step 0: Document classification prompt
# ---------------------------------------------------------------------------
_CLASSIFY_PROMPT = """You are a document classifier. Read the document text below and
identify its type. Reply with ONLY one of these exact category strings — nothing else:

bank_statement
invoice
medical_record
legal_contract
insurance_document
tax_document
payslip
identity_document
hr_document
general

Document text:
{text}"""

# ---------------------------------------------------------------------------
# Step 2: Expert extraction prompts — one per document type
# ---------------------------------------------------------------------------
_EXPERT_PROMPTS = {

"bank_statement": """You are a senior financial compliance officer specialising in GDPR data protection for banking documents.

Your task: Extract personally identifiable information (PII) from the bank statement below.
Focus ONLY on information that identifies a specific natural person or their account.

What to extract (exact strings as they appear):
- Account holder's full name (personal name only — NOT the bank's name)
- Business / trading name of the account holder
- Account holder's home or registered address, postcode
- Account number, sort code
- IBAN, BIC, SWIFT codes belonging to the account holder
- Card numbers (full or masked like **** **** **** 7638)
- PERSONAL names of transaction counterparts ONLY — human names appearing in the Description column (e.g. "JOSUE FERNADES", "H CABRAL D'ALMEIDA", "Benedict Panzo"). Do NOT extract commercial merchant names.
- Reference numbers that identify a person or their account
- Email addresses, phone numbers of the account holder (NOT the bank's customer service number)
- National Insurance numbers, tax reference numbers

What NOT to extract:
- Column headers (Date, Description, Type, In, Out, Balance)
- Generic labels (Account number:, Sort code:, Balance:)
- The bank's own name/brand or the bank's registered address/boilerplate legal text
- Transaction amounts, running balances, totals (£ figures) — these are financial data not PII
- Dates used as column values (unless they identify a specific personal event like Date of Birth)
- Generic section headings (Bank statement, Transactions, Page 1 of 1)
- Currency symbols alone (£, $)
- Transaction type codes (TFR, PAY, DD, SO) or their legend descriptions
- Commercial merchant and service names (PayPal, TFL, Amazon, Google, Apple, Netflix, Spotify, Audible, Revolut, eBay, Samsung Finance, ID Mobile, utility companies, supermarkets, transport services, telecom operators)
- The bank's own contact phone number or customer service details (e.g. "0345 720 5040")

Return ONLY a valid JSON array of the exact strings found. Example:
["John Smith", "28734670", "04-06-05", "WC2H 9JQ", "JOSUE FERNADES"]""",

"invoice": """You are an accounts payable compliance specialist with expertise in
GDPR and financial data protection for invoice documents.

Your task: Extract every piece of PII and sensitive financial data from the invoice below.

What to extract:
- Supplier and buyer full names, company names
- All addresses and postcodes
- Invoice number, PO number, reference numbers
- VAT registration numbers, company registration numbers
- Bank account details (account number, sort code, IBAN)
- Individual line item amounts, totals, VAT amounts
- Due dates, invoice dates, payment dates
- Email addresses, phone numbers, website URLs (if personal)
- Signatory names

What NOT to extract:
- Generic labels (Invoice No:, VAT:, Total:)
- Column headers
- Generic business words (Invoice, Receipt, Tax)

Return ONLY a valid JSON array of exact strings found.""",

"medical_record": """You are a HIPAA and GDPR compliance officer specialising in
healthcare data protection and medical records.

Your task: Extract every piece of protected health information (PHI) and PII
from the medical document below. Be extremely thorough — in healthcare, missing
even one identifier is a compliance violation.

What to extract:
- Patient full name, date of birth, age
- NHS number, hospital number, patient ID
- Home address, postcode, email, phone
- GP name, consultant name, referring doctor
- Dates of appointments, admissions, procedures
- Diagnoses, conditions, medications (drug names + dosages)
- Test results, blood type, allergies
- Insurance policy numbers
- Next of kin names and contact details
- Any unique identifying codes

What NOT to extract:
- Generic medical terminology (blood pressure, temperature)
- Column headers
- Department names without personal context

Return ONLY a valid JSON array of exact strings found.""",

"legal_contract": """You are a legal data protection counsel specialising in contract
confidentiality and GDPR compliance.

Your task: Extract all PII, confidential identifiers, and sensitive personal data
from the legal document below.

What to extract:
- Full legal names of all parties (individuals and entities)
- Registered addresses, office addresses, personal addresses
- Company registration numbers, VAT numbers
- Signatory names and titles
- Dates of execution, effective dates, expiry dates
- Financial figures, payment amounts, penalties
- Account details if present
- Solicitor / lawyer names and firm details
- Case numbers, reference numbers, deed numbers
- Email addresses, phone numbers

What NOT to extract:
- Boilerplate legal clauses
- Generic legal terms (WHEREAS, THEREFORE, hereinafter)
- Section headers

Return ONLY a valid JSON array of exact strings found.""",

"payslip": """You are a payroll compliance specialist with deep knowledge of
GDPR and employment data protection regulations.

Your task: Extract all personal and sensitive payroll data from the payslip below.

What to extract:
- Employee full name
- Employee number / payroll number
- National Insurance number (NI number)
- Tax code
- Home address, postcode
- Employer name, PAYE reference
- Bank account number, sort code
- All pay figures (gross, net, deductions, tax, NI contributions)
- Pay period dates
- Pension scheme reference
- Any unique identifiers

What NOT to extract:
- Generic payslip labels (Gross Pay, Net Pay, Tax Code:)
- Column headers
- Generic words (Payslip, Salary)

Return ONLY a valid JSON array of exact strings found.""",

"tax_document": """You are a tax compliance specialist with expertise in GDPR
and financial data protection for tax records.

What to extract:
- Taxpayer full name, business name
- Tax reference number (UTR), National Insurance number
- VAT registration number
- Home/business address, postcode
- Tax year dates, submission dates, deadlines
- Income figures, tax paid, tax owed, refund amounts
- Employer PAYE reference
- Agent/accountant name and reference
- Bank details if present

What NOT to extract:
- Generic tax terminology
- Column/section headers

Return ONLY a valid JSON array of exact strings found.""",

"insurance_document": """You are an insurance data protection officer with
expertise in GDPR compliance for insurance documentation.

What to extract:
- Policyholder full name, date of birth
- Address, postcode, email, phone
- Policy number, claim number
- Vehicle registration (for motor insurance)
- Property address (for home insurance)
- Premium amounts, excess amounts, claim values
- Cover dates, renewal dates, expiry dates
- Named drivers / named persons on policy
- Broker/agent name and reference
- Bank details for premium/claim payments

What NOT to extract:
- Generic insurance terms
- Product names (Comprehensive Cover, Buildings Insurance)
- Column headers

Return ONLY a valid JSON array of exact strings found.""",

"identity_document": """You are a KYC (Know Your Customer) compliance specialist
with expertise in identity document data protection.

What to extract — EVERYTHING is sensitive on an ID document:
- Full legal name
- Date of birth
- Place of birth, nationality
- Passport number, driving licence number, national ID number
- Expiry date, issue date
- Machine readable zone (MRZ) data
- Address if present
- Photo description is NOT extractable — skip visual elements

Return ONLY a valid JSON array of exact strings found.""",

"hr_document": """You are an HR data protection specialist with deep knowledge
of employment law and GDPR for personnel records.

What to extract:
- Employee full name, date of birth
- Home address, postcode, email, phone
- National Insurance number, employee ID
- Job title, department, manager name
- Salary, bonus, benefits figures
- Employment start date, contract dates
- Bank account details
- Emergency contact names and numbers
- Performance scores, disciplinary references
- Any unique HR identifiers

What NOT to extract:
- Company policies / generic HR text
- Column headers
- Generic role descriptions without personal context

Return ONLY a valid JSON array of exact strings found.""",

"general": """You are a world-class data protection officer with expertise in
GDPR, CCPA, HIPAA and all major privacy regulations globally.

Your task: Carefully read the document and extract every piece of personally
identifiable information (PII) or sensitive data — regardless of document type.

What to extract:
- Full names (people and organisations)
- Any address, postcode, city (when associated with a person/company)
- Email addresses, phone numbers, fax numbers
- Account numbers, reference numbers, ID numbers
- Financial figures tied to a person or account
- Dates tied to a person (DOB, appointment dates, employment dates)
- National identifiers (NI, SSN, passport, driving licence)
- IP addresses, device IDs (if in context)
- Any unique identifier that could identify a person

What NOT to extract:
- Generic labels and headers
- Common words and filler text
- Dates that are not tied to a person (e.g. document version dates)

Return ONLY a valid JSON array of exact strings found.""",
}


def _classify_document(text: str, model: str = OLLAMA_MODEL, timeout: int = 30) -> str:
    """
    Pass 0: Ask Gemma 4 to classify the document type.
    Returns one of the keys in _EXPERT_PROMPTS. Defaults to 'general' on error.
    """
    prompt = _CLASSIFY_PROMPT.format(text=text[:3000])
    try:
        resp = _requests.post(
            f"{OLLAMA_BASE}/api/generate",
            json={
                "model":  model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 20},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip().lower()
        # Match the response to a known category
        for category in _EXPERT_PROMPTS:
            if category in raw:
                return category
        return "general"
    except Exception:
        return "general"


def _build_word_map(page: fitz.Page) -> tuple[dict, list]:
    """
    Pass 1: Extract every word and its bounding box from the page.

    Returns:
        word_map  – { word_text: [[x0,y0,x1,y1], ...] }
                    Fast lookup for single-token exact matches.
        word_seq  – [ (x0, y0, x1, y1, text), ... ] sorted in reading order
                    (top-to-bottom, left-to-right).  Used by the phrase
                    sequence matcher in _match_to_bboxes so we never call
                    page.search_for() on multi-word strings.

    x1 is expanded by +4 px on every word to compensate for PyMuPDF's
    kerning rounding that visually clips the last glyph.
    """
    word_map: dict[str, list[list[float]]] = {}
    word_seq: list[tuple] = []

    for wb in page.get_text("words"):
        x0, y0, x1, y1, word = wb[0], wb[1], wb[2], wb[3], wb[4]
        word = word.strip()
        if not word:
            continue
        x1_padded = round(x1 + 4, 2)
        box = [round(x0, 2), round(y0, 2), x1_padded, round(y1, 2)]
        word_map.setdefault(word, []).append(box)
        word_seq.append((round(x0, 2), round(y0, 2), x1_padded, round(y1, 2), word))

    # Sort into reading order: quantise y to the nearest 4 px so words on the
    # same visual line share the same sort key, then sort left-to-right within.
    word_seq.sort(key=lambda w: (round(w[1] / 4) * 4, w[0]))
    return word_map, word_seq


def _tokens_match(pdf_word: str, query_token: str) -> bool:
    """
    Case-insensitive token comparison that tolerates minor punctuation
    differences (trailing comma/period, apostrophe variants).
    """
    a = pdf_word.strip(".,;:\"' ").lower()
    b = query_token.strip(".,;:\"' ").lower()
    return a == b or a.replace("'", "'") == b.replace("'", "'")


def _find_phrase_bboxes(tokens: list[str], word_seq: list[tuple]) -> list[list[float]]:
    """
    Slide through the word sequence looking for `tokens` in order on the
    SAME LINE (y0 within LINE_TOLERANCE px of the first matched word).

    When a complete match is found, merge all matched words into a single
    tight bounding box: min(x0), min(y0), max(x1), max(y1).

    Returns a list of merged bboxes (one per occurrence on the page).
    Never calls page.search_for() — so it can never return a full-line bbox.
    """
    LINE_TOLERANCE = 6   # px — words on the same visual line share ≈ same y0
    MAX_GAP        = 3   # at most 3 non-matching words allowed between tokens
                         # (handles PDF word-splits like "D'" + "ALMEIDA")

    n       = len(tokens)
    total   = len(word_seq)
    bboxes  = []

    for i in range(total):
        if not _tokens_match(word_seq[i][4], tokens[0]):
            continue

        base_y   = word_seq[i][1]
        matched  = [word_seq[i]]
        tok_idx  = 1
        j        = i + 1
        gap_used = 0

        while tok_idx < n and j < total:
            w = word_seq[j]
            # Must stay on same line
            if abs(w[1] - base_y) > LINE_TOLERANCE:
                break
            if _tokens_match(w[4], tokens[tok_idx]):
                matched.append(w)
                tok_idx  += 1
                gap_used  = 0
            else:
                gap_used += 1
                if gap_used > MAX_GAP:
                    break
            j += 1

        if tok_idx == n:   # all tokens found in order on the same line
            bboxes.append([
                min(w[0] for w in matched),
                min(w[1] for w in matched),
                max(w[2] for w in matched),
                max(w[3] for w in matched),
            ])

    return bboxes


# Labels/headers that Gemma should never return but sometimes does — strip them
_LABEL_BLACKLIST = {
    # Bank statement labels
    "trading name", "business owner", "address", "account number", "sort code",
    "statement for", "balance", "total paid in", "total paid out", "transactions",
    "date", "transaction type", "details", "paid in", "paid out", "fee",
    "page", "page 1 of 1", "bank statement", "card transaction",
    # Transaction type legend words (Page 2 footer noise)
    "payment", "transfer", "direct debit", "standing order", "faster payment",
    "pay", "tfr", "dd", "so", "bacs", "chaps", "fpay",
    "transaction types", "transaction type key", "type key",
    # Invoice labels
    "invoice number", "invoice date", "due date", "description", "quantity",
    "unit price", "amount", "subtotal", "vat", "total", "reference",
    # Medical/HR labels
    "name", "dob", "nhs number", "patient", "diagnosis", "medication",
    "employer", "employee", "tax code", "gross pay", "net pay", "deductions",
    # Insurance
    "policy number", "cover", "premium", "excess",
    # Generic document structure
    "registered in", "registered office", "authorised by", "regulated by",
    "prudential regulation authority", "financial conduct authority",
    "bank account legal", "legal",
}

def _filter_gemma_output(items: list[str]) -> list[str]:
    """
    Remove obvious false positives from Gemma's output:
    - Pure labels/headers (blacklisted)
    - Single characters or very short tokens
    - Items that are only punctuation/symbols
    - Items that end with ':' (they are labels)
    - Very long boilerplate sentences (bank legal footer > 120 chars)
    - Deduplicate while preserving order
    """
    seen = set()
    cleaned = []
    for item in items:
        s = item.strip().rstrip(":")
        if not s or len(s) < 3:
            continue
        if s.lower() in _LABEL_BLACKLIST:
            continue
        if s.endswith(":"):   # "Trading Name:" etc.
            continue
        if all(c in "£$€.,- ()" for c in s):  # pure symbols
            continue
        # Strip long boilerplate sentences (registered address legal text etc.)
        if len(s) > 120 and any(w in s.lower() for w in
                ("registered", "authorised", "regulated", "prudential", "conduct authority")):
            continue
        key = s.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(s)
    return cleaned


# ---------------------------------------------------------------------------
# Vision-first extraction: send rendered page image to Gemma 4
# ---------------------------------------------------------------------------
_VISION_PROMPT_TEMPLATE = """You are a certified data protection officer performing a GDPR/CCPA compliance audit.

You are looking at a {doc_type_label} document.

Your task: Identify every piece of sensitive personal data (PII) visible in this image.
Return ONLY the exact text strings of the VALUES — NOT labels, NOT column headers.

Examples:
- "Account number: 28734670" → return "28734670" NOT "Account number"
- "Name: John Smith" → return "John Smith" NOT "Name"
- "Address: 71-75 Shelton Street, London, WC2H 9JQ" → return "71-75 Shelton Street", "London", "WC2H 9JQ"

What to include:
- Personal names (account holder and PERSONAL counterparts in transactions — human names only, NOT merchant/business names)
- Account numbers, sort codes, IBANs, card numbers (including masked like **** **** **** 7638)
- Full addresses, postcodes belonging to a person
- Email addresses, phone numbers belonging to the account holder (NOT bank customer service numbers)
- Any unique reference number that identifies a person or their account

What to EXCLUDE:
- Labels and field names (Account number:, Sort code:, Date:, Balance:, etc.)
- Column headers (Date, Description, Type, Amount, Balance, Paid in, Paid out)
- Transaction amounts, running balances, totals (£ figures) — NOT PII
- Dates used as column values or transaction dates — NOT PII
- The bank or institution's own name/brand (e.g. "Halifax", "Tide", "HSBC")
- The bank's registered address, legal boilerplate, regulatory text
- Transaction type codes or their legend descriptions (PAY, TFR, DD, "Payment", "Transfer")
- Generic section titles (Bank statement, Transactions, Page 1 of 1)
- Currency symbols alone (£, $)
- Commercial merchant and service names (PayPal, TFL, Amazon, Google, Apple, Netflix, Spotify, Audible, Revolut, eBay, Samsung Finance, ID Mobile, utility companies, supermarkets, transport services, telecom operators)
- The bank's own customer service phone number

Return ONLY a valid JSON array of exact strings. No explanation. Example:
["Trilateral Stability Ltd", "28734670", "04-06-05", "WC2H 9JQ", "JOSUE FERNADES", "**** **** **** 7638"]"""

_DOC_TYPE_LABELS = {
    "bank_statement":     "bank statement",
    "invoice":            "invoice",
    "medical_record":     "medical record",
    "legal_contract":     "legal contract",
    "payslip":            "payslip / pay stub",
    "tax_document":       "tax document",
    "insurance_document": "insurance document",
    "identity_document":  "identity document",
    "hr_document":        "HR / employment document",
    "general":            "business document",
}


def _call_ollama_vision(
    page_image_b64: str,
    doc_type: str = "general",
    model: str = OLLAMA_MODEL,
    timeout: int = 120,
) -> list[str]:
    """
    Vision mode: Send the rendered page image to Gemma 4 and ask it to identify
    PII by seeing the actual document layout. Far more accurate than plain text
    because Gemma can distinguish labels from values visually.

    page_image_b64: the data URI string (data:image/png;base64,...)
    Returns list of sensitive strings.
    """
    doc_label = _DOC_TYPE_LABELS.get(doc_type, "document")
    prompt    = _VISION_PROMPT_TEMPLATE.format(doc_type_label=doc_label)

    # Ollama images field expects raw base64 without the data URI prefix
    raw_b64 = page_image_b64.split(",", 1)[-1] if "," in page_image_b64 else page_image_b64

    try:
        resp = _requests.post(
            f"{OLLAMA_BASE}/api/generate",
            json={
                "model":   model,
                "prompt":  prompt,
                "images":  [raw_b64],
                "stream":  False,
                "options": {
                    "temperature": 0.0,
                    "num_predict": 1024,
                },
                "format": "json",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip()

        if raw.startswith("["):
            parsed = json.loads(raw)
        else:
            m = re.search(r'\[.*?\]', raw, re.DOTALL)
            parsed = json.loads(m.group(0)) if m else []

        result = [str(s).strip() for s in parsed if str(s).strip()]
        return _filter_gemma_output(result)

    except Exception:
        return []


def _call_ollama(text: str, doc_type: str = "general", model: str = OLLAMA_MODEL, timeout: int = 90) -> list[str]:
    """
    Text fallback: Send plain document text with the expert type-specific prompt.
    Used when vision mode fails or model doesn't support images.
    """
    expert_prompt = _EXPERT_PROMPTS.get(doc_type, _EXPERT_PROMPTS["general"])
    full_prompt   = f"{expert_prompt}\n\nDocument text:\n{text[:8000]}"

    try:
        resp = _requests.post(
            f"{OLLAMA_BASE}/api/generate",
            json={
                "model":  model,
                "prompt": full_prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 1024},
                "format": "json",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "").strip()

        if raw.startswith("["):
            parsed = json.loads(raw)
        else:
            m = re.search(r'\[.*?\]', raw, re.DOTALL)
            parsed = json.loads(m.group(0)) if m else []

        result = [str(s).strip() for s in parsed if str(s).strip()]
        return _filter_gemma_output(result)

    except Exception:
        return []


def _match_to_bboxes(
    sensitive_strings: list[str],
    word_map: dict[str, list[list[float]]],
    page: fitz.Page,
    word_seq: list | None = None,
) -> list[dict]:
    """
    Pass 3 — Matchmaker (word-sequence merge, zero search_for).

    Strategy
    --------
    1. Split every Gemma-returned phrase into individual tokens.
    2. For single tokens: fast exact lookup in word_map (case-sensitive first,
       then case-insensitive fallback).
    3. For multi-token phrases: use _find_phrase_bboxes() which slides through
       the sorted word sequence finding consecutive tokens on the same line and
       merges their individual bboxes into one tight rectangle.

    This completely eliminates the page-wide horizontal red bars caused by
    page.search_for() returning the bbox of an entire text line when it cannot
    find an exact internal match for a multi-word phrase.
    """
    if word_seq is None:
        word_seq = []

    entities = []
    seen = set()

    for phrase in sensitive_strings:
        phrase = phrase.strip()
        if not phrase or phrase.lower() in seen:
            continue
        seen.add(phrase.lower())

        tokens = phrase.split()
        bboxes: list[list[float]] = []

        if len(tokens) == 1:
            # ── Single token: exact word_map lookup ──────────────────────────
            token = tokens[0]
            if token in word_map:
                bboxes = list(word_map[token])
            else:
                # Case-insensitive fallback
                tl = token.lower()
                for k, v in word_map.items():
                    if k.lower() == tl:
                        bboxes = list(v)
                        break

            # Last resort: search_for is acceptable for single words (it won't
            # return a wider-than-word bbox for a single token).
            if not bboxes:
                rects = page.search_for(token, flags=fitz.TEXT_DEHYPHENATE)
                bboxes = [_bbox_from_rect(r, token) for r in rects]

        else:
            # ── Multi-token phrase: word-sequence merge ──────────────────────
            # Primary: slide through word_seq matching tokens in order on same line
            bboxes = _find_phrase_bboxes(tokens, word_seq)

            # Fallback A: try case-folded version of each token
            if not bboxes:
                folded = [t.upper() for t in tokens]
                bboxes = _find_phrase_bboxes(folded, word_seq)

            # Fallback B: if the phrase still doesn't match (e.g. it spans PDF
            # blocks or has unusual encoding), cover each token individually.
            # This gives us a set of small per-word boxes instead of a line-wide box.
            if not bboxes:
                for token in tokens:
                    if token in word_map:
                        bboxes.extend(word_map[token])
                    else:
                        tl = token.lower()
                        for k, v in word_map.items():
                            if k.lower() == tl:
                                bboxes.extend(v)
                                break

        if bboxes:
            entities.append({
                "entity_type": "Deep AI",
                "text_found":  phrase,
                "bboxes":      bboxes,
            })

    return entities


@app.route('/debug/gemma', methods=['POST'])
def debug_gemma():
    """
    Debug endpoint: send raw text, get back Gemma's raw output + filtered output.
    POST JSON: { "text": "...", "doc_type": "bank_statement" (optional) }
    """
    data     = request.get_json(force=True)
    text     = data.get("text", "")
    doc_type = data.get("doc_type", None)
    model    = data.get("model", OLLAMA_MODEL)

    # Auto-classify if doc_type not provided
    if not doc_type:
        doc_type = _classify_document(text, model=model)

    raw_text = _call_ollama(text, doc_type=doc_type, model=model)

    return jsonify({
        "doc_type":   doc_type,
        "raw_output": raw_text,
        "filtered":   _filter_gemma_output(raw_text),
        "model":      model,
    })


@app.route('/analyze/deep', methods=['POST'])
def analyze_pdf_deep():
    """
    Four-Pass Deep AI endpoint using Ollama + Gemma 4.

    Pass 0 – Gemma 4 classifies the document type (bank statement, invoice, etc.)
    Pass 1 – PyMuPDF builds a word→bbox map for every word on the page
    Pass 2 – Gemma 4 runs the expert prompt for that document type → JSON array
    Pass 3 – Matchmaker resolves each string to its exact pixel coordinates

    Request (multipart/form-data):
        file      – PDF file (required)
        page      – optional 1-based page number (default: all)
        dpi       – render DPI for base64 image (default: 150)
        model     – Ollama model name (default: gemma4)

    Response: same shape as /analyze + doc_type field
    """
    hw = _load_hardware_profile()
    if not hw.get("deep_ai_available"):
        return jsonify({
            "error": "Deep AI unavailable on this hardware (needs ≥8 GB RAM + dedicated GPU)"
        }), 403

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file      = request.files['file']
    target_pg = request.form.get('page', None)
    dpi       = max(72, min(int(request.form.get('dpi', 150)), 300))
    model     = request.form.get('model', OLLAMA_MODEL)

    # Verify Ollama is reachable before processing the PDF
    try:
        _requests.get(f"{OLLAMA_BASE}/api/tags", timeout=3)
    except Exception:
        return jsonify({
            "error": "Ollama is not running. Start it with: ollama run gemma4"
        }), 503

    import uuid
    uid        = str(uuid.uuid4())[:8]
    input_path = os.path.join(TEMP_DIR, f"deep_{uid}.pdf")
    file.save(input_path)

    try:
        doc        = fitz.open(input_path)
        pages_out  = []
        total_ents = 0

        page_range = range(doc.page_count)
        if target_pg is not None:
            pg_idx     = max(0, min(int(target_pg) - 1, doc.page_count - 1))
            page_range = range(pg_idx, pg_idx + 1)

        # ── Pass 0: classify document type using first page ───────────────────
        first_page_text = doc[0].get_text("text")
        doc_type = _classify_document(first_page_text, model=model)

        for pg_idx in page_range:
            page = doc[pg_idx]
            rect = page.rect

            # ── Pass 1: build word→bbox map ───────────────────────────────────
            word_map, word_seq = _build_word_map(page)

            # ── Pass 2: vision-first extraction ──────────────────────────────
            # Render the page to image FIRST (needed for both vision and response)
            image_b64 = _page_to_base64(page, dpi=dpi)
            plain_text = page.get_text("text")

            # Try vision mode (Gemma 4 sees the document layout)
            sensitive_list = _call_ollama_vision(image_b64, doc_type=doc_type, model=model)

            # Fall back to text mode if vision returned nothing
            if not sensitive_list:
                sensitive_list = _call_ollama(plain_text, doc_type=doc_type, model=model)

            # ── Pass 2b: YMYL regex compliance check ──────────────────────────
            # Run structured pattern matching alongside Gemma — catches anything
            # that Gemma missed (formatted numbers, emails, postcodes, etc.).
            # Skip Currency and Date types: Gemma intentionally excludes amounts
            # and transaction dates — don't re-add them via regex.
            _YMYL_SKIP_TYPES = {"Currency", "Date"}
            ymyl_hits = _scan_text_for_ymyl(plain_text)

            # Filter phone hits that appear in footer "contact us" boilerplate —
            # these are the bank's own customer-service numbers, not personal PII.
            _FOOTER_PHONE_RE = re.compile(
                r"(?:contact us|if you think|please contact|helpline|call us|telephone)", re.I
            )
            ymyl_strings = []
            for h in ymyl_hits:
                if h["entity_type"] in _YMYL_SKIP_TYPES:
                    continue
                if h["entity_type"] == "Phone":
                    ctx_start = max(0, h["start"] - 120)
                    context = plain_text[ctx_start:h["end"]]
                    if _FOOTER_PHONE_RE.search(context):
                        continue          # bank customer-service number — skip
                ymyl_strings.append(h["text_found"])

            # Merge: Gemma first (semantic), then regex extras (structural)
            seen_lower = {s.lower() for s in sensitive_list}
            for s in ymyl_strings:
                if s.lower() not in seen_lower:
                    sensitive_list.append(s)
                    seen_lower.add(s.lower())

            # ── Pass 3: resolve coordinates ───────────────────────────────────
            entities   = _match_to_bboxes(sensitive_list, word_map, page, word_seq)
            total_ents += len(entities)
            pages_out.append({
                "page_number": pg_idx + 1,
                "width":       round(rect.width,  2),
                "height":      round(rect.height, 2),
                "image_b64":   image_b64,
                "entities":    entities,
                "gemma_raw":   sensitive_list,   # for debugging (includes regex merges)
            })

        doc.close()
        return jsonify({
            "pages":          pages_out,
            "total_entities": total_ents,
            "engine":         "deep",
            "doc_type":       doc_type,          # tell the frontend what type was detected
        })

    except Exception as e:
        return jsonify({"error": f"Deep analysis failed: {str(e)}"}), 500

    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except Exception:
                pass


if __name__ == '__main__':
    import logging
    import sys
    
    # Suppress Flask's development server warning
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    # Also suppress the CLI warning
    cli = sys.modules.get('flask.cli')
    if cli:
        cli.show_server_banner = lambda *args: None
    
    hw = _load_hardware_profile()
    mode_label = "Deep AI + Fast" if hw.get("deep_ai_available") else "Fast Mode only"
    gpu_label  = hw.get("gpu", {}).get("name", "Unknown")[:20]
    ram_label  = f"{hw.get('ram_gb', '?')} GB"

    print("╔════════════════════════════════════════════╗")
    print("║  🔒 Zero-Trust Redactor - Backend Server   ║")
    print("║  Running at http://localhost:5000          ║")
    print(f"║  RAM: {ram_label:<8}  GPU: {gpu_label:<20}║")
    print(f"║  Engine: {mode_label:<33}║")
    print("║  Status: Ready ✓                           ║")
    print("╚════════════════════════════════════════════╝")
    
    app.run(debug=False, port=5000, host='127.0.0.1', threaded=True)