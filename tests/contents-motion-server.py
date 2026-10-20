from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote,urlsplit,parse_qs
import argparse
root=Path(__file__).resolve().parent
web=root.parent/'web'
parser=argparse.ArgumentParser(description='Loopback-only actual reader with private motion observer')
parser.add_argument('--port',type=int,default=8768)
args=parser.parse_args()
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript'}
    def translate_path(self,path):
        name=unquote(urlsplit(path).path).lstrip('/')
        if name=='__qc/contents-glass-observer.mjs':return str(root/'contents-glass-observer.mjs')
        if name=='__qc/disclosure-observer.mjs':return str(root/'disclosure-observer.mjs')
        target=(web/name).resolve()
        return str(target) if target.is_relative_to(web.resolve()) else str(web/'missing')
    def do_GET(self):
        parsed=urlsplit(self.path)
        observer={'contents-motion':'contents-glass-observer.mjs','disclosure':'disclosure-observer.mjs'}.get(parse_qs(parsed.query).get('qc',[''])[0])
        if parsed.path.endswith('.html') and observer:
            target=Path(self.translate_path(self.path))
            if target.is_file():
                data=target.read_bytes().replace(b'</body>',f'<script type="module" src="/__qc/{observer}"></script></body>'.encode('utf-8'))
                self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        super().do_GET()
    def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
print(f'Motion QA: http://127.0.0.1:{args.port}/design/handbook-lab/chapters/os-kernel-devices.html?qc=contents-motion',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
