"""
Zero-Trust Redactor - Production Server
Serves the built frontend + Flask API from a single server
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from server import app
from flask import send_from_directory

DIST_DIR = os.path.join(os.path.dirname(__file__), 'dist')

@app.route('/')
def serve_index():
    return send_from_directory(DIST_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Try to serve the file from dist
    file_path = os.path.join(DIST_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(DIST_DIR, path)
    # For SPA routing, return index.html
    return send_from_directory(DIST_DIR, 'index.html')

@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory(os.path.join(DIST_DIR, 'assets'), path)

if __name__ == '__main__':
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    print("╔════════════════════════════════════════════╗")
    print("║  🛡️  Zero-Trust Redactor Pro v2.0.0        ║")
    print("║  Running at http://localhost:5000          ║")
    print("║  Status: Production Mode ✓                 ║")
    print("╚════════════════════════════════════════════╝")
    
    # Open browser automatically
    import webbrowser
    webbrowser.open('http://localhost:5000')
    
    app.run(debug=False, port=5000, host='127.0.0.1', threaded=True)