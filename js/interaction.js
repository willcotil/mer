import { state }                              from './state.js';
import { history }                            from './history.js';
import { screenToCanvas, canvasToSVG, svgEl } from './utils.js';
import { getAnchorPoints }                    from './shapes.js';
import { createProgressEdge, updateProgressEdge } from './edges.js';
import { grid }                               from './grid.js';

// ─── FSM states ───────────────────────────────────────────────────────────────

const S = {
  IDLE: 'IDLE', PRE_DRAG: 'PRE_DRAG', DRAGGING: 'DRAGGING',
  PANNING: 'PANNING', RUBBER_BAND: 'RUBBER_BAND',
  CONNECTING: 'CONNECTING', RESIZING: 'RESIZING',
};

let mode = S.IDLE;
let _svg, _overlay;

// drag state
let _dragStartCanvas   = null;
let _dragStartScreen   = null;
let _dragStartPositions = new Map();   // id → {x,y}

// resize state
let _resizeNodeId   = null;
let _resizeDir      = null;
let _resizeSnapshot = null;   // {x,y,width,height} at drag start

// rubber band (lives in canvas-overlay, world coords)
let _rbRect  = null;
let _rbStart = null;
let _canvasOverlay = null;

// connect state
let _connectSrcId  = null;
let _connectAnchor = null;   // anchor point in canvas coords
let _progressEdge  = null;

// space bar for panning
let _spaceHeld = false;

// touch state
let _activeTouchId  = null;
let _lastPinchDist  = null;
let _prevPinchMid   = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initInteraction(svg, overlay) {
  _svg = svg; _overlay = overlay;
  _canvasOverlay = document.getElementById('canvas-overlay');

  svg.addEventListener('mousedown', _onMouseDown);
  svg.addEventListener('mousemove', _onMouseMove);
  svg.addEventListener('mouseup',   _onMouseUp);
  svg.addEventListener('wheel',     _onWheel, { passive: false });
  svg.addEventListener('dblclick',  _onDblClick);

  svg.addEventListener('touchstart', _onTouchStart, { passive: false });
  svg.addEventListener('touchmove',  _onTouchMove,  { passive: false });
  svg.addEventListener('touchend',   _onTouchEnd,   { passive: false });

  document.addEventListener('keydown',  _onKeyDown);
  document.addEventListener('keyup',    _onKeyUp);
  document.addEventListener('mouseup',  _onGlobalMouseUp);  // safety
}

// ─── Hit testing ──────────────────────────────────────────────────────────────

function _hit(e) {
  const t = e.target;
  const resize  = t.closest('[data-role="resize"]');
  if (resize)  return { type:'resize',  nodeId: resize.dataset.nodeid,  dir: resize.dataset.dir  };
  const connect = t.closest('[data-role="connect"]');
  if (connect) return { type:'connect', nodeId: connect.dataset.nodeid, dir: connect.dataset.dir };
  const edge    = t.closest('[data-kind="edge"]');
  if (edge?.dataset.id) return { type:'edge', id: edge.dataset.id };
  const node    = t.closest('[data-kind]:not([data-kind="edge"])');
  if (node?.dataset.id) return { type:'node', id: node.dataset.id };
  return { type: 'canvas' };
}

function _canvasPos(e) {
  return screenToCanvas(e.clientX, e.clientY, _svg, state.canvas);
}

// ─── Mouse down ───────────────────────────────────────────────────────────────

function _onMouseDown(e) {
  // Middle mouse or space+left → pan
  if (e.button === 1 || (e.button === 0 && _spaceHeld)) {
    e.preventDefault();
    mode = S.PANNING;
    _dragStartScreen = { x: e.clientX, y: e.clientY };
    _dragStartCanvas = { ...state.canvas };
    return;
  }
  if (e.button !== 0) return;

  const hit = _hit(e);

  // ── Resize handle ──
  if (hit.type === 'resize') {
    e.preventDefault();
    history.snapshot();
    const node = state.nodes.get(hit.nodeId);
    if (!node) return;
    mode = S.RESIZING;
    _resizeNodeId   = hit.nodeId;
    _resizeDir      = hit.dir;
    _resizeSnapshot = { x: node.x, y: node.y, width: node.width, height: node.height };
    _dragStartCanvas = _canvasPos(e);
    return;
  }

  // ── Connect handle ──
  if (hit.type === 'connect') {
    e.preventDefault();
    const node = state.nodes.get(hit.nodeId);
    if (!node) return;
    mode = S.CONNECTING;
    _connectSrcId  = hit.nodeId;
    _connectAnchor = getAnchorPoints(node)[hit.dir];
    const pos = _canvasPos(e);
    _progressEdge = createProgressEdge(_connectAnchor, pos);
    // Progress edge lives in canvas coords (inside viewport via canvas-overlay)
    (_canvasOverlay || _overlay).appendChild(_progressEdge);
    return;
  }

  // ── Node ──
  if (hit.type === 'node') {
    e.preventDefault();
    const id = hit.id;
    if (e.shiftKey) {
      state.toggleSelection(id);
      return;
    }
    if (!state.isSelected(id)) state.setSelection([id]);
    mode = S.PRE_DRAG;
    _dragStartCanvas = _canvasPos(e);
    _dragStartScreen = { x: e.clientX, y: e.clientY };
    // Snapshot starting positions of all selected nodes
    _dragStartPositions.clear();
    for (const sid of state.selection) {
      const n = state.nodes.get(sid);
      if (n) _dragStartPositions.set(sid, { x: n.x, y: n.y });
    }
    return;
  }

  // ── Edge ──
  if (hit.type === 'edge') {
    e.preventDefault();
    if (e.shiftKey) state.toggleSelection(hit.id);
    else state.setSelection([hit.id]);
    return;
  }

  // ── Empty canvas ──
  if (mode === S.CONNECTING) { _cancelConnect(); return; }
  state.clearSelection();
  mode = S.RUBBER_BAND;
  _rbStart = _canvasPos(e);
  _rbRect = svgEl('rect', {
    x: _rbStart.x, y: _rbStart.y, width: 0, height: 0,
    fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6',
    'stroke-width': 1 / state.canvas.scale,
    'stroke-dasharray': `${4/state.canvas.scale} ${2/state.canvas.scale}`,
    'pointer-events': 'none',
  });
  // Rubber band lives in canvas coords (canvas-overlay is inside viewport)
  (_canvasOverlay || document.getElementById('viewport'))?.appendChild(_rbRect);
}

// ─── Mouse move ───────────────────────────────────────────────────────────────

function _onMouseMove(e) {
  if (mode === S.PANNING) {
    const s = _dragStartCanvas;
    const dx = e.clientX - _dragStartScreen.x;
    const dy = e.clientY - _dragStartScreen.y;
    state.setCanvas({ offsetX: s.offsetX + dx, offsetY: s.offsetY + dy });
    return;
  }

  if (mode === S.PRE_DRAG) {
    const dx = e.clientX - _dragStartScreen.x;
    const dy = e.clientY - _dragStartScreen.y;
    if (Math.hypot(dx, dy) > 4) {
      history.snapshot();
      mode = S.DRAGGING;
    }
  }

  if (mode === S.DRAGGING) {
    const cur = _canvasPos(e);
    const dx  = cur.x - _dragStartCanvas.x;
    const dy  = cur.y - _dragStartCanvas.y;
    for (const [id, start] of _dragStartPositions) {
      const n  = state.nodes.get(id);
      const hw = (n?.width  ?? 0) / 2;
      const hh = (n?.height ?? 0) / 2;
      state.updateNode(id, {
        x: grid.snap(start.x + dx + hw) - hw,
        y: grid.snap(start.y + dy + hh) - hh,
      });
    }
    return;
  }

  if (mode === S.RUBBER_BAND && _rbRect) {
    const cur = _canvasPos(e);
    const x = Math.min(cur.x, _rbStart.x);
    const y = Math.min(cur.y, _rbStart.y);
    const w = Math.abs(cur.x - _rbStart.x);
    const h = Math.abs(cur.y - _rbStart.y);
    _rbRect.setAttribute('x', x); _rbRect.setAttribute('y', y);
    _rbRect.setAttribute('width', w); _rbRect.setAttribute('height', h);
    return;
  }

  if (mode === S.RESIZING) {
    const cur = _canvasPos(e);
    const dx  = cur.x - _dragStartCanvas.x;
    const dy  = cur.y - _dragStartCanvas.y;
    const s   = _resizeSnapshot;
    let nx = s.x, ny = s.y, nw = s.width, nh = s.height;
    if (_resizeDir.includes('e')) nw = Math.max(50, s.width + dx);
    if (_resizeDir.includes('s')) nh = Math.max(28, s.height + dy);
    if (_resizeDir.includes('w')) { nx = s.x + dx; nw = Math.max(50, s.width - dx); }
    if (_resizeDir.includes('n')) { ny = s.y + dy; nh = Math.max(28, s.height - dy); }
    state.updateNode(_resizeNodeId, { x: nx, y: ny, width: nw, height: nh, autoSize: false });
    return;
  }

  if (mode === S.CONNECTING && _progressEdge && _connectAnchor) {
    const pos = _canvasPos(e);
    // Progress edge is in canvas coords (inside viewport)
    updateProgressEdge(_progressEdge, _connectAnchor, pos);
    return;
  }
}

// ─── Mouse up ─────────────────────────────────────────────────────────────────

function _onMouseUp(e) {
  if (mode === S.RUBBER_BAND) {
    if (_rbRect) {
      const rx = +_rbRect.getAttribute('x'), ry = +_rbRect.getAttribute('y');
      const rw = +_rbRect.getAttribute('width'), rh = +_rbRect.getAttribute('height');
      const selected = [];
      for (const n of state.nodes.values()) {
        const ncx = n.x + n.width/2, ncy = n.y + n.height/2;
        if (ncx >= rx && ncx <= rx+rw && ncy >= ry && ncy <= ry+rh) selected.push(n.id);
      }
      state.setSelection(selected);
      _rbRect.remove(); _rbRect = null;
    }
    mode = S.IDLE; return;
  }

  if (mode === S.CONNECTING) {
    const hit = _hit(e);
    let tgtId = null;
    if (hit.type === 'node')    tgtId = hit.id;
    if (hit.type === 'connect' || hit.type === 'resize') tgtId = hit.nodeId;
    if (tgtId && tgtId !== _connectSrcId) {
      history.snapshot();
      state.addEdge({ sourceId: _connectSrcId, targetId: tgtId });
    }
    _cancelConnect(); return;
  }

  mode = S.IDLE;
  _dragStartPositions.clear();
}

// Safety: ensure we always return to IDLE on global mouseup
function _onGlobalMouseUp(e) {
  if (mode !== S.IDLE && mode !== S.CONNECTING && e.button === 0) {
    mode = S.IDLE;
    if (_rbRect) { _rbRect.remove(); _rbRect = null; }
    _dragStartPositions.clear();
  }
}

// ─── Touch ────────────────────────────────────────────────────────────────────

function _touchSynth(touch) {
  return {
    button: 0, shiftKey: false,
    clientX: touch.clientX, clientY: touch.clientY,
    target: touch.target,
    preventDefault: () => {},
  };
}

function _onTouchStart(e) {
  e.preventDefault();

  if (e.touches.length === 1) {
    const t = e.changedTouches[0];
    _activeTouchId = t.identifier;
    _lastPinchDist = null;
    _prevPinchMid  = null;
    _onMouseDown(_touchSynth(t));

  } else if (e.touches.length === 2) {
    // Cancel any single-touch drag cleanly
    if (mode === S.DRAGGING || mode === S.PRE_DRAG) {
      for (const [id, start] of _dragStartPositions) state.updateNode(id, start);
    }
    mode = S.IDLE;
    _activeTouchId = null;
    _dragStartPositions.clear();

    const t1 = e.touches[0], t2 = e.touches[1];
    _lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    _prevPinchMid  = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }
}

function _onTouchMove(e) {
  e.preventDefault();

  if (e.touches.length === 1 && _activeTouchId !== null) {
    const t = [...e.touches].find(t => t.identifier === _activeTouchId);
    if (t) _onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    return;
  }

  if (e.touches.length === 2 && _lastPinchDist !== null) {
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist  = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const midX  = (t1.clientX + t2.clientX) / 2;
    const midY  = (t1.clientY + t2.clientY) / 2;
    const rect  = _svg.getBoundingClientRect();

    const factor   = dist / _lastPinchDist;
    const newScale = Math.max(0.08, Math.min(6, state.canvas.scale * factor));
    const ratio    = newScale / state.canvas.scale;

    // Zoom around previous midpoint, then pan to new midpoint
    const prevMx = _prevPinchMid.x - rect.left;
    const prevMy = _prevPinchMid.y - rect.top;
    const curMx  = midX - rect.left;
    const curMy  = midY - rect.top;

    state.setCanvas({
      scale:   newScale,
      offsetX: curMx - (prevMx - state.canvas.offsetX) * ratio,
      offsetY: curMy - (prevMy - state.canvas.offsetY) * ratio,
    });

    _lastPinchDist = dist;
    _prevPinchMid  = { x: midX, y: midY };
  }
}

function _onTouchEnd(e) {
  e.preventDefault();
  if (e.touches.length === 0) {
    _activeTouchId = null;
    _lastPinchDist = null;
    _prevPinchMid  = null;
    _onMouseUp({ button: 0, target: e.target });
  } else if (e.touches.length === 1) {
    // One finger lifted during pinch — reset to single touch mode
    _lastPinchDist = null;
    _prevPinchMid  = null;
    const t = e.touches[0];
    _activeTouchId = t.identifier;
  }
}

// ─── Wheel (zoom) ─────────────────────────────────────────────────────────────

function _onWheel(e) {
  e.preventDefault();
  const rect = _svg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = Math.exp(-e.deltaY * 0.0008 * 3);
  const newScale = Math.max(0.08, Math.min(6, state.canvas.scale * factor));
  const ratio = newScale / state.canvas.scale;
  state.setCanvas({
    scale: newScale,
    offsetX: mx - (mx - state.canvas.offsetX) * ratio,
    offsetY: my - (my - state.canvas.offsetY) * ratio,
  });
}

// ─── Double click ─────────────────────────────────────────────────────────────

function _onDblClick(e) {
  const hit = _hit(e);
  if (hit.type === 'node') {
    document.dispatchEvent(new CustomEvent('mer:rename', { detail: { id: hit.id } }));
  }
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function _onKeyDown(e) {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.code === 'Space') {
    _spaceHeld = true;
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    if (mode === S.CONNECTING) _cancelConnect();
    state.clearSelection();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    _deleteSelected();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); e.shiftKey ? history.redo() : history.undo(); return; }
    if (e.key === 'y') { e.preventDefault(); history.redo(); return; }
    if (e.key === 'a') { e.preventDefault(); state.setSelection([...state.nodes.keys()]); return; }
  }
  // Arrow nudge
  const arrows = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
  if (arrows[e.key] && state.selection.size) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const [dx, dy] = arrows[e.key].map(v => v * step);
    history.snapshot();
    for (const id of state.selection) {
      const n = state.nodes.get(id);
      if (n) state.updateNode(id, { x: n.x + dx, y: n.y + dy });
    }
  }
}

function _onKeyUp(e) {
  if (e.code === 'Space') _spaceHeld = false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _cancelConnect() {
  if (_progressEdge?.parentNode) _progressEdge.parentNode.removeChild(_progressEdge);
  _progressEdge = null; _connectSrcId = null; _connectAnchor = null;
  mode = S.IDLE;
}

function _deleteSelected() {
  if (!state.selection.size) return;
  history.snapshot();
  for (const id of [...state.selection]) {
    if (state.nodes.has(id)) state.deleteNode(id);
    else if (state.edges.has(id)) state.deleteEdge(id);
  }
}
