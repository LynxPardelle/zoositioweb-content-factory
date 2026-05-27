import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';

export const DEFAULT_OUTPUT_DIR = 'devonly/campaigns/zoositioweb/pilot-2026-05-sector-shortform/render-briefs';
const SAFETY_NOTE = 'Do not use untrusted uploaded media.';
const SAFE_RENDER_ID_REGEX = /^render-[a-z0-9-]+-\d{3}$/;

export async function buildRenderBriefs({
  pilotDir = DEFAULT_PILOT_DIR,
  outputDir = DEFAULT_OUTPUT_DIR,
} = {}) {
  const dataset = await readPilotDataset(pilotDir);
  const resolvedOutputDir = path.resolve(outputDir);
  const scriptsById = new Map(dataset.scripts.map(script => [script.id, script]));
  const ideasById = new Map(dataset.ideas.map(idea => [idea.id, idea]));
  const knowledgeCardsByScriptId = new Map(
    dataset.knowledgeCards.map(card => [card.scriptId, card]),
  );
  const writtenFiles = [];

  await mkdir(resolvedOutputDir, { recursive: true });

  for (const render of dataset.renderQueue) {
    const script = scriptsById.get(render.scriptId);
    if (!script) {
      throw new Error(`Missing script for render ${render.id}: ${render.scriptId}`);
    }

    const idea = ideasById.get(script.ideaId);
    if (!idea) {
      throw new Error(`Missing idea for script ${script.id}: ${script.ideaId}`);
    }

    const knowledgeCard = knowledgeCardsByScriptId.get(script.id);
    if (!knowledgeCard) {
      throw new Error(`Missing knowledge card for script ${script.id}`);
    }

    const filePath = renderBriefFilePath({ renderId: render.id, resolvedOutputDir });
    await writeFile(filePath, renderBriefMarkdown({
      render,
      script,
      idea,
      knowledgeCard,
    }), 'utf8');
    writtenFiles.push(filePath);
  }

  return {
    count: writtenFiles.length,
    outputDir: resolvedOutputDir,
    files: writtenFiles,
  };
}

export function renderBriefMarkdown({ render, script, idea, knowledgeCard }) {
  const bodyLines = script.bodyLines.map(line => `- ${line}`).join('\n');

  return [
    `# MoneyPrinterTurbo Render Brief: ${render.id}`,
    '',
    '## Render Metadata',
    `- Render ID: ${render.id}`,
    `- Script ID: ${render.scriptId}`,
    `- Sector: ${render.sector}`,
    `- Format: ${render.format}`,
    `- Voice: ${render.voice}`,
    `- Caption style: ${render.captionStyle}`,
    `- Status: ${render.status}`,
    `- Human approval required: ${String(render.humanApprovalRequired)}`,
    `- Human approval status: ${valueOrPending(render.humanApprovalStatus)}`,
    `- Asset source: ${render.assetSource}`,
    `- Asset license status: ${valueOrPending(render.assetLicenseStatus)}`,
    '',
    '## Human Gate',
    '- This is a pre-render brief for human review, not final render approval.',
    `- Notes: ${valueOrPending(render.notes)}`,
    '',
    '## Script',
    `- Title: ${script.title}`,
    `- Duration estimate: ${script.durationSecondsEstimate} seconds`,
    `- Hook: ${script.hook}`,
    '',
    '### Body Lines',
    bodyLines,
    '',
    '### CTA',
    script.cta,
    '',
    '## Campaign Context',
    `- Idea ID: ${idea.id}`,
    `- Useful angle: ${valueOrPending(idea.usefulAngle)}`,
    `- Knowledge card ID: ${knowledgeCard.id}`,
    `- Insight: ${knowledgeCard.insight}`,
    `- Approved product claim: ${knowledgeCard.approvedProductClaim}`,
    `- Source draft path: ${knowledgeCard.sourceDraftPath}`,
    '',
    '## Safety',
    `- ${SAFETY_NOTE}`,
    '- Use only local assets whose rights and licenses have been verified.',
    '- Do not run MoneyPrinterTurbo from this brief generator.',
    '',
  ].join('\n');
}

function renderBriefFilePath({ renderId, resolvedOutputDir }) {
  if (!SAFE_RENDER_ID_REGEX.test(renderId)) {
    throw new Error(`Unsafe render ID for output filename: ${renderId}`);
  }

  const filePath = path.resolve(resolvedOutputDir, `${renderId}.md`);
  const relativePath = path.relative(resolvedOutputDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Resolved render brief path escaped output directory: ${filePath}`);
  }

  return filePath;
}

function valueOrPending(value) {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  return 'pending';
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliMode()) {
  try {
    const result = await buildRenderBriefs();
    console.log(`Generated ${result.count} render briefs in ${result.outputDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
