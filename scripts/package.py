#!/usr/bin/env python3
"""Package only public source; never bundle local artwork or diagnostic data."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
FILES = {'manifest.json', 'package.json', 'dashboard.html', 'popup.html', 'style.css',
         'selectors.json', 'workflow.json', 'README.md', 'TESTING.md', 'CHANGELOG.md',
         'PRIVACY.md', 'SECURITY.md', 'CONTRIBUTING.md', '.gitignore', '.gitattributes', 'AGENTS.md'}
DIRECTORIES = {'src', 'assets', 'tests', 'examples'}
SCRIPTS = {'scripts/package.py', 'scripts/release.py'}

def public_files():
    for path in sorted(ROOT.rglob('*')):
        relative = path.relative_to(ROOT)
        if path.is_symlink() or not path.is_file():
            continue
        if any(part in {'node_modules', '__pycache__', '.git'} for part in relative.parts):
            continue
        if path.suffix in {'.pyc', '.zip'} or path.name == '.DS_Store':
            continue
        if str(relative) in FILES | SCRIPTS or relative.parts[0] in DIRECTORIES:
            yield path, relative

def package_current():
    version = json.loads((ROOT / 'manifest.json').read_text())['version']
    archive = ROOT.parent / f'TeePublic-Auto-Uploader-v{version}.zip'
    if archive.exists():
        raise SystemExit(f'Release already exists: {archive}')
    with ZipFile(archive, 'x', ZIP_DEFLATED) as bundle:
        for path, relative in public_files():
            bundle.write(path, str(Path(ROOT.name) / relative))
    print(f'Version {version}: {archive}')
    return archive

if __name__ == '__main__':
    package_current()
