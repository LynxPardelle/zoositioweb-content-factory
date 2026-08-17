# Zoositioweb Content Factory

Local campaign factory for `zoositioweb.com.mx`.

This repo keeps campaign strategy, pilot scripts, knowledge cards, render-brief preparation, publish metrics, and blog backlog outside `zoolandingpage`. The product repo should remain the source of truth for product/site copy; this repo is the operational content workspace.

## Current Pilot

- Product: `zoositioweb.com.mx`
- Pilot: `campaigns/zoositioweb/pilot-2026-05-sector-shortform`
- Sectors: servicios locales, consultorios, despachos
- Current content: 30 ideas, 30 scripts, 30 knowledge cards, 9 human-gated render queue records, 9 selected asset records, 15 blog backlog candidates
- Published videos: none recorded yet

## Commands

```powershell
npm test
npm run campaign:zoosite:validate
npm run campaign:zoosite:render-briefs
npm run campaign:zoosite:report
npm run campaign:zoosite:assets:plan
npm run campaign:zoosite:assets:fetch
npm run campaign:zoosite:polly:plan
npm run campaign:zoosite:polly:synthesize -- -- --render-id=render-servicios-locales-001 --voice-id=Mia --engine=neural --language-code=es-MX
npm run campaign:zoosite:render-video -- -- --render-id=render-servicios-locales-001
npm run campaign:zoosite:render-video:mpt -- -- --render-id=render-servicios-locales-001 --mpt-root=C:\path\to\MoneyPrinterTurbo
npm run campaign:zoosite:render-video:mpt -- -- --render-id=render-servicios-locales-001 --preset=enhanced --mpt-root=C:\path\to\MoneyPrinterTurbo
npm run ui
```

On NPM 11, dynamic script flags need the double separator shown above: `-- -- --flag=value`.

The UI runs locally and reads the campaign files through a small Node server. It does not call external APIs, and the server accepts loopback hosts only (`127.0.0.1`, `::1`, or `localhost`).

## Local Secrets

Copy `.env.example` to `.env` on your machine and fill provider keys there. `.env` files are ignored by git.

Asset candidate searches use `PEXELS_API_KEY` and `PIXABAY_API_KEY`. Results are written under `devonly/` and must be reviewed before adding anything to `asset-picks.jsonl`.

## Safety Rules

- Do not commit `.env`, provider keys, generated videos, downloaded third-party media, or private customer data.
- Keep MoneyPrinterTurbo and generated render steps local-only.
- Use only approved claims extracted from the product source of truth.
- Preserve pending render-queue records for planning and dry runs. Polly `--execute` and both video renderers fail closed until the render has `status: approved`, `humanApprovalStatus: approved`, and `assetLicenseStatus: verified`, with reviewer/verifier identities, timestamps, and the approved asset ID recorded.
- Before rendering, record and verify each selected local asset's `localFilePath`, SHA-256, byte length, and content type. The file's canonical path must remain inside the pilot's `selected-assets` directory.
- No immutable MoneyPrinterTurbo source is approved yet. MPT rendering must remain fail closed until a source-backed repository, exact reviewed commit, reviewer, and review time are recorded; never infer or invent a commit SHA.
- Source visual/audio assets only from Pexels or Pixabay for this pilot.
- Store only local downloaded files in the renderer; do not hotlink provider URLs in generated videos.
- Record every selected asset in `asset-picks.jsonl` with source page, creator, license URL, commercial-use check, and notes about trademarks or recognizable people.
- Prefer Amazon Polly neural Spanish (Mexico) voice `Mia` for first TTS tests. The Polly script is dry-run by default and only calls AWS when `--execute` is passed.
