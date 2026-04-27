// ─── Keyboard Shortcuts Modal ─────────────────────────────────────────────────

const GROUPS = [
  {
    title: 'Edição',
    items: [
      { keys: ['Ctrl', 'Z'],       desc: 'Desfazer última ação' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Refazer ação desfeita' },
      { keys: ['Ctrl', 'Y'],       desc: 'Refazer ação desfeita' },
      { keys: ['Ctrl', 'C'],       desc: 'Copiar elemento(s) selecionado(s)' },
      { keys: ['Ctrl', 'V'],       desc: 'Colar elemento(s) copiado(s)' },
      { keys: ['Ctrl', 'D'],       desc: 'Duplicar elemento(s) selecionado(s)' },
      { keys: ['Ctrl', 'A'],       desc: 'Selecionar todos os elementos' },
      { keys: ['Delete'],          desc: 'Remover elemento(s) selecionado(s)' },
      { keys: ['Backspace'],       desc: 'Remover elemento(s) selecionado(s)' },
    ],
  },
  {
    title: 'Navegação e Zoom',
    items: [
      { keys: ['Ctrl', '+'],       desc: 'Aumentar zoom' },
      { keys: ['Ctrl', '-'],       desc: 'Diminuir zoom' },
      { keys: ['Scroll'],          desc: 'Zoom com roda do mouse' },
      { keys: ['Ctrl', 'Scroll'],  desc: 'Zoom com roda do mouse (alternativo)' },
      { keys: ['Botão do meio'],   desc: 'Arrastar o canvas (pan)' },
      { keys: ['Espaço', 'Drag'],  desc: 'Arrastar o canvas (pan com espaço)' },
    ],
  },
  {
    title: 'Seleção e Movimento',
    items: [
      { keys: ['Clique'],          desc: 'Selecionar elemento' },
      { keys: ['Shift', 'Clique'], desc: 'Adicionar/remover da seleção' },
      { keys: ['Drag (canvas)'],   desc: 'Selecionar por área (lasso)' },
      { keys: ['↑ ↓ ← →'],        desc: 'Mover elemento(s) selecionado(s) 1px' },
      { keys: ['Shift', '↑↓←→'],  desc: 'Mover elemento(s) selecionado(s) 10px' },
      { keys: ['Esc'],             desc: 'Cancelar ação / desselecionar tudo' },
    ],
  },
  {
    title: 'Arquivo',
    items: [
      { keys: ['Ctrl', 'S'],       desc: 'Salvar diagrama como arquivo .mer' },
      { keys: ['Ctrl', 'O'],       desc: 'Abrir arquivo .mer' },
      { keys: ['Ctrl', 'N'],       desc: 'Novo diagrama' },
    ],
  },
];

function _kbd(key) {
  return `<kbd>${key}</kbd>`;
}

function _renderGroup({ title, items }) {
  const rows = items.map(({ keys, desc }) => `
    <tr>
      <td class="shortcut-keys">${keys.map(_kbd).join('<span class="shortcut-plus">+</span>')}</td>
      <td class="shortcut-desc">${desc}</td>
    </tr>`).join('');
  return `
    <section class="shortcut-group">
      <h3 class="shortcut-group-title">${title}</h3>
      <table class="shortcut-table"><tbody>${rows}</tbody></table>
    </section>`;
}

export function initShortcuts() {
  const dialog  = document.getElementById('shortcuts-dialog');
  const grid    = document.getElementById('shortcuts-grid');
  const btnOpen = document.getElementById('btn-shortcuts');
  const btnClose = document.getElementById('shortcuts-close');
  if (!dialog || !grid || !btnOpen || !btnClose) return;

  grid.innerHTML = GROUPS.map(_renderGroup).join('');

  btnOpen.addEventListener('click', () => {
    dialog.showModal();
    btnClose.focus();
  });

  btnClose.addEventListener('click', () => {
    dialog.close();
    btnOpen.focus();
  });

  dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); dialog.close(); btnOpen.focus(); }
  });
}
