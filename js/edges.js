import { svgEl } from './utils.js';
import { closestAnchors } from './shapes.js';

const EDGE_COLOR = '#475569';
const EDGE_SW    = 1.8;

// ─── Public ───────────────────────────────────────────────────────────────────

export function createEdgeGroup(edge, srcNode, tgtNode, cardLabelsLayer, parallelOffset = 0) {
  const g = svgEl('g', { 'data-id': edge.id, 'data-kind': 'edge', class: 'mer-edge' });
  _render(g, edge, srcNode, tgtNode, cardLabelsLayer, parallelOffset);
  return g;
}

export function updateEdgeGroup(g, edge, srcNode, tgtNode, cardLabelsLayer, parallelOffset = 0) {
  const edgeId = g.getAttribute('data-id');
  if (cardLabelsLayer && edgeId) {
    cardLabelsLayer.querySelectorAll(`[data-edge-id="${edgeId}"]`).forEach(el => el.remove());
  }
  g.replaceChildren();
  _render(g, edge, srcNode, tgtNode, cardLabelsLayer, parallelOffset);
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

function _render(g, edge, src, tgt, cardLabelsLayer, parallelOffset = 0) {
  if (!src || !tgt) return;
  if (src === tgt) { _renderSelfLoop(g, edge, src, cardLabelsLayer); return; }

  const from = { x: src.x + src.width / 2, y: src.y + src.height / 2 };
  const to   = { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 };

  // Parallel edges: quadratic bezier offset perpendicularly so both lines are visible.
  // Index 0 → straight; 1 → +offset; 2 → -offset; 3 → +2×offset; …
  let d, pts;
  let perpX = 0, perpY = 0;   // perpendicular shift applied to cardinality labels

  if (parallelOffset === 0) {
    pts = [from, ...(edge.waypoints || []), to];
    d   = _dPoly(pts);
  } else {
    const dx  = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const sign  = parallelOffset % 2 === 1 ? 1 : -1;
    const steps = Math.ceil(parallelOffset / 2);
    const amt   = steps * 44 * sign;     // world-unit perpendicular displacement
    if (len > 0) {
      // Unit perpendicular (rotated 90° CCW from the edge direction)
      const ux = -dy / len, uy = dx / len;
      const mx = (from.x + to.x) / 2 + ux * amt;
      const my = (from.y + to.y) / 2 + uy * amt;
      d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
      // Labels shift half the curve displacement so they don't sit on top of each other
      perpX = ux * amt * 0.45;
      perpY = uy * amt * 0.45;
    } else {
      d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }
    pts = [from, to];
  }

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

  // Double lines for total participation
  if (srcTotal) _parallelSeg(g, pts[0], pts[1] ?? pts[pts.length - 1]);
  if (tgtTotal) _parallelSeg(g, pts[pts.length - 1], pts[pts.length - 2] ?? pts[0]);

  // Cardinality labels — shifted for parallel edges so they don't overlap
  const anchors = closestAnchors(src, tgt);
  const shift   = pt => ({ x: pt.x + perpX, y: pt.y + perpY });
  const edgeId  = g.getAttribute('data-id');
  const labelContainer = cardLabelsLayer ?? g;
  if (edge.sourceCardinality) _cardLabel(labelContainer, shift(anchors.from), shift(anchors.to), edge.sourceCardinality, cardLabelsLayer ? edgeId : null);
  if (edge.targetCardinality) _cardLabel(labelContainer, shift(anchors.to),   shift(anchors.from), edge.targetCardinality, cardLabelsLayer ? edgeId : null);
}

// Self-loop (unary relationship): cubic bezier from right anchor to top anchor
function _renderSelfLoop(g, edge, node, cardLabelsLayer) {
  const { x, y, width: w, height: h } = node;
  const from  = { x: x + w,       y: y + h / 2 };   // right anchor
  const to    = { x: x + w / 2,   y: y          };   // top anchor
  const bulge = Math.max(64, w * 0.65);
  const cp1   = { x: from.x + bulge,        y: from.y - bulge * 0.2 };
  const cp2   = { x: to.x   + bulge * 0.2,  y: to.y   - bulge       };
  const d     = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`;

  g.appendChild(svgEl('path', {
    d, fill: 'none', stroke: 'transparent',
    'stroke-width': 14, 'pointer-events': 'stroke', class: 'edge-hit',
  }));
  g.appendChild(svgEl('path', {
    d, fill: 'none', stroke: EDGE_COLOR, 'stroke-width': EDGE_SW,
    'pointer-events': 'none', class: 'edge-visual',
  }));

  if (edge.sourceParticipation === 'total') _parallelSeg(g, from, cp1);
  if (edge.targetParticipation === 'total') _parallelSeg(g, to,   cp2);

  const edgeId = g.getAttribute('data-id');
  const labelContainer = cardLabelsLayer ?? g;
  if (edge.sourceCardinality) _cardLabel(labelContainer, from, cp1, edge.sourceCardinality, cardLabelsLayer ? edgeId : null);
  if (edge.targetCardinality) _cardLabel(labelContainer, to,   cp2, edge.targetCardinality, cardLabelsLayer ? edgeId : null);
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

function _cardLabel(container, borderPt, awayPt, card, edgeId) {
  if (!card) return;
  const dx = awayPt.x - borderPt.x, dy = awayPt.y - borderPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = dx / len, ny = dy / len;   // unit vector pointing away from node
  const px = -ny, py = nx;              // unit vector perpendicular to edge
  // Place label 14px outside the border point, 10px to the side of the line
  const el = svgEl('text', {
    x: borderPt.x + nx * 14 + px * 10,
    y: borderPt.y + ny * 14 + py * 10,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': 12, 'font-weight': '700',
    'font-family': '"Inter","Segoe UI",ui-sans-serif,system-ui,sans-serif',
    fill: '#0f172a', 'pointer-events': 'none',
  });
  if (edgeId) el.setAttribute('data-edge-id', edgeId);
  el.textContent = card;
  container.appendChild(el);
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function _dPoly(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d;
}

function _d2(a, b) { return `M ${a.x} ${a.y} L ${b.x} ${b.y}`; }
