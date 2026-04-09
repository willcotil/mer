import { svgEl } from './utils.js';

const EDGE_COLOR = '#475569';
const EDGE_SW    = 1.8;

// ─── Public ───────────────────────────────────────────────────────────────────

export function createEdgeGroup(edge, srcNode, tgtNode) {
  const g = svgEl('g', { 'data-id': edge.id, 'data-kind': 'edge', class: 'mer-edge' });
  _render(g, edge, srcNode, tgtNode);
  return g;
}

export function updateEdgeGroup(g, edge, srcNode, tgtNode) {
  g.replaceChildren();
  _render(g, edge, srcNode, tgtNode);
}

// Progress edge while connecting (canvas coords, inside viewport)
export function createProgressEdge(from, to) {
  const g = svgEl('g', { id: 'progress-edge', 'pointer-events': 'none' });
  g.appendChild(svgEl('path', {
    d: _d2(from, to), fill: 'none',
    stroke: '#3b82f6', 'stroke-width': 1.5, 'stroke-dasharray': '6 3',
    'pointer-events': 'none',
  }));
  return g;
}

export function updateProgressEdge(g, from, to) {
  const p = g.querySelector('path');
  if (p) p.setAttribute('d', _d2(from, to));
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function _render(g, edge, src, tgt) {
  if (!src || !tgt) return;

  const from = { x: src.x + src.width  / 2, y: src.y + src.height / 2 };
  const to   = { x: tgt.x + tgt.width  / 2, y: tgt.y + tgt.height / 2 };
  const pts  = [from, ...(edge.waypoints || []), to];
  const d   = _dPoly(pts);

  // Invisible wide hit area
  g.appendChild(svgEl('path', {
    d, fill: 'none', stroke: 'transparent',
    'stroke-width': 14, 'pointer-events': 'stroke', class: 'edge-hit',
  }));

  const srcTotal = edge.sourceParticipation === 'total';
  const tgtTotal = edge.targetParticipation === 'total';

  // Main line
  g.appendChild(svgEl('path', {
    d, fill: 'none', stroke: EDGE_COLOR, 'stroke-width': EDGE_SW,
    'pointer-events': 'none', class: 'edge-visual',
  }));

  // Double lines for total participation (parallel segment near entity end)
  if (srcTotal) _parallelSeg(g, pts[0], pts[1] ?? pts[0]);
  if (tgtTotal) _parallelSeg(g, pts[pts.length - 1], pts[pts.length - 2] ?? pts[pts.length - 1]);

  // Cardinality labels
  if (edge.sourceCardinality) _cardLabel(g, pts[0],              pts[1] ?? pts[0],              edge.sourceCardinality);
  if (edge.targetCardinality) _cardLabel(g, pts[pts.length - 1], pts[pts.length - 2] ?? pts[0], edge.targetCardinality);
}

// Draw a second line parallel to the edge segment, near `pt` pointing toward `toward`
// This represents "total participation" (double line near entity)
function _parallelSeg(g, pt, toward) {
  const dx  = toward.x - pt.x, dy = toward.y - pt.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const nx  = dx / len, ny = dy / len;       // unit along edge
  const px  = -ny, py = nx;                  // unit perpendicular
  const off = 2.8;                            // perpendicular offset
  const segLen = Math.min(len * 0.45, 36);   // how far along edge to draw

  // Both parallel lines (offset ±off perpendicular)
  for (const s of [-1, 1]) {
    const ox = px * off * s, oy = py * off * s;
    g.appendChild(svgEl('line', {
      x1: pt.x + ox,              y1: pt.y + oy,
      x2: pt.x + nx*segLen + ox,  y2: pt.y + ny*segLen + oy,
      stroke: EDGE_COLOR, 'stroke-width': EDGE_SW,
      'pointer-events': 'none',
    }));
  }
}

function _cardLabel(g, near, farPt, card) {
  if (!card) return;
  const dx = farPt.x - near.x, dy = farPt.y - near.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const t  = Math.min(0.22, 30 / len);
  const lx = near.x + dx * t,  ly = near.y + dy * t;
  const px = -dy / len,         py = dx / len;   // perpendicular
  const el = svgEl('text', {
    x: lx + px * 16, y: ly + py * 16,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': 12, 'font-weight': '700',
    'font-family': '"Inter","Segoe UI",ui-sans-serif,system-ui,sans-serif',
    fill: '#0f172a', 'pointer-events': 'none',
  });
  el.textContent = card;
  g.appendChild(el);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function _dPoly(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d;
}

function _d2(a, b) { return `M ${a.x} ${a.y} L ${b.x} ${b.y}`; }
