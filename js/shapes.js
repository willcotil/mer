import { svgEl } from './utils.js';

// ─── Default style per kind ───────────────────────────────────────────────────

const DEFAULTS = {
  entity:            { fill: '#f8fafc', stroke: '#334155', sw: 2    },
  weak_entity:       { fill: '#f8fafc', stroke: '#334155', sw: 2    },
  attribute:         { fill: '#eff6ff', stroke: '#3b82f6', sw: 1.5  },
  relationship:      { fill: '#fef3c7', stroke: '#d97706', sw: 2    },
  weak_relationship: { fill: '#fef3c7', stroke: '#d97706', sw: 2    },
  aggregation:       { fill: 'rgba(241,245,249,0.85)', stroke: '#94a3b8', sw: 1.5 },
  generalization:    { fill: '#dcfce7', stroke: '#16a34a', sw: 2    },
};

export function getDefaultStyle(kind) {
  const d = DEFAULTS[kind] || { fill: '#ffffff', stroke: '#334155', sw: 2 };
  return { fill: d.fill, stroke: d.stroke };
}

// ─── Anchor points (canvas world coords) ─────────────────────────────────────

export function getAnchorPoints(node) {
  const { x, y, width: w, height: h } = node;
  const cx = x + w / 2, cy = y + h / 2;
  return {
    top:    { x: cx,    y: y     },
    right:  { x: x + w, y: cy    },
    bottom: { x: cx,    y: y + h },
    left:   { x: x,     y: cy    },
  };
}

// Returns the pair of anchor points (from source, from target) closest to each other
export function closestAnchors(nodeA, nodeB) {
  const aa = Object.values(getAnchorPoints(nodeA));
  const ab = Object.values(getAnchorPoints(nodeB));
  let best = Infinity, fa = aa[0], fb = ab[0];
  for (const a of aa) for (const b of ab) {
    const d = (a.x-b.x)**2 + (a.y-b.y)**2;
    if (d < best) { best = d; fa = a; fb = b; }
  }
  return { from: fa, to: fb };
}

// ─── Node group creation ──────────────────────────────────────────────────────

export function createNodeGroup(node) {
  const g = svgEl('g', { 'data-id': node.id, 'data-kind': node.kind, class: 'mer-node' });
  _render(g, node);
  return g;
}

export function updateNodeGroup(g, node) {
  g.replaceChildren();
  _render(g, node);
}

// ─── Internal renderer ────────────────────────────────────────────────────────

function _render(g, node) {
  const { x, y, width: w, height: h, label = '', kind, style = {}, props = {} } = node;
  const d = DEFAULTS[kind] || DEFAULTS.entity;
  const fill   = style.fill   || d.fill;
  const stroke = style.stroke || d.stroke;
  const sw     = d.sw;

  g.setAttribute('transform', `translate(${x},${y})`);

  switch (kind) {
    case 'entity':         _entity(g, w, h, label, fill, stroke, sw, false); break;
    case 'weak_entity':    _entity(g, w, h, label, fill, stroke, sw, true);  break;
    case 'attribute':      _attribute(g, w, h, label, fill, stroke, sw, props); break;
    case 'relationship':   _relationship(g, w, h, label, fill, stroke, sw, false); break;
    case 'weak_relationship': _relationship(g, w, h, label, fill, stroke, sw, true); break;
    case 'aggregation':    _aggregation(g, w, h, fill, stroke, sw); break;
    case 'generalization': _generalization(g, w, h, fill, stroke, sw, props); break;
    default:               _entity(g, w, h, label, fill, stroke, sw, false);
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

function _entity(g, w, h, label, fill, stroke, sw, weak) {
  g.appendChild(svgEl('rect', {
    x:0, y:0, width:w, height:h, rx:5, ry:5,
    fill, stroke, 'stroke-width': sw, class:'shape-main',
  }));
  if (weak) {
    const ins = 5;
    g.appendChild(svgEl('rect', {
      x:ins, y:ins, width:w-ins*2, height:h-ins*2, rx:2, ry:2,
      fill:'none', stroke, 'stroke-width': sw*0.65,
    }));
  }
  g.appendChild(_text(w/2, h/2, label, { size:14, weight:'600', fill:'#0f172a' }));
}

// ─── Attribute ────────────────────────────────────────────────────────────────

function _attribute(g, w, h, label, fill, stroke, sw, props) {
  const rx = w/2, ry = h/2, cx = rx, cy = ry;

  const outer = svgEl('ellipse', { cx, cy, rx, ry, fill, stroke, 'stroke-width': sw, class:'shape-main' });
  if (props.isDerived) outer.setAttribute('stroke-dasharray', '6 3');
  if (props.isComposite) outer.setAttribute('stroke-dasharray', '3 2');
  g.appendChild(outer);

  if (props.isMultivalued) {
    const ins = 4;
    g.appendChild(svgEl('ellipse', {
      cx, cy, rx: rx-ins, ry: ry-ins,
      fill:'none', stroke, 'stroke-width': sw*0.65,
    }));
  }

  const tAttrs = { size: 13, fill: '#1e293b' };
  if (props.isPK)     { tAttrs.decoration = 'underline'; tAttrs.weight = '700'; tAttrs.fill = '#1d4ed8'; }
  if (props.isUnique && !props.isPK) { tAttrs.decoration = 'underline'; tAttrs.style = 'italic'; }
  g.appendChild(_text(cx, cy, label, tAttrs));

  // PK badge
  if (props.isPK) {
    const badge = svgEl('text', {
      x: cx + rx - 9, y: cy - ry + 9,
      'font-size':9, 'font-weight':'700', fill:'#1d4ed8',
      'text-anchor':'middle', 'dominant-baseline':'central',
      'pointer-events':'none',
    });
    badge.textContent = 'PK';
    g.appendChild(badge);
  }
  if (props.isAutoIncrement) {
    const ai = svgEl('text', {
      x: cx - rx + 9, y: cy - ry + 9,
      'font-size':8, 'font-weight':'600', fill:'#7c3aed',
      'text-anchor':'middle', 'dominant-baseline':'central',
      'pointer-events':'none',
    });
    ai.textContent = 'AI';
    g.appendChild(ai);
  }
}

// ─── Relationship (diamond) ───────────────────────────────────────────────────

function _relationship(g, w, h, label, fill, stroke, sw, weak) {
  const cx = w/2, cy = h/2;
  g.appendChild(svgEl('polygon', {
    points:`${cx},0 ${w},${cy} ${cx},${h} 0,${cy}`,
    fill, stroke, 'stroke-width': sw, class:'shape-main',
  }));
  if (weak) {
    const ins = 8;
    const iw = w - ins*2, ih = h - ins*2;
    const icx = iw/2 + ins, icy = ih/2 + ins;
    g.appendChild(svgEl('polygon', {
      points:`${icx},${ins} ${iw+ins},${icy} ${icx},${ih+ins} ${ins},${icy}`,
      fill:'none', stroke, 'stroke-width': sw*0.65,
    }));
  }
  g.appendChild(_text(cx, cy, label, { size:13, weight:'500', fill:'#78350f' }));
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function _aggregation(g, w, h, fill, stroke, sw) {
  g.appendChild(svgEl('rect', {
    x:0, y:0, width:w, height:h, rx:10, ry:10,
    fill, stroke, 'stroke-width': sw,
    'stroke-dasharray':'10 5', class:'shape-main',
  }));
  const lbl = svgEl('text', {
    x:w/2, y:14, 'text-anchor':'middle', 'dominant-baseline':'middle',
    'font-size':11, fill:'#64748b', 'font-style':'italic',
    'pointer-events':'none',
  });
  lbl.textContent = 'agregação';
  g.appendChild(lbl);
}

// ─── Generalization (triangle) ────────────────────────────────────────────────

function _generalization(g, w, h, fill, stroke, sw, props) {
  const cx = w/2;
  g.appendChild(svgEl('polygon', {
    points:`${cx},4 ${w-3},${h-4} 3,${h-4}`,
    fill, stroke, 'stroke-width': sw, class:'shape-main',
  }));
  const letter = props?.isDisjoint === false ? 'o' : 'd';
  g.appendChild(_text(cx, h/2+4, letter, { size:15, weight:'700', fill:'#15803d' }));
}

// ─── Text helper ──────────────────────────────────────────────────────────────

function _text(x, y, content, { size=14, weight='normal', fill='#0f172a', decoration, style: fontStyle } = {}) {
  const t = svgEl('text', {
    x, y,
    'text-anchor':'middle', 'dominant-baseline':'central',
    'font-size': size,
    'font-family': '"Inter","Segoe UI",ui-sans-serif,system-ui,sans-serif',
    'font-weight': weight,
    fill,
    'pointer-events':'none',
    class:'node-label',
  });
  if (decoration) t.setAttribute('text-decoration', decoration);
  if (fontStyle)  t.setAttribute('font-style', fontStyle);
  t.textContent = content;
  return t;
}
