"""Build a static deployment from an explicit public-file allowlist."""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parents[1]
FILES = ('index.html', 'style.css', 'app.js', 'core.js', 'storage.js',
         'messages.js', 'i18n.js', 'LICENSE')

def package(destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    for name in FILES:
        shutil.copyfile(ROOT / name, destination / name)
    (destination / '.nojekyll').write_text('')

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/package-site.py NEW_OUTPUT_DIRECTORY')
    package(sys.argv[1])
