# Release versions

Every new delivered extension version must increment the numeric version in
`manifest.json`, keep `package.json` in sync, and include that version in the ZIP
filename. Preserve previous numbered ZIPs. Run the relevant checks before
`python3 scripts/release.py`; it increments the patch version and packages the
release as `TeePublic-Auto-Uploader-vX.Y.Z.zip` in the parent directory.

## Standing delivery instructions

For every future extension update, the user explicitly requires all of these:

1. Increment the manifest/package version and build the numbered ZIP.
2. Commit the intended public source changes and push to
   `https://github.com/alizaghrioui/teepublic-auto-uploader`.
3. Publish a new GitHub release using the matching `vX.Y.Z` tag and attach that ZIP.
4. Do not run tests, browser tests, trial uploads or trial publications. State that
   tests were not run; do not claim the new version is tested.

This is ongoing authorization for these release steps; do not ask again for each
routine update. Continue to exclude private diagnostics, artwork, listing sheets,
research configuration and credentials from commits and release archives. These
instructions do not authorize publishing designs or accepting website terms.
