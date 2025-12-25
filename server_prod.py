"""
Zero-Trust Redactor - Production Server
Serves the built frontend + Flask API from a single server
"""
import os
import sys
import mimetypes

# Ensure correct MIME types for JS modules
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')

from flask import Flask, request, send_file, jsonify, send_from_directory, after_this_request
from flask_cors import CORS
import fitz  # PyMuPDF
from datetime import datetime
import hashlib

# Paths
BASE_DIR = os.path.dirname(__file__)
DIST_DIR = os.path.join(BASE_DIR, 'dist')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
TEMP_DIR = os.path.join(BASE_DIR, 'temp')

os.makedirs(TEMP_DIR, exist_ok=True)

# Create Flask app with static folder set to dist
app = Flask(__name__, static_folder=DIST_DIR, static_url_path='')
CORS(app)

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com blob:; "
        "worker-src 'self' blob:;"
    )
    return response

# Serve index.html for root
@app.route('/')
def serve_index():
    return send_from_directory(DIST_DIR, 'index.html')

# Serve PDF worker from public or dist
@app.route('/pdf.worker.min.mjs')
def serve_pdf_worker():
    if os.path.isfile(os.path.join(DIST_DIR, 'pdf.worker.min.mjs')):
        return send_from_directory(DIST_DIR, 'pdf.worker.min.mjs', mimetype='application/javascript')
    return send_from_directory(PUBLIC_DIR, 'pdf.worker.min.mjs', mimetype='application/javascript')

# Serve models
@app.route('/models/<path:path>')
def serve_models(path):
    return send_from_directory(os.path.join(PUBLIC_DIR, 'models'), path)

# ============================================
# API ROUTES (copied from server.py)
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'zero-trust-redactor'})

@app.route('/redact', methods=['POST'])
def redact_pdf():
    """Redact a PDF file with specified entities"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400
    
    # Accept 'words' parameter as comma-separated string (matching server.py)
    sensitive_words = request.form.get('words', '').split(',')
    
    # Filter empty words
    sensitive_words = [w.strip() for w in sensitive_words if w.strip()]
    
    if not sensitive_words:
        return jsonify({'error': 'No words to redact'}), 400
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_hash = hashlib.md5(file.read()).hexdigest()[:8]
    file.seek(0)
    
    input_path = os.path.join(TEMP_DIR, f'input_{timestamp}_{file_hash}.pdf')
    output_path = os.path.join(TEMP_DIR, f'redacted_{timestamp}_{file_hash}.pdf')
    
    try:
        file.save(input_path)
        doc = fitz.open(input_path)
        redaction_count = 0
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            for word in sensitive_words:
                if not word or not word.strip():
                    continue
                
                # Normalize the word (remove extra whitespace)
                word_normalized = ' '.join(word.split())
                
                # Case-insensitive search (flags=0 is case-sensitive, flags=2 is case-insensitive)
                # Try case-insensitive first
                text_instances = page.search_for(word_normalized, flags=2)
                
                # If no case-insensitive matches, try exact case match
                if not text_instances:
                    text_instances = page.search_for(word_normalized, flags=0)
                
                for inst in text_instances:
                    page.add_redact_annot(inst, fill=(0, 0, 0))
                    redaction_count += 1
            
            # Apply redactions on this page
            page.apply_redactions()
        
        doc.save(output_path)
        doc.close()
        
        @after_this_request
        def cleanup(response):
            try:
                if os.path.exists(input_path):
                    os.remove(input_path)
                if os.path.exists(output_path):
                    os.remove(output_path)
            except Exception:
                pass
            return response
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name=f'redacted_{file.filename}',
            mimetype='application/pdf'
        )
        
    except Exception as e:
        for path in [input_path, output_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        return jsonify({'error': str(e)}), 500

import json

if __name__ == '__main__':
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    print("╔════════════════════════════════════════════╗")
    print("║  🛡️  Zero-Trust Redactor Pro v2.0.0        ║")
    print("║  Running at http://localhost:5000          ║")
    print("║  Status: Production Mode ✓                 ║")
    print("╚════════════════════════════════════════════╝")
    
    import webbrowser
    webbrowser.open('http://localhost:5000')
    
    app.run(debug=False, port=5000, host='127.0.0.1', threaded=True)