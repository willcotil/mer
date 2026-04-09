// ─── ID generation ────────────────────────────────────────────────────────────

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Deep clone ───────────────────────────────────────────────────────────────

export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Coordinate transforms ────────────────────────────────────────────────────

// screen (clientX/Y) → canvas world coordinates
export function screenToCanvas(clientX, clientY, svgEl, canvas) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left - canvas.offsetX) / canvas.scale,
    y: (clientY - rect.top  - canvas.offsetY) / canvas.scale,
  };
}

// canvas world → SVG local coordinates (for overlay elements outside viewport)
export function canvasToSVG(cx, cy, canvas) {
  return {
    x: cx * canvas.scale + canvas.offsetX,
    y: cy * canvas.scale + canvas.offsetY,
  };
}

// ─── SVG element factory ──────────────────────────────────────────────────────

export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  }
  return el;
}

// ─── Text measurement ─────────────────────────────────────────────────────────

let _mSvg = null;
let _mText = null;

function _initMeasure() {
  if (_mSvg) return;
  _mSvg  = svgEl('svg');
  _mText = svgEl('text', { 'font-size': '14', 'font-family': '"Inter","Segoe UI",ui-sans-serif,system-ui,sans-serif' });
  _mSvg.style.cssText = 'position:absolute;top:-9999px;left:-9999px;pointer-events:none;visibility:hidden;width:0;height:0;overflow:hidden';
  _mSvg.appendChild(_mText);
  document.body.appendChild(_mSvg);
}

export function measureText(text, fontSize = 14, fontWeight = 'normal') {
  _initMeasure();
  _mText.setAttribute('font-size', fontSize);
  _mText.setAttribute('font-weight', fontWeight);
  _mText.textContent = text || '\u00a0';
  try {
    const b = _mText.getBBox();
    return { width: Math.ceil(b.width) + 2, height: Math.ceil(b.height) };
  } catch {
    return { width: Math.max(60, (text || '').length * 8), height: 16 };
  }
}

// ─── Auto-size by kind ────────────────────────────────────────────────────────

export function computeAutoSize(label, kind) {
  const { width: tw } = measureText(label || '', 14, kind === 'entity' || kind === 'weak_entity' ? '600' : 'normal');
  switch (kind) {
    case 'entity':
    case 'weak_entity':
      return { width: Math.max(120, tw + 48), height: 46 };
    case 'attribute':
      return { width: Math.max(100, tw + 50), height: 36 };
    case 'relationship':
    case 'weak_relationship': {
      const rw = Math.max(140, tw + 64);
      return { width: rw, height: Math.max(72, Math.round(rw * 0.56)) };
    }
    case 'aggregation':
      return { width: 240, height: 180 };
    case 'generalization':
      return { width: 64, height: 54 };
    default:
      return { width: 120, height: 50 };
  }
}

// ─── HTML escaping ────────────────────────────────────────────────────────────

export function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
