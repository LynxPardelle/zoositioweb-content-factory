# Zoositioweb Campaign Notes

Date: 2026-05-27 (Central Time)
Scope: Local campaign factory notes for zoositioweb.com.mx
Status: Active pilot
Applies To: Short-form video scripts, render briefs, knowledge cards, manual publishing, and blog backlog
Campaign Design Source Of Truth:

- `docs/superpowers/specs/2026-05-27-zoositioweb-sector-campaign-factory-design.md`
- `docs/superpowers/plans/2026-05-27-zoositioweb-sector-campaign-factory-implementation-plan.md`
- `draft-zoositioweb-com-mx` sibling repo for approved product copy extraction

Confidence: High
Last Reviewed: 2026-05-27 (Central Time)

This folder stores structured campaign work for `zoositioweb.com.mx` inside the dedicated `zoositioweb-content-factory` repo.

Operating order:

1. Extract approved claims from the draft repo.
2. Generate ideas, scripts, and knowledge cards from approved claims only.
3. Validate campaign JSONL files.
4. Manually approve scripts in `qa-decisions.jsonl`.
5. Add exactly 9 approved records to `render-queue.jsonl`.
6. Select only Pexels/Pixabay assets and record license evidence in `asset-picks.jsonl`.
7. Generate render briefs into ignored `devonly/` output.
8. Render locally with MoneyPrinterTurbo only after human approval.
9. Publish manually and record metrics in `publish-log.jsonl`.
10. Build the learning report and blog backlog.

Security and quality rules:

- Do not store secrets, tokens, credential paths, signed URLs, or private customer information here.
- Do not invent ROI guarantees, fake testimonials, fake case studies, or unsupported statistics.
- Do not commit generated videos or third-party media.
- Do not use provider CDN URLs as permanent media; download selected assets locally before rendering.
- Keep MoneyPrinterTurbo local-only and do not expose it to the internet.
