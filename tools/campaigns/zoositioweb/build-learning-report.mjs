import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_PILOT_DIR, readPilotDataset } from './validate-pilot.mjs';

const REPORT_FILE = 'learning-report.md';
const BLOG_BACKLOG_FILE = 'blog-backlog.jsonl';
const REPORT_DATE = '2026-05-27 (Central Time)';
const METRIC_FIELDS = [
  'views',
  'likes',
  'comments',
  'saves',
  'shares',
  'profileVisits',
  'linkClicks',
  'whatsappConversations',
];

export async function buildLearningReport({ pilotDir = DEFAULT_PILOT_DIR } = {}) {
  const dataset = await readPilotDataset(pilotDir);
  const scriptsById = new Map(dataset.scripts.map(script => [script.id, script]));
  const renderQueueById = new Map(dataset.renderQueue.map(render => [render.id, render]));
  const publishRecordsByRenderId = groupPublishRecordsByRenderId(dataset.publishLog);
  const publishRecordsByScriptId = new Map();

  for (const record of dataset.publishLog) {
    const render = renderQueueById.get(record.renderId);

    if (!render) {
      continue;
    }

    const records = publishRecordsByScriptId.get(render.scriptId) ?? [];
    records.push(record);
    publishRecordsByScriptId.set(render.scriptId, records);
  }

  const blogBacklogLines = buildBlogBacklogLines({
    knowledgeCards: dataset.knowledgeCards,
    publishRecordsByScriptId,
  });
  const markdown = learningReportMarkdown({
    dataset,
    scriptsById,
    publishRecordsByRenderId,
    publishRecordsByScriptId,
    blogBacklogLines,
  });

  return {
    markdown,
    blogBacklogLines,
  };
}

export function scoreBlogPriority(card, publishRecords) {
  if (card?.blogPotential === 'high' && hasPublishEngagement(publishRecords)) {
    return 1;
  }

  if (card?.blogPotential === 'high') {
    return 2;
  }

  if (card?.blogPotential === 'medium') {
    return 3;
  }

  return 4;
}

function buildBlogBacklogLines({ knowledgeCards, publishRecordsByScriptId }) {
  const seenTitles = new Set();
  const candidates = [];

  for (const card of knowledgeCards) {
    if (card.blogPotential !== 'high') {
      continue;
    }

    const title = card.blogTitleCandidate.trim();

    if (seenTitles.has(title)) {
      continue;
    }

    seenTitles.add(title);
    const publishRecords = publishRecordsByScriptId.get(card.scriptId) ?? [];

    candidates.push({
      id: `blog-${card.id}`,
      priority: scoreBlogPriority(card, publishRecords),
      title,
      sector: card.sector,
      knowledgeCardId: card.id,
      scriptId: card.scriptId,
      sourceDraftPath: card.sourceDraftPath,
      faqCandidate: card.faqCandidate,
      status: 'candidate',
      notes: blogCandidateNotes(card, publishRecords),
    });
  }

  candidates.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if (left.sector !== right.sector) {
      return left.sector.localeCompare(right.sector);
    }

    return left.id.localeCompare(right.id);
  });

  return candidates.map(candidate => JSON.stringify(candidate));
}

function learningReportMarkdown({
  dataset,
  scriptsById,
  publishRecordsByRenderId,
  publishRecordsByScriptId,
  blogBacklogLines,
}) {
  const publishLogEmpty = dataset.publishLog.length === 0;

  return [
    '# Zoositioweb Sector Short-Form Learning Report',
    '',
    `Date: ${REPORT_DATE}`,
    'Status: Pilot tracking',
    '',
    '## Summary',
    '',
    publishLogEmpty
      ? '- Render/publish metrics are pending. No videos have been rendered or published in this pilot log.'
      : `- Publish metrics are populated for ${dataset.publishLog.length} published video record(s).`,
    '- Final human approval is still required before rendering any queued video.',
    `- Blog backlog candidates generated from high-potential knowledge cards: ${blogBacklogLines.length}.`,
    '',
    '## Sector Metrics',
    '',
    ...sectorMetricLines({ dataset, publishRecordsByRenderId }),
    '',
    '## Best Hooks',
    '',
    ...bestHookLines({ dataset, scriptsById, publishRecordsByScriptId }),
    '',
    '## Audience Questions',
    '',
    ...audienceQuestionLines(dataset.knowledgeCards),
    '',
    '## Blog Backlog',
    '',
    ...blogBacklogMarkdownLines(blogBacklogLines),
    '',
    '## Next Actions',
    '',
    '- Keep render queue human-gated; do not render until final approval and asset license checks are complete.',
    '- Publish no performance winner claims until real publish metrics exist.',
    '- Use the blog backlog as candidate research topics for zoositioweb.com.mx content.',
    '',
  ].join('\n');
}

function sectorMetricLines({ dataset, publishRecordsByRenderId }) {
  const lines = [];

  for (const sector of sectorRecords(dataset.sectors)) {
    const renders = dataset.renderQueue.filter(render => render.sector === sector.id);
    const publishedRecords = renders.flatMap(render => publishRecordsByRenderId.get(render.id) ?? []);
    const pendingRenders = renders.filter(render => (publishRecordsByRenderId.get(render.id) ?? []).length === 0);
    const totals = sumMetrics(publishedRecords);
    const summary = `${sector.id}: ${publishedRecords.length} published, ${pendingRenders.length} pending metrics`;

    if (publishedRecords.length === 0) {
      lines.push(`- ${summary}.`);
    } else {
      lines.push(`- ${summary}, ${totals.views} views, ${totals.likes} likes, ${totals.comments} comments, ${totals.shares} shares, ${totals.linkClicks} link clicks, ${totals.whatsappConversations} WhatsApp conversations.`);
    }

    for (const render of pendingRenders) {
      lines.push(`  - ${render.id} (${render.scriptId}): metrics pending.`);
    }
  }

  if (lines.length === 0) {
    return ['- No render queue records found; metrics are pending.'];
  }

  return lines;
}

function groupPublishRecordsByRenderId(publishLog) {
  const grouped = new Map();

  for (const record of publishLog) {
    const records = grouped.get(record.renderId) ?? [];
    records.push(record);
    grouped.set(record.renderId, records);
  }

  return grouped;
}

function sectorRecords(sectors) {
  if (Array.isArray(sectors)) {
    return sectors;
  }

  if (Array.isArray(sectors?.sectors)) {
    return sectors.sectors;
  }

  return [];
}

function bestHookLines({ dataset, scriptsById, publishRecordsByScriptId }) {
  if (dataset.publishLog.length === 0) {
    return ['- Pending: no published videos or engagement metrics yet.'];
  }

  const scoredHooks = dataset.renderQueue.flatMap(render => {
    const script = scriptsById.get(render.scriptId);
    const publishRecords = publishRecordsByScriptId.get(render.scriptId) ?? [];

    if (!script || publishRecords.length === 0) {
      return [];
    }

    return [{
      script,
      engagement: engagementScore(publishRecords),
    }];
  });

  if (scoredHooks.length === 0) {
    return ['- Pending: no hook-level publish metrics are available yet.'];
  }

  return scoredHooks
    .sort((left, right) => right.engagement - left.engagement || left.script.id.localeCompare(right.script.id))
    .map(item => `- ${item.script.title} (${item.script.id}): ${item.script.hook} Engagement score: ${item.engagement}.`);
}

function audienceQuestionLines(knowledgeCards) {
  const highCards = knowledgeCards.filter(card => card.blogPotential === 'high');

  if (highCards.length === 0) {
    return ['- No high-potential audience questions found yet.'];
  }

  return highCards.map(card => `- ${card.sector}: ${card.faqCandidate} (${card.id})`);
}

function blogBacklogMarkdownLines(blogBacklogLines) {
  if (blogBacklogLines.length === 0) {
    return ['- No high-potential blog candidates found yet.'];
  }

  return blogBacklogLines.map(line => {
    const record = JSON.parse(line);

    return `- P${record.priority} ${record.title} (${record.sector}) - ${record.knowledgeCardId}, ${record.scriptId}, ${record.sourceDraftPath}`;
  });
}

function blogCandidateNotes(card, publishRecords) {
  if (hasPublishEngagement(publishRecords)) {
    return 'High-potential knowledge card with publish engagement. Expand only with sourced evidence and pilot-safe claims.';
  }

  return 'High-potential knowledge card. Metrics pending; expand only with sourced evidence and pilot-safe claims.';
}

function hasPublishEngagement(publishRecords) {
  return publishRecords.some(record => engagementScore([record]) > 0);
}

function engagementScore(publishRecords) {
  return publishRecords.reduce((total, record) => (
    total
      + metricValue(record.views)
      + metricValue(record.likes)
      + metricValue(record.comments)
      + metricValue(record.saves)
      + metricValue(record.shares)
      + metricValue(record.profileVisits)
      + metricValue(record.linkClicks)
      + metricValue(record.whatsappConversations)
  ), 0);
}

function sumMetrics(records) {
  const totals = Object.fromEntries(METRIC_FIELDS.map(field => [field, 0]));

  for (const record of records) {
    for (const field of METRIC_FIELDS) {
      totals[field] += metricValue(record[field]);
    }
  }

  return totals;
}

function metricValue(value) {
  return Number.isFinite(value) ? value : 0;
}

async function writeLearningReport({ pilotDir = DEFAULT_PILOT_DIR } = {}) {
  const result = await buildLearningReport({ pilotDir });
  const resolvedPilotDir = path.resolve(pilotDir);

  await writeFile(path.join(resolvedPilotDir, REPORT_FILE), result.markdown, 'utf8');
  await writeFile(
    path.join(resolvedPilotDir, BLOG_BACKLOG_FILE),
    result.blogBacklogLines.length === 0 ? '' : `${result.blogBacklogLines.join('\n')}\n`,
    'utf8',
  );

  return result;
}

function isCliMode() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliMode()) {
  try {
    const result = await writeLearningReport();
    console.log(`Generated learning report and ${result.blogBacklogLines.length} blog backlog candidate(s).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
