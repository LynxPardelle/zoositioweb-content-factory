# Zoositioweb Sector Campaign Factory Design

**Date**: 2026-05-27 13:34 Central Time
**Status**: Approved for implementation by user on 2026-05-27 13:40 Central Time
**Repos in scope**:

- `zoositioweb-content-factory` repo, with `zoolandingpage` and draft repos as product-copy sources
- `draft-zoositioweb-com-mx` sibling repo
- `MoneyPrinterTurbo local workspace clone`

## Decision Summary

Build a local, Docker-first campaign factory for `zoositioweb.com.mx` that creates short-form vertical campaign scripts and reusable knowledge notes for future blog/content work. The pilot targets three sectors:

- servicios locales
- consultorios
- despachos

The pilot produces 30 approved script candidates, selects 9 for rendering, publishes manually, and records learning before adding deeper automation.

## Goals

- Generate informative short-form videos that naturally sell `zoositioweb.com.mx`.
- Reuse approved product copy from the `draft-zoositioweb-com-mx` draft instead of inventing new claims.
- Capture every useful insight as structured knowledge that can later become blog posts, FAQ entries, long-form pages, carousels, or email/WhatsApp follow-ups.
- Keep API and render costs low by generating many cheap drafts but rendering only manually approved scripts.
- Use Codex as a campaign operator/editor/reviewer, not as the real-time LLM backend inside MoneyPrinterTurbo.
- Keep MoneyPrinterTurbo isolated in Docker Desktop and bound to local interfaces.

## Non-Goals

- No automatic publishing in the pilot.
- No Upload-Post integration in the pilot.
- No changes to live draft content or Angular runtime behavior in this phase.
- No internet-exposed MoneyPrinterTurbo service.
- No processing of third-party uploaded media from untrusted users.
- No unsupported claims, fake testimonials, guaranteed ROI statements, or unverified market statistics.

## Source Of Truth

Campaign copy must start from the current public product/draft material:

- `draft-zoositioweb-com-mx/default/i18n/es.json`
- `draft-zoositioweb-com-mx/sector-servicios-locales/i18n/es.json`
- `draft-zoositioweb-com-mx/sector-consultorios/i18n/es.json`
- `draft-zoositioweb-com-mx/sector-despachos/i18n/es.json`
- `draft-zoositioweb-com-mx/planes/i18n/es.json`
- `draft-zoositioweb-com-mx/servicios/i18n/es.json`

Useful approved product facts:

- `zoositioweb.com.mx` sells complete websites for businesses.
- Published plans are `Presencia`, `Clientes`, and `Crecimiento`.
- Prices are before IVA and the service is invoiceable.
- First test round can be ready in 5 days only when base scope and materials are complete.
- WhatsApp is the first contact path.
- Core advantages are clear content, sector pages, mobile-ready design, human support, cloud infrastructure, and first-party interaction data.

## Pilot Output

For each of the three sectors:

- 10 short-form ideas.
- 10 script candidates.
- 3 selected scripts for rendering.
- 3 rendered vertical videos.
- 3 publication records after manual posting.
- 10 knowledge cards that can later feed blog/content work.

Total pilot:

- 30 ideas/scripts.
- 9 rendered videos.
- 30 knowledge cards.
- 1 cross-sector learning report.

## Video Format

Target platforms:

- TikTok
- Instagram Reels
- YouTube Shorts

Format:

- Vertical 9:16.
- 20-45 seconds.
- Spanish first.
- Informative tone with a soft commercial close.
- One clear CTA.

Script structure:

1. Hook: sector-specific problem or mistake.
2. Useful explanation: 2-3 clear points.
3. Commercial bridge: why a site should clarify this.
4. CTA: visit `zoositioweb.com.mx` or send WhatsApp message.

## Sector Angles

### Servicios Locales

Messaging basis:

- Visitors need to know service, zone, hours, availability, and how to request a quote.
- WhatsApp should carry first context such as service requested and customer location.
- First-party data helps see which services or routes receive attention.

Example content angles:

- Why "atiendo en toda la ciudad" is weaker than clear service zones.
- What a local-service website should answer before the first WhatsApp.
- Why service photos and process matter before asking for a quote.

### Consultorios

Messaging basis:

- Patients need services, location, hours, team, and first appointment path.
- A consultorio page should make trust and next steps clear.
- FAQs reduce friction before contact.

Example content angles:

- What patients check before booking a first appointment.
- Why specialties and location should be visible immediately.
- How WhatsApp can start with useful context instead of a vague "info".

### Despachos

Messaging basis:

- Clients need areas of practice, experience, process, and serious presentation.
- Professional copy matters because visitors compare trust signals.
- Contact should make the first conversation more focused.

Example content angles:

- Why a despacho website should explain practice areas clearly.
- What makes a professional services website feel serious.
- How process information improves first-contact quality.

## Knowledge Capture

Each script must create a knowledge card, even if it is not rendered.

Proposed fields:

- `id`
- `sector`
- `audience`
- `problem`
- `insight`
- `approvedProductClaim`
- `sourceDraftPath`
- `ctaProduct`
- `scriptId`
- `blogPotential`
- `blogTitleCandidate`
- `faqCandidate`
- `evidenceNeeded`
- `status`

Knowledge cards are not marketing copy by default. They are reusable research/content notes. If a claim needs market evidence, it must be marked as `evidenceNeeded` instead of being published as fact.

Proposed local folder, to be created during implementation:

```text
campaigns/zoositioweb/
  README.md
  pilot-2026-05-sector-shortform/
    sectors.json
    ideas.jsonl
    scripts.jsonl
    knowledge-cards.jsonl
    qa-decisions.jsonl
    render-queue.jsonl
    publish-log.jsonl
    learning-report.md
```

## Agent Roles

Codex should handle:

- Extracting approved claims from draft JSON.
- Creating sector idea batches.
- Turning ideas into first-draft scripts.
- Checking scripts against product claims and safety rules.
- Producing knowledge cards.
- Preparing render queue entries.
- Summarizing metrics after manual posting.
- Suggesting blog/content opportunities from repeated insights.

MoneyPrinterTurbo should handle:

- Local video rendering only.
- Vertical output generation from approved scripts.
- Material retrieval only from configured safe sources or approved local assets.

Human approval remains required for:

- Final sector priorities.
- Script approval before rendering.
- Video approval before posting.
- Any change to product claims, pricing, guarantees, or legal/compliance wording.
- Any move from manual publishing to automation.

## Cost Controls

- Render only 9 videos in the first pilot.
- Do not call paid TTS/LLM providers for every idea if Codex can prepare the first batch from existing draft copy.
- Prefer local approved assets or free media sources first.
- Disable auto-posting until there is performance evidence.
- Track provider, token/character cost, render time, and output status per rendered video.

## QA Gates

Before script approval:

- The script is under 45 seconds.
- The sector is clear.
- The useful portion comes before the sales CTA.
- The CTA points to the right product.
- No unsupported ROI guarantee.
- No fake testimonial or invented case.
- No claim that contradicts draft copy.
- Any statistic or external market claim has a source or is removed.

Before rendering:

- Script approved.
- Voice/style selected.
- Asset source selected.
- CTA line approved.
- No untrusted media input.

Before publishing:

- Video plays fully.
- Captions are readable.
- Audio is understandable.
- CTA is visible or spoken.
- No broken text, incorrect price, wrong sector, or unsupported claim.

## Metrics

Track manually for the pilot:

- platform
- publish date
- sector
- hook type
- video duration
- views
- 3-second retention if available
- average watch time if available
- likes/comments/saves/shares
- profile visits
- link clicks if available
- WhatsApp conversations attributed manually
- notes about comments/questions

Success criteria for moving to the next stage:

- At least one sector produces repeated signs of engagement or qualified questions.
- At least three knowledge cards are good enough to become blog outlines.
- Render cost and time are predictable.
- Manual QA finds no serious brand, legal, or claim issues.

## Blog And Content Reuse

The knowledge cards should produce a blog backlog such as:

- "Que debe tener el sitio web de un servicio local para recibir mejores solicitudes"
- "Como presentar un consultorio en internet sin depender solo de redes sociales"
- "Que debe explicar el sitio web de un despacho antes del primer contacto"

Blog candidates should be based on repeated campaign insights, not random keyword stuffing. Each future blog outline should cite its source knowledge cards and draft paths.

## Risks

- Generic AI video output may look low-quality if too much is automated too early.
- Platform algorithms may reward entertainment more than informative selling.
- Unsupported claims could damage trust.
- MoneyPrinterTurbo still depends on MoviePy/Pillow, so untrusted media inputs remain a risk.
- Publishing too many similar videos may reduce perceived brand quality.

## Open Implementation Questions

- Which exact local asset set should the pilot use first?
- Which TTS voice should represent the brand?
- Should the first scripts mention prices, or should price stay mostly on landing pages?
- Which manual metric source will be the first source of truth: platform exports, screenshots, or a simple local log?

## Approval Gate

This design is ready for user review. After approval, the next step is an implementation plan that breaks the work into atomic, committable tasks.
