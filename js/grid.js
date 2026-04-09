// ─── Snap-to-grid ─────────────────────────────────────────────────────────────

export const grid = {
  enabled: false,
  size: 16,

  /** Snaps a single coordinate value to the grid (or returns it unchanged). */
  snap(v) {
    return this.enabled ? Math.round(v / this.size) * this.size : v;
  },
};
