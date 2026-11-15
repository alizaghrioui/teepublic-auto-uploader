#!/usr/bin/env python3
"""Increment the version and produce an allowlisted public release."""
import json
from package import ROOT, package_current

manifest_path = ROOT / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
major, minor, patch = map(int, manifest['version'].split('.'))
version = f'{major}.{minor}.{patch + 1}'
archive = ROOT.parent / f'TeePublic-Auto-Uploader-v{version}.zip'
if archive.exists():
    raise SystemExit(f'Release already exists: {archive}')
manifest['version'] = version
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text())
package['version'] = version
package['description'] = 'Chrome extension for local TeePublic design queues, CSV listings and approved batch uploads.'
package_path.write_text(json.dumps(package, indent=2) + '\n')
package_current()
