import { state }   from './state.js';
import { history } from './history.js';

// ─── Save ─────────────────────────────────────────────────────────────────────

export function saveToFile(filename = 'diagrama.mer') {
  const snap = state.toSnapshot();
  const payload = {
    _type:    'mer-editor-v1',
    _version: '1.0',
    _created: new Date().toISOString(),
    ...snap,
  };
  const json  = JSON.stringify(payload, null, 2);
  const blob  = new Blob([json], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.dirty = false;
  _flashSaved();
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export function loadFromFile() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.mer,.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed._type !== 'mer-editor-v1') {
          alert('Arquivo inválido: não é um projeto MER Editor.\n\nO arquivo deve ter "_type":"mer-editor-v1" na primeira chave.');
          return;
        }
        history.snapshot();
        state.loadSnapshot(parsed);
      } catch (err) {
        alert(`Erro ao carregar arquivo:\n${err.message}`);
      }
    };
    reader.readAsText(file);
  });
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// ─── New diagram ──────────────────────────────────────────────────────────────

export function newDiagram() {
  if (state.dirty && state.nodes.size > 0) {
    if (!confirm('Há alterações não salvas. Deseja criar um novo diagrama e perder as alterações?')) return;
  }
  history.snapshot();
  state.reset();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _flashSaved() {
  const btn = document.getElementById('btn-save');
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = '✓ Salvo';
  btn.classList.add('text-green-400');
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('text-green-400'); }, 1800);
}
