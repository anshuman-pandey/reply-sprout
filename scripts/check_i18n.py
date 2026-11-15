"""Exercise interface languages against disposable localhost fixtures only."""
import functools
import http.server
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]

def main():
 with tempfile.TemporaryDirectory(prefix='interface-test-') as temp:
  env=dict(os.environ)
  if (ROOT/'app.py').exists():
   sys.path.insert(0,str(ROOT))
   from werkzeug.serving import make_server
   from werkzeug.security import generate_password_hash
   from app import create_app
   if (ROOT/'static/consent.json').exists():
    app=create_app({'SECRET_KEY':'local-test-only','ADMIN_PASSWORD_HASH':generate_password_hash('test-only'), 'DATABASE':str(Path(temp)/'db'),'SESSION_COOKIE_SECURE':False})
   else:
    os.environ.update(OWNER_TOKEN='local-i18n-test-'+('x'*32),DATA_DIR=temp)
    app=create_app()
   server=make_server('127.0.0.1',0,app,threaded=True);port=server.server_port
  else:
   handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
   server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler);port=server.server_address[1]
  threading.Thread(target=server.serve_forever,daemon=True).start()
  pages=['/']
  if (ROOT/'manifest.json').exists():
   pages=['/popup.html','/editor.html?id=fixture'];env['TEST_EXTENSION_UI']='1'
  try:
   for page in pages:
    env['TEST_URL']=f'http://127.0.0.1:{port}'+page
    subprocess.run(['node','i18n.test.cjs'],cwd=ROOT,env=env,check=True,timeout=120)
  finally:
   server.shutdown();server.server_close()

if __name__=='__main__': main()
