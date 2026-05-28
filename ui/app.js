const tabs = [
  { id: 'overview', label: 'Overview', icon: iconHome },
  { id: 'scripts', label: 'Scripts', icon: iconFile },
  { id: 'knowledge', label: 'Knowledge', icon: iconBook },
  { id: 'assets', label: 'Assets', icon: iconImage },
  { id: 'render', label: 'Render Queue', icon: iconPlay },
  { id: 'blog', label: 'Blog Backlog', icon: iconEdit },
  { id: 'report', label: 'Report', icon: iconChart },
];

let state = {
  data: null,
  activeTab: 'overview',
  query: '',
  sector: 'all',
  status: 'all',
  selectedScriptId: null,
  selectedRenderId: null,
};

const elements = {
  sideNav: document.querySelector('#sideNav'),
  tabs: document.querySelector('#tabs'),
  metrics: document.querySelector('#metrics'),
  primaryPanel: document.querySelector('#primaryPanel'),
  detailPanel: document.querySelector('#detailPanel'),
  searchInput: document.querySelector('#searchInput'),
  sectorFilter: document.querySelector('#sectorFilter'),
  statusFilter: document.querySelector('#statusFilter'),
  refreshButton: document.querySelector('#refreshButton'),
  pilotMeta: document.querySelector('#pilotMeta'),
  validationStatus: document.querySelector('#validationStatus'),
};

elements.searchInput.addEventListener('input', event => {
  state.query = event.target.value;
  render();
});

elements.sectorFilter.addEventListener('change', event => {
  state.sector = event.target.value;
  render();
});

elements.statusFilter.addEventListener('change', event => {
  state.status = event.target.value;
  render();
});

elements.refreshButton.addEventListener('click', load);

await load();

async function load() {
  elements.primaryPanel.innerHTML = '<div class="empty">Cargando datos de campaña</div>';
  elements.detailPanel.innerHTML = '<p class="muted">Preparando vista.</p>';

  const response = await fetch('/api/data', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los datos: ${response.status}`);
  }

  state.data = await response.json();
  state.selectedScriptId = state.data.scripts[0]?.id || null;
  state.selectedRenderId = state.data.renderQueue[0]?.id || null;
  renderShell();
  render();
}

function renderShell() {
  elements.pilotMeta.textContent = `${state.data.product} · ${state.data.pilotId}`;
  elements.validationStatus.textContent = state.data.validation.ok ? 'Datos validos' : 'Datos con errores';
  document.querySelector('.status-dot').classList.toggle('error', !state.data.validation.ok);

  elements.sideNav.innerHTML = tabs.map(tab => navButton(tab)).join('');
  elements.tabs.innerHTML = tabs.map(tab => tabButton(tab)).join('');
  elements.sideNav.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });
  elements.tabs.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });

  elements.sectorFilter.innerHTML = [
    '<option value="all">Todos</option>',
    ...state.data.sectors.map(sector => `<option value="${escapeHtml(sector.id)}">${escapeHtml(sector.label)}</option>`),
  ].join('');
}

function render() {
  if (!state.data) {
    return;
  }

  renderMetrics();
  syncActiveButtons();

  if (state.activeTab === 'overview') {
    renderOverview();
  } else if (state.activeTab === 'scripts') {
    renderScripts();
  } else if (state.activeTab === 'knowledge') {
    renderKnowledge();
  } else if (state.activeTab === 'assets') {
    renderAssets();
  } else if (state.activeTab === 'render') {
    renderRenderQueue();
  } else if (state.activeTab === 'blog') {
    renderBlogBacklog();
  } else if (state.activeTab === 'report') {
    renderReport();
  }

  renderDetail();
}

function renderMetrics() {
  const metrics = [
    ['Approved Claims', state.data.metrics.approvedClaims, 'copy source snapshot'],
    ['Ideas', state.data.metrics.ideas, 'sector pilot'],
    ['Scripts', state.data.metrics.scripts, 'short-form records'],
    ['Render Queue', state.data.metrics.renderQueue, 'human-gated'],
    ['Assets', state.data.metrics.assetPicks, 'selected picks'],
    ['Candidates', state.data.metrics.assetCandidates, 'API suggestions'],
    ['Blog Backlog', state.data.metrics.blogBacklog, 'candidate topics'],
    ['Publish Log', state.data.metrics.publishLog, 'published records'],
  ];

  elements.metrics.innerHTML = metrics.map(([label, value, hint]) => `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join('');
}

function renderOverview() {
  const bySector = state.data.sectors.map(sector => {
    const scripts = state.data.scripts.filter(script => script.sector === sector.id).length;
    const renders = state.data.renderQueue.filter(render => render.sector === sector.id).length;
    const blogs = state.data.blogBacklog.filter(item => item.sector === sector.id).length;

    return `
      <article class="summary-block">
        <h3>${escapeHtml(sector.label)}</h3>
        <p>${scripts} scripts · ${renders} renders · ${blogs} blogs</p>
      </article>
    `;
  }).join('');

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Pipeline del piloto</h2>
        <p>Estado operativo de campaña para ${escapeHtml(state.data.product)}</p>
      </div>
      ${state.data.validation.ok ? badge('Validation passed', 'green') : badge(`${state.data.validation.errors.length} errors`, 'red')}
    </div>
    <div class="overview-grid">
      <article class="summary-block">
        <h3>Contenido listo para revision</h3>
        <p>${state.data.metrics.scripts} scripts y ${state.data.metrics.knowledgeCards} knowledge cards ya estan cargados.</p>
      </article>
      <article class="summary-block">
        <h3>Render bloqueado por seguridad</h3>
        <p>${state.data.metrics.renderQueue} candidatos requieren aprobacion humana y assets con licencia revisada.</p>
      </article>
      <article class="summary-block">
        <h3>Aprendizaje pendiente</h3>
        <p>${state.data.metrics.publishLog} registros publicados; aun no hay metricas reales del piloto.</p>
      </article>
      ${bySector}
    </div>
  `;
}

function renderScripts() {
  const scripts = filteredScripts();

  if (!scripts.some(script => script.id === state.selectedScriptId)) {
    state.selectedScriptId = scripts[0]?.id || null;
  }

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Scripts</h2>
        <p>${scripts.length} de ${state.data.scripts.length} registros visibles</p>
      </div>
      ${badge('Max 45s', 'blue')}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Titulo</th>
            <th>Sector</th>
            <th>Estado</th>
            <th>QA</th>
            <th>Render</th>
          </tr>
        </thead>
        <tbody>
          ${scripts.map(scriptRow).join('')}
        </tbody>
      </table>
    </div>
  `;

  elements.primaryPanel.querySelectorAll('tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedScriptId = row.dataset.scriptId;
      render();
    });
  });
}

function renderKnowledge() {
  const cards = state.data.knowledgeCards.filter(card => recordMatches(card));

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Knowledge Cards</h2>
        <p>${cards.length} cards filtradas</p>
      </div>
      ${badge('Blog source', 'green')}
    </div>
    <div class="stack">
      ${cards.map(card => `
        <article class="list-item">
          <div class="split-line">
            <strong>${escapeHtml(card.blogTitleCandidate)}</strong>
            ${badge(card.blogPotential, card.blogPotential === 'high' ? 'green' : 'amber')}
          </div>
          <p>${escapeHtml(card.insight)}</p>
          <div class="badge-row">
            ${badge(card.sector)}
            ${badge(card.scriptId, 'blue')}
            ${badge(card.sourceDraftPath)}
          </div>
        </article>
      `).join('') || emptyState('No hay knowledge cards con estos filtros.')}
    </div>
  `;
}

function renderAssets() {
  const assets = state.data.assetPicks.filter(asset => recordMatches(asset));
  const candidates = state.data.assetCandidates.filter(asset => recordMatches(asset));

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Assets</h2>
        <p>${candidates.length} candidatos API · ${assets.length} picks registrados</p>
      </div>
      ${badge('Pexels / Pixabay only', 'blue')}
    </div>
    <div class="stack">
      ${candidates.map(candidate => `
        <article class="list-item asset-card">
          ${candidate.previewImageUrl ? `<img src="${escapeHtml(candidate.previewImageUrl)}" alt="">` : '<div class="asset-placeholder">Sin preview</div>'}
          <div>
            <div class="split-line">
              <strong>${escapeHtml(candidate.renderId)}</strong>
              ${badge(candidate.status, 'amber')}
            </div>
            <p>${escapeHtml(candidate.query)} · ${escapeHtml(candidate.creator)}</p>
            <div class="badge-row">
              ${badge(candidate.source, candidate.source === 'pexels' ? 'blue' : 'green')}
              ${badge(candidate.mediaType)}
              ${badge(candidate.orientation)}
              ${badge(candidate.sector)}
            </div>
            ${candidate.sourcePageUrl ? `<a class="text-link" href="${escapeHtml(candidate.sourcePageUrl)}" target="_blank" rel="noreferrer">Abrir fuente</a>` : ''}
          </div>
        </article>
      `).join('')}
      ${assets.map(asset => `
        <article class="list-item">
          <div class="split-line">
            <strong>${escapeHtml(asset.id)}</strong>
            ${badge(asset.status, asset.status === 'selected' ? 'green' : 'amber')}
          </div>
          <p>${escapeHtml(asset.notes || asset.sourcePageUrl)}</p>
          <div class="badge-row">
            ${badge(asset.source, asset.source === 'pexels' ? 'blue' : 'green')}
            ${badge(asset.mediaType)}
            ${badge(asset.sector)}
            ${badge(asset.renderId, 'blue')}
          </div>
        </article>
      `).join('') || (candidates.length === 0 ? emptyState('No hay assets seleccionados todavia.') : '')}
    </div>
  `;
}

function renderRenderQueue() {
  const records = state.data.renderQueue.filter(record => recordMatches(record));

  if (!records.some(record => record.id === state.selectedRenderId)) {
    state.selectedRenderId = records[0]?.id || null;
    state.selectedScriptId = records[0]?.scriptId || state.selectedScriptId;
  }

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Render Queue</h2>
        <p>${records.length} candidatos con aprobacion humana pendiente</p>
      </div>
      ${badge('No auto-render', 'amber')}
    </div>
    <div class="table-wrap">
      <table class="compact-table">
        <thead>
          <tr>
            <th>Render</th>
            <th>Script</th>
            <th>Sector</th>
            <th>Assets</th>
            <th>Aprobacion</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(render => `
            <tr data-render-id="${escapeHtml(render.id)}" class="${render.id === state.selectedRenderId ? 'selected' : ''}">
              <td class="title-cell"><strong>${escapeHtml(render.id)}</strong><span>${escapeHtml(render.format)}</span></td>
              <td>${escapeHtml(render.scriptId)}</td>
              <td>${badge(render.sector)}</td>
              <td>${badge(shortStatus(render.assetLicenseStatus), 'amber')}</td>
              <td>${badge(shortStatus(render.humanApprovalStatus), 'amber')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  elements.primaryPanel.querySelectorAll('tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedRenderId = row.dataset.renderId;
      const render = state.data.renderQueue.find(item => item.id === state.selectedRenderId);
      state.selectedScriptId = render?.scriptId || state.selectedScriptId;
      render();
    });
  });
}

function renderBlogBacklog() {
  const posts = state.data.blogBacklog.filter(post => recordMatches(post));

  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Blog Backlog</h2>
        <p>${posts.length} candidatos para zoositioweb.com.mx</p>
      </div>
      ${badge('Needs sources', 'blue')}
    </div>
    <div class="stack">
      ${posts.map(post => `
        <article class="list-item">
          <div class="split-line">
            <strong>P${post.priority} · ${escapeHtml(post.title)}</strong>
            ${badge(post.status, 'amber')}
          </div>
          <p>${escapeHtml(post.faqCandidate)}</p>
          <div class="badge-row">
            ${badge(post.sector)}
            ${badge(post.scriptId, 'blue')}
            ${badge(post.knowledgeCardId, 'green')}
          </div>
        </article>
      `).join('') || emptyState('No hay candidatos de blog con estos filtros.')}
    </div>
  `;
}

function renderReport() {
  elements.primaryPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Learning Report</h2>
        <p>Reporte generado desde el piloto local</p>
      </div>
      ${badge('Metrics pending', 'amber')}
    </div>
    <pre class="report">${escapeHtml(state.data.learningReport || 'No hay reporte generado.')}</pre>
  `;
}

function renderDetail() {
  if (state.activeTab === 'render') {
    const brief = state.data.renderBriefs.find(item => item.id === state.selectedRenderId);
    elements.detailPanel.innerHTML = brief ? `
      <h2>${escapeHtml(brief.id)}</h2>
      <p>${escapeHtml(brief.scriptId)} · ${escapeHtml(brief.sector)}</p>
      <div class="script-block">
        <h3>Render brief preview</h3>
        <pre class="brief">${escapeHtml(brief.markdown)}</pre>
      </div>
    ` : emptyState('Selecciona un render para ver el brief.');
    return;
  }

  const script = state.data.scripts.find(item => item.id === state.selectedScriptId) || filteredScripts()[0];

  if (!script) {
    elements.detailPanel.innerHTML = emptyState('Selecciona un script para ver el detalle.');
    return;
  }

  state.selectedScriptId = script.id;
  const qaClass = script.qaDecision?.decision === 'approved' ? 'green' : 'amber';

  elements.detailPanel.innerHTML = `
    <h2>${escapeHtml(script.title)}</h2>
    <p>${escapeHtml(script.id)} · ${escapeHtml(script.sector)} · ${script.durationSecondsEstimate}s</p>
    <div class="script-block">
      <h3>Hook</h3>
      <p>${escapeHtml(script.hook)}</p>
    </div>
    <div class="script-block">
      <h3>Body</h3>
      <ol>${script.bodyLines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ol>
    </div>
    <div class="script-block">
      <h3>CTA</h3>
      <p>${escapeHtml(script.cta)}</p>
    </div>
    <div class="script-block">
      <h3>QA y seguridad</h3>
      <div class="badge-row">
        ${badge(script.status)}
        ${badge(script.qaDecision?.decision || 'sin QA', qaClass)}
        ${script.renderQueue ? badge('en render queue', 'blue') : badge('sin render')}
      </div>
      <p>${escapeHtml(script.qaDecision?.notes || 'Sin notas de QA.')}</p>
    </div>
    <div class="script-block">
      <h3>Blog / research</h3>
      <p>${escapeHtml(script.knowledgeCard?.faqCandidate || 'Sin pregunta candidata.')}</p>
      <p>${escapeHtml(script.knowledgeCard?.blogTitleCandidate || 'Sin titulo candidato.')}</p>
    </div>
  `;
}

function scriptRow(script) {
  return `
    <tr data-script-id="${escapeHtml(script.id)}" class="${script.id === state.selectedScriptId ? 'selected' : ''}">
      <td class="title-cell"><strong>${escapeHtml(script.title)}</strong><span>${escapeHtml(script.hook)}</span></td>
      <td>${badge(script.sector)}</td>
      <td>${badge(script.status)}</td>
      <td>${badge(script.qaDecision?.decision || 'sin QA', script.qaDecision?.decision === 'approved' ? 'green' : 'amber')}</td>
      <td>${script.renderQueue ? badge(script.renderQueue.id, 'blue') : badge('pendiente')}</td>
    </tr>
  `;
}

function filteredScripts() {
  return state.data.scripts.filter(script => recordMatches(script));
}

function recordMatches(record) {
  const query = state.query.trim().toLowerCase();

  if (state.sector !== 'all' && record.sector !== state.sector) {
    return false;
  }

  if (state.status !== 'all' && record.status !== state.status) {
    return false;
  }

  if (query === '') {
    return true;
  }

  return JSON.stringify(record).toLowerCase().includes(query);
}

function setTab(tab) {
  state.activeTab = tab;
  render();
}

function syncActiveButtons() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.activeTab);
  });
}

function navButton(tab) {
  return `<button type="button" data-tab="${tab.id}" class="${tab.id === state.activeTab ? 'active' : ''}">${tab.icon()}<span>${tab.label}</span></button>`;
}

function tabButton(tab) {
  return `<button type="button" role="tab" data-tab="${tab.id}" class="tab-button ${tab.id === state.activeTab ? 'active' : ''}">${tab.label}</button>`;
}

function badge(text, tone = '') {
  return `<span class="badge ${tone}">${escapeHtml(String(text))}</span>`;
}

function shortStatus(value) {
  const labels = new Map([
    ['pending-local-asset-selection', 'license pending'],
    ['needs-review', 'needs review'],
  ]);

  return labels.get(value) || value;
}

function emptyState(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function svg(paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

function iconHome() {
  return svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/>');
}

function iconFile() {
  return svg('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h4"/>');
}

function iconBook() {
  return svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H7a3 3 0 0 0-3 3z"/><path d="M4 5.5V21"/><path d="M8 7h8"/><path d="M8 11h8"/>');
}

function iconImage() {
  return svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 15 3-3 3 3 2-2 4 4"/><circle cx="9" cy="9" r="1.5"/>');
}

function iconPlay() {
  return svg('<path d="M8 5v14l11-7z"/>');
}

function iconEdit() {
  return svg('<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13 6 5 5"/>');
}

function iconChart() {
  return svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4"/><path d="M12 15V8"/><path d="M16 15v-6"/>');
}
