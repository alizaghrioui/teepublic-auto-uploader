# Validation status

## Historical development evidence

- 47 local tests passed at the automatic single-design prototype stage.
- Two designs were individually published and independently verified on TeePublic; one was a fully automatic single-design run with explicit publishing/terms approval.
- Later UI, scrolling, tab lifecycle and history controls were implemented without running tests at the owner's request.
- Live multi-design bulk publication has not been verified.

These are historical observations, not a claim that the current release's full test suite passes. Private artwork, account-specific URLs and diagnostic captures are deliberately excluded from this repository.

## Current release

The public repository preparation updates documentation, packaging exclusions and synthetic fixtures. No tests or real uploads/publications were run during this preparation. Test mocks were updated for visible scrolling and the two-product color sequence; they remain unexecuted.

## Optional manual validation

When explicitly requested, use one unpublished design first. Check CSV matching, required fields, tags, Dark/Light palette, T-Shirt → Baseball Tee sequence, inherited apparel defaults, image visibility, pause/resume/stop, duplicate rejection and public URL/title/ID verification. Verify successful tabs close and error tabs remain open. Reload must preserve queue history and hold interrupted work without resubmission.

Publishing and acceptance of website terms require the user's explicit approval. Never use real account credentials or session data in fixtures or diagnostic submissions.

## 0.1.13

Existing-draft listing completion was implemented without executing tests or browser automation against TeePublic, per the standing instruction. Completion uses the saved editor URL/ID, skips file upload and design creation, checks the existing unpublished editor control, reuses existing tag tokens and leaves the result in review. No live recovery claim is made.
