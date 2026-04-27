import { state } from './state.js';

class History {
  constructor() {
    this.past   = [];   // JSON strings (serialized snapshots)
    this.future = [];
    this._max   = 100;
    this._debTimer = null;
  }

  // Save current state before a mutation
  snapshot() {
    clearTimeout(this._debTimer);
    const json = JSON.stringify(state.toSnapshot());
    if (this.past.length && this.past[this.past.length - 1] === json) return;
    this.past.push(json);
    if (this.past.length > this._max) this.past.shift();
    this.future = [];
    _updateUI();
  }

  // Debounced snapshot (for rapid typing)
  snapshotDebounced(delay = 500) {
    clearTimeout(this._debTimer);
    this._debTimer = setTimeout(() => this.snapshot(), delay);
  }

  undo() {
    if (!this.past.length) return;
    this.future.push(JSON.stringify(state.toSnapshot()));
    state.loadSnapshot(JSON.parse(this.past.pop()));
    _updateUI();
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(JSON.stringify(state.toSnapshot()));
    state.loadSnapshot(JSON.parse(this.future.pop()));
    _updateUI();
  }

  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }
}

function _updateUI() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) {
    u.disabled = !history.canUndo();
    u.setAttribute('aria-disabled', u.disabled ? 'true' : 'false');
  }
  if (r) {
    r.disabled = !history.canRedo();
    r.setAttribute('aria-disabled', r.disabled ? 'true' : 'false');
  }
}

export const history = new History();
