# Zoositioweb Content Factory

Local campaign factory for `zoositioweb.com.mx`.

This repo keeps campaign strategy, pilot scripts, knowledge cards, render-brief preparation, publish metrics, and blog backlog outside `zoolandingpage`. The product repo should remain the source of truth for product/site copy; this repo is the operational content workspace.

## Current Pilot

- Product: `zoositioweb.com.mx`
- Pilot: `campaigns/zoositioweb/pilot-2026-05-sector-shortform`
- Sectors: servicios locales, consultorios, despachos
- Current content: 30 ideas, 30 scripts, 30 knowledge cards, 9 human-gated render queue records, 15 blog backlog candidates
- Published videos: none recorded yet

## Commands

```powershell
npm test
npm run campaign:zoosite:validate
npm run campaign:zoosite:render-briefs
npm run campaign:zoosite:report
npm run ui
```

The UI runs locally and reads the campaign files through a small Node server. It does not call external APIs.

## Safety Rules

- Do not commit `.env`, provider keys, generated videos, downloaded third-party media, or private customer data.
- Keep MoneyPrinterTurbo and generated render steps local-only.
- Use only approved claims extracted from the product source of truth.
- Keep the render queue human-gated until scripts, assets, voice, and licenses are manually approved.
