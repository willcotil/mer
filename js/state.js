import { generateId, cloneDeep } from './utils.js';

// ─── Simple event emitter ─────────────────────────────────────────────────────

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn)  { (this._h[ev] ??= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._h[ev] = (this._h[ev] || []).filter(f => f !== fn); }
  emit(ev, d) { (this._h[ev] || []).slice().forEach(fn => fn(d)); }
}

// ─── Central state store ──────────────────────────────────────────────────────

class MerState extends Emitter {
  constructor() {
    super();
    this.nodes     = new Map();   // Map<id, NodeObject>
    this.edges     = new Map();   // Map<id, EdgeObject>
    this.canvas    = { offsetX: 0, offsetY: 0, scale: 1.0 };
    this.selection = new Set();   // Set<id>
    this.dirty     = false;
  }

  // ── Node CRUD ──────────────────────────────────────────────────────────────

  addNode(data = {}) {
    const defaults = {
      id: generateId('n'), kind: 'entity',
      x: 200, y: 200, width: 120, height: 46,
      autoSize: true, label: 'Entidade',
      style: { fill: '#f8fafc', stroke: '#334155' },
      props: {},
    };
    const node = { ...defaults, ...data };
    node.style = { ...defaults.style, ...(data.style || {}) };
    node.props  = { ...(data.props  || {}) };
    this.nodes.set(node.id, node);
    this.dirty = true;
    this.emit('change', { type: 'node:add', node });
    return node;
  }

  updateNode(id, patch) {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (patch.style) patch = { ...patch, style: { ...node.style, ...patch.style } };
    if (patch.props) patch = { ...patch, props: { ...node.props, ...patch.props } };
    Object.assign(node, patch);
    this.dirty = true;
    this.emit('change', { type: 'node:update', node });
    return node;
  }

  deleteNode(id) {
    if (!this.nodes.has(id)) return;
    this.nodes.delete(id);
    for (const [eid, e] of this.edges) {
      if (e.sourceId === id || e.targetId === id) this.edges.delete(eid);
    }
    for (const n of this.nodes.values()) {
      if (n.kind === 'aggregation' && Array.isArray(n.props?.containedNodeIds)) {
        n.props.containedNodeIds = n.props.containedNodeIds.filter(x => x !== id);
      }
    }
    this.selection.delete(id);
    this.dirty = true;
    this.emit('change', { type: 'node:delete', id });
    this.emit('selection-change');
  }

  // ── Edge CRUD ──────────────────────────────────────────────────────────────

  addEdge(data = {}) {
    const edge = {
      id: generateId('e'), kind: 'connection',
      sourceId: null, targetId: null,
      sourceCardinality: '', targetCardinality: '',
      sourceParticipation: 'partial', targetParticipation: 'partial',
      fkAttributeId: null, waypoints: [], label: '',
      ...data,
    };
    this.edges.set(edge.id, edge);
    this.dirty = true;
    this.emit('change', { type: 'edge:add', edge });
    return edge;
  }

  updateEdge(id, patch) {
    const edge = this.edges.get(id);
    if (!edge) return null;
    Object.assign(edge, patch);
    this.dirty = true;
    this.emit('change', { type: 'edge:update', edge });
    return edge;
  }

  deleteEdge(id) {
    if (!this.edges.has(id)) return;
    this.edges.delete(id);
    this.selection.delete(id);
    this.dirty = true;
    this.emit('change', { type: 'edge:delete', id });
    this.emit('selection-change');
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  setSelection(ids)   { this.selection = new Set(ids); this.emit('selection-change'); }
  addToSelection(id)  { this.selection.add(id);        this.emit('selection-change'); }
  toggleSelection(id) { this.selection.has(id) ? this.selection.delete(id) : this.selection.add(id); this.emit('selection-change'); }
  clearSelection()    { if (!this.selection.size) return; this.selection.clear(); this.emit('selection-change'); }
  isSelected(id)      { return this.selection.has(id); }

  // ── Canvas ─────────────────────────────────────────────────────────────────

  setCanvas(patch) { Object.assign(this.canvas, patch); this.emit('canvas-change'); }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  toSnapshot() {
    return cloneDeep({
      nodes:  Array.from(this.nodes.values()),
      edges:  Array.from(this.edges.values()),
      canvas: this.canvas,
    });
  }

  loadSnapshot(snap) {
    this.nodes.clear();
    this.edges.clear();
    for (const n of (snap.nodes || [])) this.nodes.set(n.id, cloneDeep(n));
    for (const e of (snap.edges || [])) this.edges.set(e.id, cloneDeep(e));
    if (snap.canvas) Object.assign(this.canvas, snap.canvas);
    this.selection.clear();
    this.dirty = false;
    this.emit('change', { type: 'snapshot:load' });
    this.emit('selection-change');
    this.emit('canvas-change');
  }

  reset() {
    this.nodes.clear(); this.edges.clear();
    this.canvas = { offsetX: 0, offsetY: 0, scale: 1.0 };
    this.selection.clear(); this.dirty = false;
    this.emit('change', { type: 'snapshot:load' });
    this.emit('selection-change');
    this.emit('canvas-change');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getEdgesFor(nodeId) {
    return Array.from(this.edges.values()).filter(e => e.sourceId === nodeId || e.targetId === nodeId);
  }

  getAttributesOf(entityId) {
    return this.getEdgesFor(entityId).map(e => {
      const otherId = e.sourceId === entityId ? e.targetId : e.sourceId;
      const n = this.nodes.get(otherId);
      return n?.kind === 'attribute' ? n : null;
    }).filter(Boolean);
  }

  getEntitiesOf(relId) {
    return this.getEdgesFor(relId).map(e => {
      const otherId = e.sourceId === relId ? e.targetId : e.sourceId;
      const n = this.nodes.get(otherId);
      return (n?.kind === 'entity' || n?.kind === 'weak_entity') ? n : null;
    }).filter(Boolean);
  }
}

export const state = new MerState();
