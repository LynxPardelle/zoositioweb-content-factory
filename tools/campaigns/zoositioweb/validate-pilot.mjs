import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseJsonl,
  validateAssetPickRecord,
  validateIdeaRecord,
  validateKnowledgeCardRecord,
  validatePublishLogRecord,
  validateQaDecisionRecord,
  validateRenderQueueRecord,
  validateScriptRecord,
} from './schema.mjs';

export const DEFAULT_PILOT_DIR = 'campaigns/zoositioweb/pilot-2026-05-sector-shortform';

const JSONL_FILES = [
  ['ideas', 'ideas.jsonl', validateIdeaRecord],
  ['scripts', 'scripts.jsonl', validateScriptRecord],
  ['knowledgeCards', 'knowledge-cards.jsonl', validateKnowledgeCardRecord],
  ['qaDecisions', 'qa-decisions.jsonl', validateQaDecisionRecord],
  ['renderQueue', 'render-queue.jsonl', validateRenderQueueRecord],
  ['assetPicks', 'asset-picks.jsonl', validateAssetPickRecord, { optional: true }],
  ['publishLog', 'publish-log.jsonl', validatePublishLogRecord],
  ['blogBacklog', 'blog-backlog.jsonl', null],
];

const REQUIRED_QA_CHECK_KEYS = [
  'under45Seconds',
  'sectorClear',
  'usefulBeforeCta',
  'rightProductCta',
  'noUnsupportedRoi',
  'noFakeTestimonial',
  'noDraftContradiction',
  'statisticsSourcedOrRemoved',
];

export async function readPilotDataset(pilotDir = DEFAULT_PILOT_DIR) {
  const resolvedPilotDir = path.resolve(pilotDir);
  const sectors = JSON.parse(await readFile(path.join(resolvedPilotDir, 'sectors.json'), 'utf8'));
  const approvedClaims = JSON.parse(await readFile(path.join(resolvedPilotDir, 'approved-claims.json'), 'utf8'));
  const dataset = {
    sectors,
    approvedClaims,
  };

  for (const [key, file, , options] of JSONL_FILES) {
    const filePath = path.join(resolvedPilotDir, file);
    const records = await readJsonlFile({ filePath, file, optional: options?.optional === true });
    dataset[key] = records.map(record => record.value);
  }

  return dataset;
}

async function readJsonlFile({ filePath, file, optional }) {
  try {
    return parseJsonl(await readFile(filePath, 'utf8'), file);
  } catch (error) {
    if (optional && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

export function validatePilotDataset(dataset) {
  const errors = [];
  const ideas = dataset?.ideas ?? [];
  const scripts = dataset?.scripts ?? [];
  const knowledgeCards = dataset?.knowledgeCards ?? [];
  const qaDecisions = dataset?.qaDecisions ?? [];
  const renderQueue = dataset?.renderQueue ?? [];
  const assetPicks = dataset?.assetPicks ?? [];
  const publishLog = dataset?.publishLog ?? [];
  const approvedClaims = Array.isArray(dataset?.approvedClaims?.claims) ? dataset.approvedClaims.claims : [];
  const approvedClaimIds = new Set(approvedClaims.map(claim => claim.id));
  const approvedSourceDraftPaths = new Set(approvedClaims.map(claim => claim.sourceDraftPath));
  const ideaIds = new Set(ideas.map(idea => idea.id));
  const scriptIds = new Set(scripts.map(script => script.id));
  const approvedQaScriptIds = new Set(
    qaDecisions
      .filter(isApprovedQaDecisionForRender)
      .map(decision => decision.scriptId),
  );
  const renderIds = new Set(renderQueue.map(record => record.id));

  validateRecords(errors, 'ideas.jsonl', ideas, validateIdeaRecord);
  validateRecords(errors, 'scripts.jsonl', scripts, validateScriptRecord);
  validateRecords(errors, 'knowledge-cards.jsonl', knowledgeCards, validateKnowledgeCardRecord);
  validateRecords(errors, 'qa-decisions.jsonl', qaDecisions, validateQaDecisionRecord);
  validateRecords(errors, 'render-queue.jsonl', renderQueue, validateRenderQueueRecord);
  validateRecords(errors, 'asset-picks.jsonl', assetPicks, validateAssetPickRecord);
  validateRecords(errors, 'publish-log.jsonl', publishLog, validatePublishLogRecord);

  if (ideas.length !== 0 || scripts.length !== 0 || knowledgeCards.length !== 0) {
    if (ideas.length !== 30 || scripts.length !== 30 || knowledgeCards.length !== 30) {
      errors.push(`content stage must contain exactly 30 ideas, 30 scripts, and 30 knowledge cards once content exists; found ${ideas.length} ideas, ${scripts.length} scripts, and ${knowledgeCards.length} knowledge cards`);
    }
  }

  if (renderQueue.length !== 0 && renderQueue.length !== 9) {
    errors.push(`render queue must contain 0 or exactly 9 records; found ${renderQueue.length}`);
  }

  for (const script of scripts) {
    if (!ideaIds.has(script.ideaId)) {
      errors.push(`scripts.jsonl record ${script.id} has missing matching idea: ${script.ideaId}`);
    }

    for (const claimId of script.approvedClaimIds ?? []) {
      if (!approvedClaimIds.has(claimId)) {
        errors.push(`scripts.jsonl record ${script.id} references missing approved claim: ${claimId}`);
      }
    }
  }

  for (const card of knowledgeCards) {
    if (!scriptIds.has(card.scriptId)) {
      errors.push(`knowledge-cards.jsonl record ${card.id} references missing script: ${card.scriptId}`);
    }

    if (!approvedSourceDraftPaths.has(card.sourceDraftPath)) {
      errors.push(`knowledge-cards.jsonl record ${card.id} has sourceDraftPath not found in approved-claims.json: ${card.sourceDraftPath}`);
    }
  }

  for (const record of qaDecisions) {
    if (!scriptIds.has(record.scriptId)) {
      errors.push(`qa-decisions.jsonl record for ${record.scriptId} references missing script`);
    }
  }

  for (const record of renderQueue) {
    if (!scriptIds.has(record.scriptId)) {
      errors.push(`render-queue.jsonl record ${record.id} references missing script: ${record.scriptId}`);
      continue;
    }

    if (!approvedQaScriptIds.has(record.scriptId)) {
      errors.push(`render-queue.jsonl record ${record.id} references script without approved QA decision with complete QA checklist set to true: ${record.scriptId}`);
    }
  }

  for (const record of assetPicks) {
    if (!renderIds.has(record.renderId)) {
      errors.push(`asset-picks.jsonl record ${record.id} references missing render ID: ${record.renderId}`);
    }

    if (!scriptIds.has(record.scriptId)) {
      errors.push(`asset-picks.jsonl record ${record.id} references missing script: ${record.scriptId}`);
    }
  }

  for (const record of publishLog) {
    if (!renderIds.has(record.renderId)) {
      errors.push(`publish-log.jsonl record references missing render ID: ${record.renderId}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function validatePilot({ pilotDir = DEFAULT_PILOT_DIR } = {}) {
  const dataset = await readPilotDataset(pilotDir);
  const result = validatePilotDataset(dataset);

  if (result.ok) {
    console.log('Zoosite campaign pilot validation passed.');
    return result;
  }

  for (const error of result.errors) {
    console.error(error);
  }

  if (isCliMode()) {
    process.exitCode = 1;
  }

  return result;
}

function isApprovedQaDecisionForRender(decision) {
  return decision.decision === 'approved'
    && REQUIRED_QA_CHECK_KEYS.every(key => decision.checks?.[key] === true);
}

function validateRecords(errors, file, records, validateRecord) {
  if (!Array.isArray(records)) {
    errors.push(`${file} records must be an array`);
    return;
  }

  for (const [index, record] of records.entries()) {
    for (const error of validateRecord(record)) {
      errors.push(`${file} record ${index + 1}: ${error}`);
    }
  }
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliMode()) {
  try {
    await validatePilot();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
