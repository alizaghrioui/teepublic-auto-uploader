<p align="center"><img src="assets/icon-128.png" width="96" alt="TeePublic Auto Uploader logo"></p>
<h1 align="center">TeePublic Auto Uploader</h1>
<p align="center">Local design queues, CSV listings and sequential uploads for Chrome.</p>

A Manifest V3 extension that uses your existing signed-in TeePublic session. Select PNG designs, match each one to its complete listing, choose shirt colors and prepare or publish an approved batch. No paid API or external runtime service is required.

## Features

- Multiple PNG selection or folder import, with image previews and full listing cards.
- UTF-8 CSV import, exact filename matching and manual row assignment.
- Light Shirt and Black Shirt modes with the website's real color controls.
- Sequential upload → metadata → colors → preview → approved publication → public-page verification.
- Pause, Resume, **Stop Bulk Auto Upload** and **Stop Publishing**.
- Successful design tabs close after verification; error/unverified tabs remain open.
- IndexedDB queue/history, SHA-256 duplicate prevention and CSV result export.
- **Delete All Success** clears the visible list while preserving duplicate history.
- Clean dashboard, logo and visible page scrolling; advanced recorder and diagnostics are tucked away.
- Workspace reopens after extension reload. Interrupted work is held for review.

## Install

1. Download the latest release ZIP, or use **Code → Download ZIP**, and extract it.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked**, then select the folder containing `manifest.json`.
4. Sign in to TeePublic in the same Chrome profile. Reload any existing TeePublic editor tabs.
5. Open the extension popup and choose **Open workspace**.

For updates, replace the source in the same folder and click **Reload** on the extension card. Keeping the same unpacked folder avoids accidentally creating a different local extension identity. Reloading interrupts active operations; it never automatically restarts uploads or grants publication approval. Files not yet added to the queue must be selected again.

## Prepare your listing sheet

Use [examples/listing-template.csv](examples/listing-template.csv), or **Download listing sheet template** in the dashboard to fill filenames from selected PNGs. Export Excel/Google Sheets as **CSV UTF-8**; direct XLSX import is not supported.

| Column | Purpose |
| --- | --- |
| `filename` | Exact PNG basename, including `.png` |
| `title` | Design title |
| `description` | Full description |
| `main_tag` | Main TeePublic tag |
| `additional_tags` | Comma-separated tags inside a quoted CSV cell |
| `shirt_mode` | `black` or `light` |
| `mature_content` | `no`; mature/ambiguous content requires manual preparation |
| `review_status` | Your review note, e.g. `HOLD_REVIEW` or `REVIEWED` |
| `notes` | Source restrictions or other review notes |
| `published_url` | Existing publication URL; blocks automatic re-upload until verified |

Review each design's assigned row. A sheet row cannot be assigned to multiple selected designs. Incomplete required metadata blocks import. These files contain no account credentials and must never include them.

## Run a batch

1. **Select Designs** (or **Select Design Folder**) and **Select Listing Sheet (CSV)**.
2. Review the design/listing matches and choose **Add selected designs**.
3. Choose a shirt mode. **Use CSV shirt modes** applies each row's color when present.
4. Review the artwork, content, rights, contrast and product settings. Check the three publication approvals, including acceptance of TeePublic/Dashery terms.
5. Click **Start Auto Upload & Publish** and confirm the displayed filenames/titles once.
6. Keep the workspace open. The extension opens each editor, fills its assigned listing, submits only the approved design and verifies its public URL, design ID, canonical identity and title.

Use **Advanced tools → Test one design only** for an optional trial. **Advanced tools → Start Upload** prepares drafts without publishing. The preview check detects image loading; it does not judge visual contrast or positioning. The first public-page verification profile was recorded from the real site; every run still checks actual DOM conditions.

**Stop Bulk Auto Upload** stops before the next action and clears approvals. **Stop Publishing** stops further submissions. A dispatched operation may finish; an already-submitted publication is still checked. The batch stops at its first failure or uncertain publication and does not blindly retry. Restarting a stopped/interrupted draft requires review to prevent duplicate server uploads.

## Complete an interrupted draft listing

Click **Open draft & Complete listing** on a queue row that already has a saved draft URL. The extension reuses that exact editor tab, or opens the saved draft URL if its tab was closed. It completes title, description, main/additional tags and recorded color settings, then checks the preview and leaves the design in **review**. It does not create a new design, re-upload artwork, accept terms or publish.

Stored listing metadata is reused. If a CSV is currently selected, its exact filename-matching row updates that design's listing before completion. Missing metadata or an unmatched selected sheet blocks the action. **View only** opens the draft without editing it.

Active batches must be stopped first. Known successful/publishing/uncertain-publication records are excluded from automatic draft completion. The stored design ID and URL must agree; unexpected redirects, missing uploaded-artwork controls or a publish control that does not identify an unpublished draft stop recovery. An incomplete artwork upload may still need manual review. Existing committed tags are reused rather than added again. This completes the editor form; it does not submit a Save for Later action.

## Colors

- **Black Shirt:** activate **Dark**, set T-Shirt to Black, then Baseball Tee to the recorded Black/White option.
- **Light Shirt:** activate **Light** and use verified White choices. Some products have no recorded White default, so automatic light publication may be held for manual review.

Only T-Shirt and Baseball Tee dropdowns are changed. Other apparel inherit the T-Shirt color; the publication gate checks recorded defaults before submission. Artwork pixels are preserved.

## Local history and privacy

**Delete All Success** removes successful rows from the visible queue/counters, not TeePublic. **Advanced tools → Restore Deleted Success** restores them. Hashes, URLs and files remain locally stored for duplicate protection and result exports. Removing browser extension data can erase local history; export results first.

The only permissions are `storage` and access to `https://www.teepublic.com/*`. The extension does not request cookie, password, debugger or all-sites access, and has no analytics or paid API integration. Artwork/listings are submitted to TeePublic only as part of a user-started workflow. See [PRIVACY.md](PRIVACY.md).

## Status and limitations

Two individual designs were published and verified during original development; one used the automatic submission path. Live multi-design publication and later UI changes have not been fully verified. Latest updates were made without running tests at the owner's request. See [TESTING.md](TESTING.md).

Selectors are recordings of a real editor, not a guarantee of future website compatibility. CAPTCHA, platform restrictions, changed selectors, source restrictions and uncertain outcomes require manual review. No CAPTCHA or rate-limit bypass is implemented. This is an independent project and is not affiliated with TeePublic.

## Development and releases

Runtime code is in `src/`, `dashboard.html`, `popup.html` and `style.css`. Recorded controls are in `selectors.json`; reusable steps are in `workflow.json`.

- Tests can be run explicitly with Node.js 20+: `npm test` (no packages to install).
- Package the next numbered release with Python 3: `python3 scripts/release.py`.
- `python3 scripts/package.py` packages the current version without incrementing it. It uses an explicit source allowlist and excludes local artwork, sheets, diagnostics, research integrations and credentials.

GitHub Desktop: **File → Add Local Repository**, choose this repository, then fetch/pull before editing. Commit intended changes and use **Push origin**. Keep the loaded extension folder fixed when updating.

See [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
