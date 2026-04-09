import { state }                              from './state.js';
import { computeAutoSize, canvasToSVG, svgEl } from './utils.js';
import { createNodeGroup, updateNodeGroup }     from './shapes.js';
import { createEdgeGroup, updateEdgeGroup }     from './edges.js';

let _svg, _viewport, _nodesLayer, _edgesLayer, _overlay;
const nodeGroups = new Map();   // id → <g>
const edgeGroups = new Map();   // id → <g>

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initRenderer(svg, viewport, nodesLayer, edgesLayer, overlay) {
  _svg = svg; _viewport = viewport;
  _nodesLayer = nodesLayer; _edgesLayer = edgesLayer; _overlay = overlay;

  state.on('change',          _onChange);
  state.on('selection-change', _onSelectionChange);
  state.on('canvas-change',    _onCanvasChange);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function _onChange({ type, node, edge, id }) {
  switch (type) {
    case 'snapshot:load':
      _fullRender();
      break;

    case 'node:add':
      _applyAutoSize(node);
      const gn = createNodeGroup(node);
      // Aggregations go behind other nodes
      if (node.kind === 'aggregation') _nodesLayer.prepend(gn);
      else _nodesLayer.appendChild(gn);
      nodeGroups.set(node.id, gn);
      break;

    case 'node:update': {
      _applyAutoSize(node);
      const g = nodeGroups.get(node.id);
      if (g) updateNodeGroup(g, node);
      // Update all connected edges
      for (const [eid, eg] of edgeGroups) {
        const e = state.edges.get(eid);
        if (e && (e.sourceId === node.id || e.targetId === node.id)) _rerenderEdge(eid);
      }
      // Update handle positions if this node is selected
      if (state.isSelected(node.id)) _updateHandlePositions();
      break;
    }

    case 'node:delete': {
      const g = nodeGroups.get(id);
      if (g) { g.remove(); nodeGroups.delete(id); }
      // Clean orphaned edge groups
      for (const [eid, eg] of edgeGroups) {
        if (!state.edges.has(eid)) { eg.remove(); edgeGroups.delete(eid); }
      }
      break;
    }

    case 'edge:add': {
      const src = state.nodes.get(edge.sourceId);
      const tgt = state.nodes.get(edge.targetId);
      const ge = createEdgeGroup(edge, src, tgt);
      _edgesLayer.appendChild(ge);
      edgeGroups.set(edge.id, ge);
      break;
    }

    case 'edge:update':
      _rerenderEdge(edge.id);
      break;

    case 'edge:delete': {
      const ge = edgeGroups.get(id);
      if (ge) { ge.remove(); edgeGroups.delete(id); }
      break;
    }
  }
}

function _onSelectionChange() {
  // Highlight classes
  for (const [id, g] of nodeGroups) g.classList.toggle('selected', state.isSelected(id));
  for (const [id, g] of edgeGroups) g.classList.toggle('selected', state.isSelected(id));
  _renderHandles();
}

function _onCanvasChange() {
  const { offsetX, offsetY, scale } = state.canvas;
  _viewport.setAttribute('transform', `translate(${offsetX},${offsetY}) scale(${scale})`);
  _renderHandles(); // repositions overlay handles
}

// ─── Full render ──────────────────────────────────────────────────────────────

function _fullRender() {
  _nodesLayer.replaceChildren();
  _edgesLayer.replaceChildren();
  nodeGroups.clear();
  edgeGroups.clear();

  // Aggregations first (rendered behind)
  const sorted = Array.from(state.nodes.values()).sort((a) => a.kind === 'aggregation' ? -1 : 1);
  for (const node of sorted) {
    _applyAutoSize(node);
    const g = createNodeGroup(node);
    _nodesLayer.appendChild(g);
    nodeGroups.set(node.id, g);
  }
  for (const edge of state.edges.values()) {
    const src = state.nodes.get(edge.sourceId);
    const tgt = state.nodes.get(edge.targetId);
    const g = createEdgeGroup(edge, src, tgt);
    _edgesLayer.appendChild(g);
    edgeGroups.set(edge.id, g);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _applyAutoSize(node) {
  if (!node.autoSize) return;
  const { width, height } = computeAutoSize(node.label || '', node.kind);
  node.width  = width;
  node.height = height;
}

function _rerenderEdge(eid) {
  const e   = state.edges.get(eid);
  const eg  = edgeGroups.get(eid);
  if (!e || !eg) return;
  const src = state.nodes.get(e.sourceId);
  const tgt = state.nodes.get(e.targetId);
  if (src && tgt) updateEdgeGroup(eg, e, src, tgt);
}

// ─── Handles overlay ──────────────────────────────────────────────────────────

function _renderHandles() {
  _overlay.replaceChildren();
  if (state.selection.size !== 1) return;

  const [id] = state.selection;
  const node = state.nodes.get(id);
  if (!node) return;

  _buildHandles(node);
}

function _updateHandlePositions() {
  _overlay.replaceChildren();
  if (state.selection.size !== 1) return;
  const [id] = state.selection;
  const node = state.nodes.get(id);
  if (node) _buildHandles(node);
}

function _buildHandles(node) {
  const { x, y, width: w, height: h } = node;
  const c = state.canvas;

  const toSVG = (cx, cy) => canvasToSVG(cx, cy, c);

  // Resize handles at 4 corners
  const corners = [
    { cx: x,     cy: y,     dir: 'nw', cursor: 'nw-resize' },
    { cx: x+w,   cy: y,     dir: 'ne', cursor: 'ne-resize' },
    { cx: x+w,   cy: y+h,   dir: 'se', cursor: 'se-resize' },
    { cx: x,     cy: y+h,   dir: 'sw', cursor: 'sw-resize' },
  ];
  for (const corner of corners) {
    const p = toSVG(corner.cx, corner.cy);
    const el = svgEl('circle', {
      cx: p.x, cy: p.y, r: 5,
      fill:'white', stroke:'#3b82f6', 'stroke-width':1.5,
      class:'handle-resize', 'data-role':'resize',
      'data-dir': corner.dir, 'data-nodeid': node.id,
      style: `cursor:${corner.cursor}`,
    });
    _overlay.appendChild(el);
  }

  // Connection handles at anchor midpoints
  const anchors = [
    { cx: x+w/2, cy: y,     dir:'top'    },
    { cx: x+w,   cy: y+h/2, dir:'right'  },
    { cx: x+w/2, cy: y+h,   dir:'bottom' },
    { cx: x,     cy: y+h/2, dir:'left'   },
  ];
  for (const anchor of anchors) {
    const p = toSVG(anchor.cx, anchor.cy);
    const el = svgEl('circle', {
      cx: p.x, cy: p.y, r: 6,
      fill:'#3b82f6', stroke:'white', 'stroke-width':1.5,
      class:'handle-connect', 'data-role':'connect',
      'data-dir': anchor.dir, 'data-nodeid': node.id,
      style:'cursor:crosshair',
    });
    _overlay.appendChild(el);
  }
}

export { nodeGroups, edgeGroups };
