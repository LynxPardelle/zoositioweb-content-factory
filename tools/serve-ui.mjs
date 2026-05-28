import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderBriefMarkdown } from './campaigns/zoositioweb/build-render-briefs.mjs';
import { DEFAULT_PILOT_DIR, readPilotDataset, validatePilotDataset } from './campaigns/zoositioweb/validate-pilot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const UI_ROOT = path.join(REPO_ROOT, 'ui');
const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.PORT || 48210);
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${HOST}`);

    if (request.method !== 'GET') {
      send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return;
    }

    if (url.pathname === '/api/data') {
      sendJson(response, await campaignPayload());
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  }
});

listenWithFallback(server, DEFAULT_PORT);

async function campaignPayload() {
  const dataset = await readPilotDataset(DEFAULT_PILOT_DIR);
  const validation = validatePilotDataset(dataset);
  const learningReportPath = path.join(REPO_ROOT, DEFAULT_PILOT_DIR, 'learning-report.md');
  const learningReport = existsSync(learningReportPath)
    ? await readFile(learningReportPath, 'utf8')
    : '';
  const sectors = Array.isArray(dataset.sectors?.sectors) ? dataset.sectors.sectors : dataset.sectors;
  const scriptsById = new Map(dataset.scripts.map(script => [script.id, script]));
  const ideasById = new Map(dataset.ideas.map(idea => [idea.id, idea]));
  const qaByScriptId = new Map(dataset.qaDecisions.map(decision => [decision.scriptId, decision]));
  const renderByScriptId = new Map(dataset.renderQueue.map(record => [record.scriptId, record]));
  const knowledgeByScriptId = new Map(dataset.knowledgeCards.map(card => [card.scriptId, card]));
  const renderBriefs = dataset.renderQueue.map(render => {
    const script = scriptsById.get(render.scriptId);
    const idea = script ? ideasById.get(script.ideaId) : null;
    const knowledgeCard = script ? knowledgeByScriptId.get(script.id) : null;

    return {
      id: render.id,
      scriptId: render.scriptId,
      sector: render.sector,
      markdown: script && idea && knowledgeCard
        ? renderBriefMarkdown({ render, script, idea, knowledgeCard })
        : '',
    };
  });

  const scripts = dataset.scripts.map(script => ({
    ...script,
    idea: ideasById.get(script.ideaId) || null,
    qaDecision: qaByScriptId.get(script.id) || null,
    renderQueue: renderByScriptId.get(script.id) || null,
    knowledgeCard: knowledgeByScriptId.get(script.id) || null,
  }));

  return {
    product: dataset.sectors?.product || 'zoositioweb.com.mx',
    pilotId: dataset.sectors?.pilotId || path.basename(DEFAULT_PILOT_DIR),
    generatedAt: new Date().toISOString(),
    validation,
    metrics: {
      sectors: sectors.length,
      approvedClaims: dataset.approvedClaims.claims.length,
      ideas: dataset.ideas.length,
      scripts: dataset.scripts.length,
      knowledgeCards: dataset.knowledgeCards.length,
      qaDecisions: dataset.qaDecisions.length,
      renderQueue: dataset.renderQueue.length,
      assetPicks: dataset.assetPicks.length,
      blogBacklog: dataset.blogBacklog.length,
      publishLog: dataset.publishLog.length,
    },
    sectors,
    scripts,
    ideas: dataset.ideas,
    knowledgeCards: dataset.knowledgeCards,
    qaDecisions: dataset.qaDecisions,
    renderQueue: dataset.renderQueue,
    assetPicks: dataset.assetPicks,
    renderBriefs,
    blogBacklog: dataset.blogBacklog,
    publishLog: dataset.publishLog,
    learningReport,
  };
}

async function serveStatic(requestPath, response) {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const resolvedPath = path.resolve(UI_ROOT, `.${decodedPath}`);
  const relativePath = path.relative(UI_ROOT, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    send(response, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  const content = await readFile(resolvedPath);
  send(response, 200, content, MIME_TYPES.get(path.extname(resolvedPath)) || 'application/octet-stream');
}

function listenWithFallback(targetServer, port, attempts = 0) {
  targetServer.once('error', error => {
    if (error.code === 'EADDRINUSE' && attempts < 20) {
      listenWithFallback(targetServer, port + 1, attempts + 1);
      return;
    }

    console.error(error.message);
    process.exitCode = 1;
  });

  targetServer.listen(port, HOST, () => {
    const address = targetServer.address();
    console.log(`Zoositioweb Content Factory UI running at http://${HOST}:${address.port}/`);
  });
}

function sendJson(response, payload, status = 200) {
  send(response, status, JSON.stringify(payload, null, 2), 'application/json; charset=utf-8');
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}
