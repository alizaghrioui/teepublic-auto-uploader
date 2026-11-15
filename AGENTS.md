# Release versions

Every new delivered extension version must increment the numeric version in
`manifest.json`, keep `package.json` in sync, and include that version in the ZIP
filename. Preserve previous numbered ZIPs. Run the relevant checks before
`python3 scripts/release.py`; it increments the patch version and packages the
release as `TeePublic-Auto-Uploader-vX.Y.Z.zip` in the parent directory.
