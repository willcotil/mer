import { state }                               from './state.js';
import { history }                             from './history.js';
import { initRenderer }                        from './renderer.js';
import { initInteraction }                     from './interaction.js';
import { initToolbox }                         from './toolbox.js';
import { initPanel }                           from './panel.js';
import { saveToFile, loadFromFile, newDiagram } from './serializer.js';
import { showDataDictionary }                  from './dictionary.js';

// ─── Persistence (localStorage) ───────────────────────────────────────────────

const LS_CONSENT = 'mer-consent';
const LS_SAVE    = 'mer-autosave';
let   _saveTimer  = null;

function _hasConsent() { return localStorage.getItem(LS_CONSENT) === '1'; }

function _autoSave() {
  if (!_hasConsent()) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_SAVE, JSON.stringify(state.toSnapshot()));
    } catch { /* quota exceeded — silently ignore */ }
  }, 800);
}

function _loadSaved() {
  try {
    const raw = localStorage.getItem(LS_SAVE);
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (snap?.nodes) state.loadSnapshot(snap);
  } catch { /* corrupted data — ignore */ }
}

function _initConsent() {
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;

  if (_hasConsent()) {
    // Consent already given — load saved diagram and enable auto-save
    _loadSaved();
    state.on('change', _autoSave);
    return;
  }

  // Show the banner
  banner.classList.add('visible');

  document.getElementById('cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem(LS_CONSENT, '1');
    banner.classList.remove('visible');
    _loadSaved();
    state.on('change', _autoSave);
  });

  document.getElementById('cookie-decline')?.addEventListener('click', () => {
    banner.classList.remove('visible');
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const svg      = document.getElementById('mer-canvas');
  const viewport = document.getElementById('viewport');
  const nodesLyr = document.getElementById('nodes-layer');
  const edgesLyr = document.getElementById('edges-layer');
  const overlay  = document.getElementById('overlay-layer');
  const panel    = document.getElementById('properties-panel');

  // Init all modules
  initRenderer(svg, viewport, nodesLyr, edgesLyr, overlay);
  initInteraction(svg, overlay);
  initToolbox(svg);
  initPanel(panel);

  // Toolbar buttons
  _wire('btn-new',      () => newDiagram());
  _wire('btn-open',     () => loadFromFile());
  _wire('btn-save',     () => saveToFile());
  _wire('btn-undo',     () => history.undo());
  _wire('btn-redo',     () => history.redo());
  _wire('btn-props',    () => _toggleProps());
  _wire('btn-download', () => _downloadSVG());
  _wire('btn-dict',     () => showDataDictionary());
  _wire('btn-print',    () => _print());
  _wire('btn-zoom-in',  () => _zoom(1.25));
  _wire('btn-zoom-out', () => _zoom(0.8));
  _wire('btn-zoom-fit', () => _fitAll());
  _wire('btn-zoom-reset', () => state.setCanvas({ offsetX: 0, offsetY: 0, scale: 1 }));

  // Dialog
  _wire('dict-close', () => document.getElementById('dict-dialog')?.close());
  _wire('dict-print', () => _printDict());

  // Status updates
  state.on('selection-change', _updateStatus);
  state.on('canvas-change',    _updateStatus);
  state.on('change',           _updateStatus);

  // Print hooks
  window.addEventListener('beforeprint', _beforePrint);
  window.addEventListener('afterprint',  _afterPrint);

  // Dirty indicator
  state.on('change', () => {
    const t = document.getElementById('dirty-dot');
    if (t) t.style.display = state.dirty ? 'inline' : 'none';
  });

  // Initial undo/redo button state
  document.getElementById('btn-undo')?.setAttribute('disabled', '');
  document.getElementById('btn-redo')?.setAttribute('disabled', '');

  _updateStatus();
  _initConsent();
});

// ─── Zoom ─────────────────────────────────────────────────────────────────────

function _zoom(factor) {
  const svg  = document.getElementById('mer-canvas');
  const rect = svg.getBoundingClientRect();
  const cx   = rect.width  / 2;
  const cy   = rect.height / 2;
  const ns   = Math.max(0.08, Math.min(6, state.canvas.scale * factor));
  const r    = ns / state.canvas.scale;
  state.setCanvas({
    scale:   ns,
    offsetX: cx - (cx - state.canvas.offsetX) * r,
    offsetY: cy - (cy - state.canvas.offsetY) * r,
  });
}

function _fitAll() {
  const nodes = Array.from(state.nodes.values());
  if (!nodes.length) { state.setCanvas({ offsetX: 60, offsetY: 60, scale: 1 }); return; }
  const svg  = document.getElementById('mer-canvas');
  const rect = svg.getBoundingClientRect();
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);         minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x+n.width); maxY = Math.max(maxY, n.y+n.height);
  }
  const pad = 60;
  const cW  = maxX - minX + pad * 2;
  const cH  = maxY - minY + pad * 2;
  const sc  = Math.min(rect.width/cW, rect.height/cH, 2);
  state.setCanvas({
    scale:   sc,
    offsetX: (rect.width  - cW * sc) / 2 - (minX - pad) * sc,
    offsetY: (rect.height - cH * sc) / 2 - (minY - pad) * sc,
  });
}

// ─── Print ────────────────────────────────────────────────────────────────────

let _savedCanvas = null;

function _print() { window.print(); }

function _beforePrint() {
  const svg  = document.getElementById('mer-canvas');
  if (!svg) return;
  _savedCanvas = { ...state.canvas };

  const nodes = Array.from(state.nodes.values());
  if (!nodes.length) return;

  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);         minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x+n.width); maxY = Math.max(maxY, n.y+n.height);
  }
  const pad = 40;
  svg.setAttribute('viewBox', `${minX-pad} ${minY-pad} ${maxX-minX+pad*2} ${maxY-minY+pad*2}`);
  document.getElementById('viewport')?.setAttribute('transform', '');
  document.getElementById('overlay-layer')?.replaceChildren();
}

function _afterPrint() {
  const svg = document.getElementById('mer-canvas');
  if (!svg) return;
  svg.removeAttribute('viewBox');
  if (_savedCanvas) { state.setCanvas(_savedCanvas); _savedCanvas = null; }
}

function _printDict() {
  // Print only the dialog content
  const content = document.getElementById('dict-content')?.innerHTML || '';
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Dicionário de Dados</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; padding: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
      th { background: #f1f5f9; font-weight: 600; color: #475569; }
      tr:hover { background: #f8fafc; }
      h3 { margin: 24px 0 8px; font-size: 15px; }
      .dict-cell { padding: 6px 10px; }
    </style>
  </head><body>${content}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

// ─── Properties panel toggle (mobile) ────────────────────────────────────────

function _toggleProps(forceOpen) {
  const panel    = document.getElementById('aside-props');
  const backdrop = document.getElementById('props-backdrop');
  if (!panel) return;
  const open = forceOpen ?? !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  backdrop?.classList.toggle('open', open);
}

document.getElementById('props-backdrop')
  ?.addEventListener('click', () => _toggleProps(false));

// ─── Download SVG ─────────────────────────────────────────────────────────────

function _downloadSVG() {
  const svg = document.getElementById('mer-canvas');
  if (!svg) return;

  const nodes = Array.from(state.nodes.values());
  if (!nodes.length) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);          minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
  }
  const pad = 40;
  const vx = minX - pad, vy = minY - pad;
  const vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;

  // Clone and prepare for export
  const clone = svg.cloneNode(true);
  clone.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
  clone.setAttribute('width',  vw);
  clone.setAttribute('height', vh);
  clone.removeAttribute('class');

  // Reset viewport transform (clone already has the transform; remove it so viewBox does the work)
  const vp = clone.querySelector('#viewport');
  if (vp) vp.removeAttribute('transform');

  // Remove interactive-only layers
  clone.querySelector('#canvas-bg')?.remove();
  clone.querySelector('#overlay-layer')?.replaceChildren();
  clone.querySelector('#canvas-overlay')?.replaceChildren();

  // Add white background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', vx); bg.setAttribute('y', vy);
  bg.setAttribute('width', vw); bg.setAttribute('height', vh);
  bg.setAttribute('fill', '#ffffff');
  clone.querySelector('#edges-layer')?.before(bg);

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'diagrama.svg';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function _updateStatus() {
  const zEl = document.getElementById('status-zoom');
  const sEl = document.getElementById('status-sel');
  const nEl = document.getElementById('status-nodes');
  if (zEl) zEl.textContent = `${Math.round(state.canvas.scale * 100)}%`;
  if (sEl) sEl.textContent = state.selection.size > 0
    ? `${state.selection.size} selecionado(s)` : '';
  if (nEl) nEl.textContent = `${state.nodes.size} nó(s) · ${state.edges.size} conexão(ões)`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
