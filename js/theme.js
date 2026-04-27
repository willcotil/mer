// ─── Theme module ─────────────────────────────────────────────────────────────
// Manages dark mode and high contrast mode.
// Classes are toggled on document.documentElement (<html>).
// Preferences are persisted in localStorage.

const LS_DARK         = 'mer-dark-mode';
const LS_HIGH_CONTRAST = 'mer-high-contrast';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _applyDark(active) {
  document.documentElement.classList.toggle('dark', active);
  const btn = document.getElementById('btn-dark-mode');
  if (btn) {
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('tb-btn-active', active);
  }
}

function _applyHighContrast(active) {
  document.documentElement.classList.toggle('high-contrast', active);
  const btn = document.getElementById('btn-high-contrast');
  if (btn) {
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('tb-btn-active', active);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call once at DOMContentLoaded (before any rendering).
 * Reads localStorage; falls back to prefers-color-scheme for dark mode.
 */
export function initTheme() {
  const savedDark = localStorage.getItem(LS_DARK);
  const savedHC   = localStorage.getItem(LS_HIGH_CONTRAST);

  // Dark mode: explicit pref > system pref
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const darkActive  = savedDark !== null
    ? savedDark === '1'
    : prefersDark;

  // High contrast takes priority; if both were somehow saved, prefer high contrast
  const hcActive = savedHC === '1';

  _applyDark(hcActive ? false : darkActive);
  _applyHighContrast(hcActive);
}

/** Toggle dark mode. Deactivates high contrast if turning on. */
export function toggleDark() {
  const next = !document.documentElement.classList.contains('dark');
  if (next) {
    localStorage.setItem(LS_HIGH_CONTRAST, '0');
    _applyHighContrast(false);
  }
  localStorage.setItem(LS_DARK, next ? '1' : '0');
  _applyDark(next);
}

/** Toggle high contrast. Deactivates dark mode if turning on. */
export function toggleHighContrast() {
  const next = !document.documentElement.classList.contains('high-contrast');
  if (next) {
    localStorage.setItem(LS_DARK, '0');
    _applyDark(false);
  }
  localStorage.setItem(LS_HIGH_CONTRAST, next ? '1' : '0');
  _applyHighContrast(next);
}

/** Returns true if dark mode is currently active. */
export function isDark() {
  return document.documentElement.classList.contains('dark');
}

/** Returns true if high contrast mode is currently active. */
export function isHighContrast() {
  return document.documentElement.classList.contains('high-contrast');
}
