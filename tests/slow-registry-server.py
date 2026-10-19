"""Serve the actual static output with delayed registry replies for Resume QA."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import sleep
import argparse

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port',type=int,default=8767)
args=parser.parse_args()
web=Path(__file__).resolve().parent.parent/'web'
class SlowRegistry(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?',1)[0].endswith('/registry.json'):
            sleep(1)
        super().do_GET()
    def log_message(self,*args):
        pass
server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SlowRegistry,directory=str(web)))
print(f'Slow-registry fixture serving actual web output at http://127.0.0.1:{args.port}/',flush=True)
server.serve_forever()
