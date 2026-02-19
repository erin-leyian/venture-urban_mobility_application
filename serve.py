#!/usr/bin/env python3
"""
Simple static file server for the frontend.
Run from the repo root:
    python serve.py
Then open: http://localhost:8080
"""
import http.server
import socketserver
import os
import threading
import webbrowser

PORT = 8080
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy access logs; only print errors
        if int(args[1]) >= 400:
            super().log_message(format, *args)

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\n  Frontend  →  {url}")
        print(f"  API       →  http://localhost:5002  (start separately with: cd api && python3 app.py)\n")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
