"""Serve Brick by Brick locally with caching turned off: python3 serve.py, then open http://127.0.0.1:8765/"""
import http.server, os, functools

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "site"))
http.server.ThreadingHTTPServer(("127.0.0.1", 8765), NoCache).serve_forever()
