import { state }               from './state.js';
import { history }             from './history.js';
import { generateId, cloneDeep } from './utils.js';

// ─── Internal clipboard buffer ────────────────────────────────────────────────

let _buffer = null;   // { nodes: NodeObject[], edges: EdgeObject[] } | null

// ─── Copy ─────────────────────────────────────────────────────────────────────

function copy() {
  if (!state.selection.size) return;

  const selectedIds = state.selection;

  const nodes = [];
  for (const id of selectedIds) {
    const n = state.nodes.get(id);
    if (n) nodes.push(cloneDeep(n));
  }

  // Only include edges whose both endpoints are in the selection
  const edges = [];
  for (const edge of state.edges.values()) {
    if (selectedIds.has(edge.sourceId) && selectedIds.has(edge.targetId)) {
      edges.push(cloneDeep(edge));
    }
  }

  _buffer = { nodes, edges };
}

// ─── Paste ────────────────────────────────────────────────────────────────────

function paste() {
  if (!_buffer || (!_buffer.nodes.length && !_buffer.edges.length)) return;

  history.snapshot();

  const idMap = new Map();   // oldId → newId
  const newNodeIds = [];
  const newEdgeIds = [];

  // Create new nodes with fresh IDs and +20 offset
  for (const oldNode of _buffer.nodes) {
    const newId   = generateId('n');
    idMap.set(oldNode.id, newId);
    const newNode = cloneDeep(oldNode);
    newNode.id    = newId;
    newNode.x    += 20;
    newNode.y    += 20;
    state.nodes.set(newNode.id, newNode);
    newNodeIds.push(newId);
  }

  // Create new edges with fresh IDs and remapped endpoints
  for (const oldEdge of _buffer.edges) {
    const newId   = generateId('e');
    const newEdge = cloneDeep(oldEdge);
    newEdge.id       = newId;
    newEdge.sourceId = idMap.get(oldEdge.sourceId) ?? oldEdge.sourceId;
    newEdge.targetId = idMap.get(oldEdge.targetId) ?? oldEdge.targetId;
    state.edges.set(newEdge.id, newEdge);
    newEdgeIds.push(newId);
  }

  state.dirty = true;

  // Single full re-render
  state.emit('change', { type: 'snapshot:load' });

  // Select the newly pasted elements
  state.setSelection([...newNodeIds, ...newEdgeIds]);
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

function duplicate() {
  copy();
  paste();   // paste() already calls history.snapshot()
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const clipboard = { copy, paste, duplicate };
