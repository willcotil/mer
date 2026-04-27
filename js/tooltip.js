// ─── Global tooltip singleton ─────────────────────────────────────────────────
// Ativado via atributo data-tooltip="texto" em qualquer elemento.
// Nao aparece em dispositivos touch (hover: none).

let _el    = null;   // elemento DOM do tooltip
let _timer = null;   // timer de delay (500ms)

const DELAY  = 500;  // ms antes de aparecer
const MARGIN = 8;    // px de margem da viewport

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initTooltip() {
  // Nao inicializa em touch-only devices
  if (window.matchMedia('(hover: none)').matches) return;

  // Cria elemento singleton
  _el = document.createElement('div');
  _el.id            = 'mer-tooltip';
  _el.role          = 'tooltip';
  _el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_el);

  // Event delegation no document
  document.addEventListener('mouseenter', _onEnter, true);
  document.addEventListener('mouseleave', _onLeave, true);
  document.addEventListener('mousemove',  _onMove,  true);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function _onEnter(e) {
  const target = e.target?.closest('[data-tooltip]');
  if (!target) return;

  _cancel();
  _timer = setTimeout(() => _show(target), DELAY);
}

function _onLeave(e) {
  const target = e.target?.closest('[data-tooltip]');
  if (!target) return;

  // Verifica se o mouse foi para dentro do mesmo elemento (filho)
  const related = e.relatedTarget;
  if (related && target.contains(related)) return;

  _cancel();
  _hide();
}

function _onMove(e) {
  // Se o tooltip esta visivel e o mouse saiu do elemento, esconde
  if (!_el.classList.contains('visible')) return;
  const target = e.target?.closest('[data-tooltip]');
  if (!target) _hide();
}

// ─── Show / Hide ──────────────────────────────────────────────────────────────

function _show(anchor) {
  if (!_el) return;
  const text = anchor.dataset.tooltip;
  if (!text) return;

  _el.textContent = text;
  _el.classList.remove('visible');
  _el.removeAttribute('data-pos');

  // Posiciona antes de medir (invisivel mas no DOM)
  _el.style.left = '-9999px';
  _el.style.top  = '-9999px';

  // Precisa de um frame para o browser calcular dimensoes
  requestAnimationFrame(() => {
    const anchor_r = anchor.getBoundingClientRect();
    const tip_r    = _el.getBoundingClientRect();
    const vw       = window.innerWidth;
    const vh       = window.innerHeight;

    const pos = _pickPosition(anchor_r, tip_r, vw, vh);
    const { left, top } = _computeCoords(pos, anchor_r, tip_r, vw, vh);

    _el.style.left = left + 'px';
    _el.style.top  = top  + 'px';
    _el.dataset.pos = pos;
    _el.classList.add('visible');
  });
}

function _hide() {
  if (!_el) return;
  _el.classList.remove('visible');
}

function _cancel() {
  if (_timer !== null) { clearTimeout(_timer); _timer = null; }
}

// ─── Posicionamento ───────────────────────────────────────────────────────────

// Ordem de preferencia: top → bottom → right → left
function _pickPosition(ar, tr, vw, vh) {
  // top: ha espaco acima?
  if (ar.top - tr.height - MARGIN * 2 >= 0) return 'top';
  // bottom: ha espaco abaixo?
  if (ar.bottom + tr.height + MARGIN * 2 <= vh) return 'bottom';
  // right: ha espaco a direita?
  if (ar.right + tr.width + MARGIN * 2 <= vw) return 'right';
  // left: fallback
  return 'left';
}

function _computeCoords(pos, ar, tr, vw, vh) {
  let left, top;

  if (pos === 'top') {
    top  = ar.top - tr.height - MARGIN;
    left = ar.left + ar.width / 2 - tr.width / 2;
  } else if (pos === 'bottom') {
    top  = ar.bottom + MARGIN;
    left = ar.left + ar.width / 2 - tr.width / 2;
  } else if (pos === 'right') {
    top  = ar.top + ar.height / 2 - tr.height / 2;
    left = ar.right + MARGIN;
  } else {
    // left
    top  = ar.top + ar.height / 2 - tr.height / 2;
    left = ar.left - tr.width - MARGIN;
  }

  // Clamp para nao sair da viewport
  left = Math.max(MARGIN, Math.min(left, vw - tr.width  - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  vh - tr.height - MARGIN));

  return { left, top };
}
