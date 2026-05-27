# Zoositioweb Sector Campaign Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, Docker-friendly campaign factory that produces Zoositioweb short-form video scripts, render briefs, reusable knowledge cards, and blog backlog notes without changing the Angular runtime or auto-publishing content.

**Architecture:** Keep the campaign factory as dedicated-repo Node tooling plus structured notes under `campaigns/zoositioweb/`. Source claims are extracted from the separate `draft-zoositioweb-com-mx` repo, campaign records are stored as JSONL, and validators block unsafe or unsupported marketing claims before anything reaches MoneyPrinterTurbo.

**Tech Stack:** Node.js ESM scripts, `node:test`, JSON/JSONL data files, existing npm scripts, local `devonly/` output for untracked render briefs and videos.

---

## Scope Boundary

This plan does not touch Angular app code, draft content, production deployment, or publishing APIs. The first implementation produces local campaign assets and checks only. Human approval remains required before rendering and before publishing.

## File Structure

- Create `campaigns/zoositioweb/README.md`: durable overview of the campaign folder, safety rules, and operating order.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/campaign-brief.md`: human-readable pilot brief copied from the approved design.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/sectors.json`: canonical sector IDs, target audience, CTA product, and draft source paths.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/approved-claims.json`: generated snapshot of draft strings that campaign scripts may cite.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/ideas.jsonl`: 30 campaign idea records.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/scripts.jsonl`: 30 short-form script records.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/knowledge-cards.jsonl`: 30 reusable research/content cards.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/qa-decisions.jsonl`: human/script QA decisions.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-queue.jsonl`: 9 manually approved render candidates.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/publish-log.jsonl`: manual post and metric log.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/blog-backlog.jsonl`: blog candidates derived from knowledge cards.
- Create `campaigns/zoositioweb/pilot-2026-05-sector-shortform/learning-report.md`: generated cross-sector pilot report.
- Create `tools/campaigns/zoositioweb/schema.mjs`: JSONL parsing, data validation, cross-reference checks, and unsafe-claim detection.
- Create `tools/campaigns/zoositioweb/extract-approved-claims.mjs`: extracts approved source strings from the draft repo into `approved-claims.json`.
- Create `tools/campaigns/zoositioweb/validate-pilot.mjs`: validates all pilot campaign files together.
- Create `tools/campaigns/zoositioweb/build-render-briefs.mjs`: writes MoneyPrinterTurbo-ready markdown briefs to ignored `devonly/`.
- Create `tools/campaigns/zoositioweb/build-learning-report.mjs`: builds `learning-report.md` and `blog-backlog.jsonl` from manual metrics plus knowledge cards.
- Create `tools/tests/campaign-zoosite-schema.spec.mjs`: unit tests for record validation and unsafe-claim rules.
- Create `tools/tests/campaign-zoosite-claim-extractor.spec.mjs`: fixture tests for draft claim extraction.
- Create `tools/tests/campaign-zoosite-validator.spec.mjs`: integration tests for pilot validation.
- Create `tools/tests/campaign-zoosite-render-briefs.spec.mjs`: tests render brief generation without video rendering.
- Create `tools/tests/campaign-zoosite-learning-report.spec.mjs`: tests report and blog backlog generation.
- Modify `package.json`: add campaign scripts and a campaign test target.

## Data Contracts

Use these exact IDs:

- `servicios-locales`
- `consultorios`
- `despachos`

Use these exact status values:

- `draft`
- `needs-review`
- `approved`
- `rejected`
- `rendered`
- `published`

Idea record:

```json
{
  "id": "idea-servicios-locales-001",
  "sector": "servicios-locales",
  "hookType": "mistake",
  "audience": "duenos de servicios locales",
  "problem": "El visitante no sabe si el negocio atiende su zona.",
  "usefulAngle": "Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.",
  "ctaProduct": "zoositioweb.com.mx",
  "sourceDraftPaths": ["sector-servicios-locales/i18n/es.json"],
  "status": "draft"
}
```

Script record:

```json
{
  "id": "script-servicios-locales-001",
  "ideaId": "idea-servicios-locales-001",
  "sector": "servicios-locales",
  "durationSecondsEstimate": 35,
  "title": "Tu sitio debe decir donde atiendes",
  "hook": "Si vendes un servicio local, decir 'atiendo en toda la ciudad' puede generar malos contactos.",
  "bodyLines": [
    "La gente quiere saber si llegas a su zona.",
    "Tambien quiere ver horarios, fotos reales y como pedir una cotizacion.",
    "Un sitio claro convierte el primer WhatsApp en una conversacion con contexto."
  ],
  "cta": "Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.",
  "approvedClaimIds": ["claim-sector-servicios-locales-i18n-es-json-001"],
  "status": "draft"
}
```

Knowledge card record:

```json
{
  "id": "knowledge-servicios-locales-001",
  "sector": "servicios-locales",
  "audience": "duenos de servicios locales",
  "problem": "Los mensajes iniciales llegan sin zona, horario ni servicio exacto.",
  "insight": "Una pagina de servicios locales debe responder zona, disponibilidad y siguiente paso antes de pedir contacto.",
  "approvedProductClaim": "Un sitio puede ordenar servicios, zonas, horarios y WhatsApp.",
  "sourceDraftPath": "sector-servicios-locales/i18n/es.json",
  "ctaProduct": "zoositioweb.com.mx",
  "scriptId": "script-servicios-locales-001",
  "blogPotential": "high",
  "blogTitleCandidate": "Que debe tener el sitio web de un servicio local para recibir mejores solicitudes",
  "faqCandidate": "Que informacion debe incluir mi sitio si doy servicios a domicilio?",
  "evidenceNeeded": [],
  "status": "draft"
}
```

QA decision record:

```json
{
  "scriptId": "script-servicios-locales-001",
  "decision": "approved",
  "reviewedAt": "2026-05-27T19:40:00.000Z",
  "reviewer": "Alec",
  "checks": {
    "under45Seconds": true,
    "sectorClear": true,
    "usefulBeforeCta": true,
    "rightProductCta": true,
    "noUnsupportedRoi": true,
    "noFakeTestimonial": true,
    "noDraftContradiction": true,
    "statisticsSourcedOrRemoved": true
  },
  "notes": "Approved by Codex technical QA for render-brief preparation. Final human approval remains required before MoneyPrinterTurbo rendering or publishing."
}
```

Render queue record:

```json
{
  "id": "render-servicios-locales-001",
  "scriptId": "script-servicios-locales-001",
  "sector": "servicios-locales",
  "format": "vertical-9x16",
  "voice": "manual-selection",
  "assetSource": "approved-local-assets-only",
  "captionStyle": "large-readable-spanish",
  "status": "needs-review",
  "humanApprovalRequired": true,
  "humanApprovalStatus": "pending",
  "assetLicenseStatus": "pending-local-asset-selection",
  "notes": "Render briefs may be prepared, but actual rendering requires human approval and local/license-verified assets."
}
```

Publish log record:

```json
{
  "renderId": "render-servicios-locales-001",
  "platform": "tiktok",
  "publishedAt": "2026-05-30T18:00:00.000Z",
  "url": "",
  "views": 0,
  "threeSecondRetention": null,
  "averageWatchTimeSeconds": null,
  "likes": 0,
  "comments": 0,
  "saves": 0,
  "shares": 0,
  "profileVisits": 0,
  "linkClicks": 0,
  "whatsappConversations": 0,
  "notes": ""
}
```

## Task 1: Add Campaign Workspace And npm Entrypoints

**Files:**
- Create: `campaigns/zoositioweb/README.md`
- Create: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/campaign-brief.md`
- Create: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/sectors.json`
- Create: empty JSONL/data files listed in File Structure
- Modify: `package.json`

- [ ] **Step 1: Create the campaign folders and empty data files**

Use PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/ideas.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/scripts.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/knowledge-cards.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/qa-decisions.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-queue.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/publish-log.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/blog-backlog.jsonl
New-Item -ItemType File -Force -Path campaigns/zoositioweb/pilot-2026-05-sector-shortform/learning-report.md
```

Expected: all paths exist; files are empty except files populated in later steps.

- [ ] **Step 2: Add `README.md`**

Write:

```markdown
# Zoositioweb Campaign Notes

Date: 2026-05-27 (Central Time)
Scope: Local campaign factory notes for zoositioweb.com.mx
Status: Active pilot
Applies To: Short-form video scripts, render briefs, knowledge cards, manual publishing, and blog backlog
Source Of Truth:

- `docs/superpowers/specs/2026-05-27-zoositioweb-sector-campaign-factory-design.md`
- `docs/superpowers/plans/2026-05-27-zoositioweb-sector-campaign-factory-implementation-plan.md`
- `draft-zoositioweb-com-mx` sibling repo

Confidence: High
Last Reviewed: 2026-05-27 (Central Time)

This folder stores structured campaign work for `zoositioweb.com.mx`.

Operating order:

1. Extract approved claims from the draft repo.
2. Generate ideas, scripts, and knowledge cards from approved claims only.
3. Validate campaign JSONL files.
4. Manually approve scripts in `qa-decisions.jsonl`.
5. Add exactly 9 approved records to `render-queue.jsonl`.
6. Generate render briefs into ignored `devonly/` output.
7. Render locally with MoneyPrinterTurbo only after human approval.
8. Publish manually and record metrics in `publish-log.jsonl`.
9. Build the learning report and blog backlog.

Security and quality rules:

- Do not store secrets, tokens, credential paths, signed URLs, or private customer information here.
- Do not invent ROI guarantees, fake testimonials, fake case studies, or unsupported statistics.
- Do not commit generated videos or third-party media.
- Keep MoneyPrinterTurbo local-only and do not expose it to the internet.
```

- [ ] **Step 3: Add `campaign-brief.md`**

Write:

```markdown
# Zoositioweb Sector Short-Form Pilot

Date: 2026-05-27 (Central Time)
Status: Approved pilot

The pilot creates informative vertical short-form campaigns for `zoositioweb.com.mx`.

Sectors:

- `servicios-locales`
- `consultorios`
- `despachos`

Outputs:

- 10 ideas per sector
- 10 script candidates per sector
- 10 knowledge cards per sector
- 3 manually selected render candidates per sector
- 9 render briefs total
- Manual publishing only
- One learning report and one blog backlog

Default CTA:

`Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.`

Campaign tone:

- Spanish first
- Useful before commercial
- Clear and direct
- No guaranteed ROI
- No fake testimonials
- No unsupported statistics
```

- [ ] **Step 4: Add `sectors.json`**

Write:

```json
{
  "pilotId": "pilot-2026-05-sector-shortform",
  "product": "zoositioweb.com.mx",
  "defaultCta": "Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.",
  "sectors": [
    {
      "id": "servicios-locales",
      "label": "Servicios locales",
      "audience": "duenos de servicios locales",
      "sourceDraftPaths": [
        "default/i18n/es.json",
        "sector-servicios-locales/i18n/es.json",
        "planes/i18n/es.json",
        "servicios/i18n/es.json"
      ]
    },
    {
      "id": "consultorios",
      "label": "Consultorios",
      "audience": "duenos y administradores de consultorios",
      "sourceDraftPaths": [
        "default/i18n/es.json",
        "sector-consultorios/i18n/es.json",
        "planes/i18n/es.json",
        "servicios/i18n/es.json"
      ]
    },
    {
      "id": "despachos",
      "label": "Despachos",
      "audience": "socios y administradores de despachos profesionales",
      "sourceDraftPaths": [
        "default/i18n/es.json",
        "sector-despachos/i18n/es.json",
        "planes/i18n/es.json",
        "servicios/i18n/es.json"
      ]
    }
  ]
}
```

- [ ] **Step 5: Add npm scripts**

Modify `package.json` scripts:

```json
"campaign:zoosite:extract-claims": "node tools/campaigns/zoositioweb/extract-approved-claims.mjs",
"campaign:zoosite:validate": "node tools/campaigns/zoositioweb/validate-pilot.mjs",
"campaign:zoosite:render-briefs": "node tools/campaigns/zoositioweb/build-render-briefs.mjs",
"campaign:zoosite:report": "node tools/campaigns/zoositioweb/build-learning-report.mjs",
"test:campaign-zoosite": "node --test tools/tests/campaign-zoosite-*.spec.mjs"
```

- [ ] **Step 6: Verify entrypoints are registered**

Run:

```powershell
node -e "const p=require('./package.json'); for (const k of ['campaign:zoosite:extract-claims','campaign:zoosite:validate','campaign:zoosite:render-briefs','campaign:zoosite:report','test:campaign-zoosite']) { if (!p.scripts[k]) throw new Error(k); } console.log('campaign scripts registered')"
```

Expected:

```text
campaign scripts registered
```

- [ ] **Step 7: Commit**

```powershell
git add package.json campaigns/zoositioweb
git commit -m "Add Zoosite campaign workspace"
```

## Task 2: Add Schema And Unsafe-Claim Validation

**Files:**
- Create: `tools/campaigns/zoositioweb/schema.mjs`
- Create: `tools/tests/campaign-zoosite-schema.spec.mjs`

- [ ] **Step 1: Write schema tests**

Create `tools/tests/campaign-zoosite-schema.spec.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseJsonl,
  validateIdeaRecord,
  validateKnowledgeCardRecord,
  validatePublishLogRecord,
  validateQaDecisionRecord,
  validateRenderQueueRecord,
  validateScriptRecord,
  findUnsafeClaimHits,
} from '../campaigns/zoositioweb/schema.mjs';

test('parseJsonl ignores blank lines and reports source line numbers', () => {
  const records = parseJsonl('{"id":"one"}\n\n{"id":"two"}\n', 'sample.jsonl');

  assert.deepEqual(records, [
    { value: { id: 'one' }, line: 1, file: 'sample.jsonl' },
    { value: { id: 'two' }, line: 3, file: 'sample.jsonl' },
  ]);
});

test('validateIdeaRecord accepts a valid idea', () => {
  const errors = validateIdeaRecord({
    id: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    hookType: 'mistake',
    audience: 'duenos de servicios locales',
    problem: 'El visitante no sabe si el negocio atiende su zona.',
    usefulAngle: 'Mostrar zonas, horarios y tipo de servicio antes del WhatsApp.',
    ctaProduct: 'zoositioweb.com.mx',
    sourceDraftPaths: ['sector-servicios-locales/i18n/es.json'],
    status: 'draft',
  });

  assert.deepEqual(errors, []);
});

test('validateScriptRecord rejects unsupported ROI language', () => {
  const errors = validateScriptRecord({
    id: 'script-servicios-locales-001',
    ideaId: 'idea-servicios-locales-001',
    sector: 'servicios-locales',
    durationSecondsEstimate: 35,
    title: 'Ventas garantizadas',
    hook: 'Con este sitio duplicas ventas garantizado.',
    bodyLines: ['Tenemos retorno de inversion garantizado.'],
    cta: 'Revisa zoositioweb.com.mx y pide tu sitio por WhatsApp.',
    approvedClaimIds: ['claim-one'],
    status: 'draft',
  });

  assert.equal(errors.some(error => error.includes('unsafe claim')), true);
});

test('record validators require cross-reference fields', () => {
  assert.equal(validateKnowledgeCardRecord({ id: 'knowledge-servicios-locales-001' }).length > 0, true);
  assert.equal(validateQaDecisionRecord({ scriptId: 'script-servicios-locales-001' }).length > 0, true);
  assert.equal(validateRenderQueueRecord({ id: 'render-servicios-locales-001' }).length > 0, true);
  assert.equal(validatePublishLogRecord({ renderId: 'render-servicios-locales-001' }).length > 0, true);
});

test('findUnsafeClaimHits scans nested string arrays', () => {
  const hits = findUnsafeClaimHits({
    bodyLines: ['Sin testimonio inventado.', 'Nada de ROI garantizado.'],
  });

  assert.deepEqual(hits.map(hit => hit.rule), ['fake-testimonial', 'guaranteed-roi']);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: FAIL because `tools/campaigns/zoositioweb/schema.mjs` does not exist.

- [ ] **Step 3: Implement `schema.mjs`**

Create `tools/campaigns/zoositioweb/schema.mjs` with exports named in the test. Use these constants and rules:

```js
export const SECTOR_IDS = new Set(['servicios-locales', 'consultorios', 'despachos']);
export const STATUS_VALUES = new Set(['draft', 'needs-review', 'approved', 'rejected', 'rendered', 'published']);
export const PRODUCT = 'zoositioweb.com.mx';

const UNSAFE_CLAIM_RULES = [
  { id: 'guaranteed-roi', regex: /\b(?:roi|retorno(?:\s+de\s+inversion)?|ventas?)\b.{0,40}\b(?:garantizad[oa]s?|asegurad[oa]s?|duplicar|triplicar)\b/i },
  { id: 'fake-testimonial', regex: /\b(?:testimonio|cliente\s+real|caso\s+real|historia\s+real)\b/i },
  { id: 'unsupported-free', regex: /\b(?:gratis|sin\s+costo|costo\s+cero)\b/i },
  { id: 'unsupported-numbered-claim', regex: /\b\d{2,3}%\b/i },
];
```

Implement validators as pure functions returning arrays of string errors. Required exported functions:

```js
parseJsonl(text, file)
findUnsafeClaimHits(value)
validateIdeaRecord(record)
validateScriptRecord(record)
validateKnowledgeCardRecord(record)
validateQaDecisionRecord(record)
validateRenderQueueRecord(record)
validatePublishLogRecord(record)
groupBy(values, keyFn)
```

Implementation requirements:

- `parseJsonl` returns `{ value, line, file }` entries for non-empty lines and throws an error containing the file and line number for invalid JSON.
- `findUnsafeClaimHits` recursively scans strings, arrays, and object values and returns `{ rule, text }` entries.
- Each `validate*Record` function returns an array of human-readable error strings and returns `[]` for a valid record.
- `validateScriptRecord` rejects duration estimates below 1 or above 45 seconds.
- Metric validators accept non-negative numbers and `null` for unavailable platform metrics.
- `groupBy` returns a `Map` keyed by the supplied callback.
- The final implementation must not import third-party packages.

- [ ] **Step 4: Run tests**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: PASS for `campaign-zoosite-schema.spec.mjs`; other campaign tests do not exist yet.

- [ ] **Step 5: Commit**

```powershell
git add tools/campaigns/zoositioweb/schema.mjs tools/tests/campaign-zoosite-schema.spec.mjs
git commit -m "Add Zoosite campaign schema validation"
```

## Task 3: Extract Approved Draft Claims

**Files:**
- Create: `tools/campaigns/zoositioweb/extract-approved-claims.mjs`
- Create: `tools/tests/campaign-zoosite-claim-extractor.spec.mjs`
- Generate: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/approved-claims.json`

- [ ] **Step 1: Write extractor tests**

Create a temp draft fixture with `default/i18n/es.json` and `sector-servicios-locales/i18n/es.json`. Assert the script exports `extractApprovedClaims()` and returns claim records with:

```js
{
  id: 'claim-default-i18n-es-json-001',
  sourceDraftPath: 'default/i18n/es.json',
  jsonPath: '$.hero.title',
  text: 'Consigue mas clientes con un sitio profesional.'
}
```

Also assert it ignores empty strings and arrays with only whitespace.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: FAIL because `extract-approved-claims.mjs` does not exist.

- [ ] **Step 3: Implement extractor**

Create `tools/campaigns/zoositioweb/extract-approved-claims.mjs`:

```js
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DRAFT_ROOT = path.resolve(process.cwd(), '..', 'draft-zoositioweb-com-mx');
const DEFAULT_OUTPUT = 'campaigns/zoositioweb/pilot-2026-05-sector-shortform/approved-claims.json';
const SOURCE_FILES = [
  'default/i18n/es.json',
  'sector-servicios-locales/i18n/es.json',
  'sector-consultorios/i18n/es.json',
  'sector-despachos/i18n/es.json',
  'planes/i18n/es.json',
  'servicios/i18n/es.json',
];
```

Required exported functions:

```js
parseArgs(rawArgs)
collectStrings(value, jsonPath = '$')
extractApprovedClaims({ draftRoot = DEFAULT_DRAFT_ROOT, sourceFiles = SOURCE_FILES } = {})
writeApprovedClaimsFile({ draftRoot, output = DEFAULT_OUTPUT } = {})
```

Implementation requirements:

- `parseArgs` supports `--draft-root=<path>` and `--output=<path>`.
- `collectStrings` returns `{ jsonPath, text }` for every non-empty string found in nested objects and arrays.
- `extractApprovedClaims` reads each source file, preserves `sourceDraftPath`, produces stable IDs by source file and sequence, and fails with an explicit error when a configured source file is missing.
- `writeApprovedClaimsFile` creates the output parent folder and writes pretty JSON.

The generated JSON shape must be:

```json
{
  "generatedAt": "2026-05-27T19:40:00.000Z",
  "draftRepo": "draft-zoositioweb-com-mx",
  "sourceFiles": ["default/i18n/es.json"],
  "claims": [
    {
      "id": "claim-default-i18n-es-json-001",
      "sourceDraftPath": "default/i18n/es.json",
      "jsonPath": "$.hero.title",
      "text": "Consigue mas clientes con un sitio profesional."
    }
  ]
}
```

Use the actual current timestamp when writing the file.

- [ ] **Step 4: Run extractor against the real draft repo**

Run:

```powershell
npm run campaign:zoosite:extract-claims -- --draft-root="../draft-zoositioweb-com-mx"
```

Expected: `approved-claims.json` exists and contains claims from all six source files.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add tools/campaigns/zoositioweb/extract-approved-claims.mjs tools/tests/campaign-zoosite-claim-extractor.spec.mjs campaigns/zoositioweb/pilot-2026-05-sector-shortform/approved-claims.json
git commit -m "Extract approved Zoosite campaign claims"
```

## Task 4: Validate The Full Pilot Dataset

**Files:**
- Create: `tools/campaigns/zoositioweb/validate-pilot.mjs`
- Create: `tools/tests/campaign-zoosite-validator.spec.mjs`

- [ ] **Step 1: Write validator tests**

Test cases:

- valid dataset with one idea, script, knowledge card, QA decision, render queue record, and publish record passes
- script with no matching idea fails
- render queue record for a script without approved QA fails
- knowledge card whose `sourceDraftPath` is not in `approved-claims.json` fails
- dataset with more than 9 render queue records fails

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: FAIL because `validate-pilot.mjs` does not exist.

- [ ] **Step 3: Implement validator**

Create `tools/campaigns/zoositioweb/validate-pilot.mjs` with:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseJsonl,
  validateIdeaRecord,
  validateKnowledgeCardRecord,
  validatePublishLogRecord,
  validateQaDecisionRecord,
  validateRenderQueueRecord,
  validateScriptRecord,
} from './schema.mjs';

export const DEFAULT_PILOT_DIR = 'campaigns/zoositioweb/pilot-2026-05-sector-shortform';
```

Required exports:

```js
readPilotDataset(pilotDir = DEFAULT_PILOT_DIR)
validatePilotDataset(dataset)
validatePilot({ pilotDir = DEFAULT_PILOT_DIR } = {})
```

Implementation requirements:

- `readPilotDataset` reads `sectors.json`, `approved-claims.json`, and every JSONL pilot file.
- `validatePilotDataset` returns `{ ok, errors }`.
- `validatePilot` reads from disk, validates, prints a success message on pass, prints each error on fail, and exits with code `1` in CLI mode when validation fails.

Rules:

- ideas must count exactly 30 once first batch is complete; before first batch, zero is allowed
- scripts must be zero or match idea count
- knowledge cards must be zero or match script count
- render queue must be zero or exactly 9
- render queue records must reference scripts with approved QA decisions
- publish log records must reference render IDs
- every `approvedClaimIds` value in a script must exist in `approved-claims.json`
- every `sourceDraftPath` in a knowledge card must exist in `approved-claims.json`

- [ ] **Step 4: Run initial validator**

Run:

```powershell
npm run campaign:zoosite:validate
```

Expected before content generation: PASS with message:

```text
Zoosite campaign pilot validation passed.
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add tools/campaigns/zoositioweb/validate-pilot.mjs tools/tests/campaign-zoosite-validator.spec.mjs
git commit -m "Validate Zoosite campaign pilot data"
```

## Task 5: Generate The 30-Idea Pilot Batch

**Files:**
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/ideas.jsonl`
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/scripts.jsonl`
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/knowledge-cards.jsonl`

- [ ] **Step 1: Generate 10 ideas per sector**

Create 30 records in `ideas.jsonl`:

- IDs `idea-servicios-locales-001` through `idea-servicios-locales-010`
- IDs `idea-consultorios-001` through `idea-consultorios-010`
- IDs `idea-despachos-001` through `idea-despachos-010`

Every idea must use `ctaProduct: "zoositioweb.com.mx"` and at least one source draft path from `sectors.json`.

- [ ] **Step 2: Generate matching script records**

Create 30 records in `scripts.jsonl`:

- one script per idea
- estimated duration between 20 and 45 seconds
- one hook, 2-3 body lines, and one CTA
- at least one `approvedClaimIds` entry copied from `approved-claims.json`
- no statistics unless the statistic exists in `approved-claims.json`
- no price mention unless the script cites a claim from `planes/i18n/es.json`

- [ ] **Step 3: Generate matching knowledge cards**

Create 30 records in `knowledge-cards.jsonl`:

- one card per script
- `blogPotential` is `high`, `medium`, or `low`
- `evidenceNeeded` is an array; use an empty array for draft-backed claims
- use non-empty `blogTitleCandidate` and `faqCandidate`
- mark market statistics or broad industry claims in `evidenceNeeded` instead of stating them as fact

- [ ] **Step 4: Validate generated content**

Run:

```powershell
npm run campaign:zoosite:validate
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add campaigns/zoositioweb/pilot-2026-05-sector-shortform/ideas.jsonl campaigns/zoositioweb/pilot-2026-05-sector-shortform/scripts.jsonl campaigns/zoositioweb/pilot-2026-05-sector-shortform/knowledge-cards.jsonl
git commit -m "Add Zoosite pilot campaign scripts"
```

## Task 6: Record Human QA And Build The 9-Item Render Queue

**Files:**
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/qa-decisions.jsonl`
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-queue.jsonl`

- [ ] **Step 1: Select three scripts per sector**

Choose exactly:

- 3 scripts from `servicios-locales`
- 3 scripts from `consultorios`
- 3 scripts from `despachos`

Prefer scripts with:

- clear useful explanation before CTA
- no price claim unless price is necessary
- high blog potential
- different hook types inside each sector

- [ ] **Step 2: Add QA decisions**

For each selected script, add one `qa-decisions.jsonl` record with all checks set to `true`, `decision: "approved"`, `reviewer: "Codex technical QA"`, and notes that final human approval remains required before MoneyPrinterTurbo rendering or publishing. For rejected scripts that were reviewed, add `decision: "rejected"` and write the exact reason in `notes`.

- [ ] **Step 3: Add render queue records**

For each Codex technical-QA approved script, add one human-gated `render-queue.jsonl` record:

```json
{"id":"render-servicios-locales-001","scriptId":"script-servicios-locales-001","sector":"servicios-locales","format":"vertical-9x16","voice":"manual-selection","assetSource":"approved-local-assets-only","captionStyle":"large-readable-spanish","status":"needs-review","humanApprovalRequired":true,"humanApprovalStatus":"pending","assetLicenseStatus":"pending-local-asset-selection","notes":"Render briefs may be prepared, but actual rendering requires human approval and local/license-verified assets."}
```

Use sequential IDs per sector.

- [ ] **Step 4: Validate render queue**

Run:

```powershell
npm run campaign:zoosite:validate
```

Expected: PASS with exactly 9 render queue records.

- [ ] **Step 5: Commit**

```powershell
git add campaigns/zoositioweb/pilot-2026-05-sector-shortform/qa-decisions.jsonl campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-queue.jsonl
git commit -m "Mark Zoosite render queue for human review"
```

## Task 7: Generate MoneyPrinterTurbo Render Briefs

**Files:**
- Create: `tools/campaigns/zoositioweb/build-render-briefs.mjs`
- Create: `tools/tests/campaign-zoosite-render-briefs.spec.mjs`
- Output: `devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-briefs/render-servicios-locales-001.md` and one sibling markdown file per render queue record

- [ ] **Step 1: Write render brief tests**

Test a fixture with one render queue record and one script. Assert the generated markdown includes:

- render ID
- sector
- script title
- hook
- body lines
- CTA
- voice
- asset source
- safety note: "Do not use untrusted uploaded media."

- [ ] **Step 2: Implement render brief builder**

Create `build-render-briefs.mjs` with exports:

```js
buildRenderBriefs({ pilotDir, outputDir } = {})
renderBriefMarkdown({ render, script, idea, knowledgeCard })
```

Implementation requirements:

- `buildRenderBriefs` writes one markdown file per render queue record.
- File names use `render-${render.id}.md`.
- `renderBriefMarkdown` includes render metadata, script text, CTA, knowledge card insight, and the safety note `Do not use untrusted uploaded media.`

Default output directory:

```text
devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-briefs
```

Render briefs must not call MoneyPrinterTurbo. They only prepare reviewed inputs for manual local rendering.

- [ ] **Step 3: Run tests**

Run:

```powershell
npm run test:campaign-zoosite
```

Expected: PASS.

- [ ] **Step 4: Generate briefs**

Run:

```powershell
npm run campaign:zoosite:render-briefs
```

Expected: 9 markdown files under ignored `devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-briefs`.

- [ ] **Step 5: Confirm generated briefs are ignored**

Run:

```powershell
git status --short devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-briefs
```

Expected: no output because `/devonly/` is already ignored.

- [ ] **Step 6: Commit**

```powershell
git add tools/campaigns/zoositioweb/build-render-briefs.mjs tools/tests/campaign-zoosite-render-briefs.spec.mjs
git commit -m "Generate Zoosite render briefs"
```

## Task 8: Build Learning Report And Blog Backlog

**Files:**
- Create: `tools/campaigns/zoositioweb/build-learning-report.mjs`
- Create: `tools/tests/campaign-zoosite-learning-report.spec.mjs`
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/learning-report.md`
- Modify: `campaigns/zoositioweb/pilot-2026-05-sector-shortform/blog-backlog.jsonl`

- [ ] **Step 1: Write report tests**

Test that the report builder:

- groups publish metrics by sector
- includes videos with no metrics as pending
- creates blog backlog records from knowledge cards with `blogPotential: "high"`
- cites `knowledgeCardId`, `scriptId`, and `sourceDraftPath` in every blog backlog record

- [ ] **Step 2: Implement report builder**

Create exports:

```js
buildLearningReport({ pilotDir } = {})
scoreBlogPriority(card, publishRecords)
```

Implementation requirements:

- `buildLearningReport` returns `{ markdown, blogBacklogLines }`.
- `blogBacklogLines` is an array of JSONL strings, one line per selected blog candidate.
- `scoreBlogPriority` returns `1` for high-potential cards with any publish engagement, `2` for high-potential cards without engagement, and `3` for medium-potential cards.

Report sections:

```markdown
# Zoositioweb Sector Short-Form Learning Report

Date: 2026-05-27 (Central Time)
Status: Pilot tracking

## Summary

## Sector Metrics

## Best Hooks

## Audience Questions

## Blog Backlog

## Next Actions
```

- [ ] **Step 3: Run report before publishing**

Run:

```powershell
npm run campaign:zoosite:report
```

Expected: `learning-report.md` says metrics are pending and `blog-backlog.jsonl` contains high-potential blog candidates from knowledge cards.

- [ ] **Step 4: Run tests and validator**

Run:

```powershell
npm run test:campaign-zoosite
npm run campaign:zoosite:validate
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tools/campaigns/zoositioweb/build-learning-report.mjs tools/tests/campaign-zoosite-learning-report.spec.mjs campaigns/zoositioweb/pilot-2026-05-sector-shortform/learning-report.md campaigns/zoositioweb/pilot-2026-05-sector-shortform/blog-backlog.jsonl
git commit -m "Build Zoosite campaign learning report"
```

## Task 9: Final Verification And Handoff

**Files:**
- Read-only verification across campaign tooling and data

- [ ] **Step 1: Run focused campaign tests**

```powershell
npm run test:campaign-zoosite
```

Expected: PASS.

- [ ] **Step 2: Run pilot validation**

```powershell
npm run campaign:zoosite:validate
```

Expected: PASS.

- [ ] **Step 3: Run broader repo smoke checks that do not require browser interaction**

```powershell
npm run test:draft-public-safety-audit
npm run test:draft-repo-preflight
```

Expected: PASS.

- [ ] **Step 4: Check git status**

```powershell
git status --short --branch
```

Expected: branch is ahead by the implementation commits and has no unstaged files outside ignored `devonly/`.

- [ ] **Step 5: Document the handoff in final response**

Report:

- exact commands run
- test results
- number of ideas, scripts, knowledge cards, approved renders, and blog backlog entries
- location of render briefs
- remaining manual steps before MoneyPrinterTurbo rendering

## Self-Review

Spec coverage:

- Local Docker-friendly workflow: Task 7 keeps MoneyPrinterTurbo inputs as local render briefs and does not expose services.
- Three sectors: Tasks 1, 5, and 6 lock `servicios-locales`, `consultorios`, and `despachos`.
- 30 ideas/scripts and 30 knowledge cards: Task 5.
- 9 render candidates: Task 6.
- No auto-publishing: Scope Boundary and Task 8 only track manual publishing.
- Blog/content reuse: Task 5 knowledge cards and Task 8 blog backlog.
- Cost controls: Task 6 limits rendered candidates; Task 7 avoids paid render calls by generating briefs only.
- Security controls: Tasks 2, 4, and 7 block unsafe claims and keep generated media ignored.

Placeholder scan:

- The plan avoids placeholder markers and unspecified file locations.
- The only human choices left are approved by the design: script approval, voice selection, asset selection, rendering, and publishing.

Type consistency:

- Record IDs, status values, sector IDs, and cross-reference keys are consistent across Data Contracts and tasks.
