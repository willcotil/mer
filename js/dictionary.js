import { state }   from './state.js';
import { history } from './history.js';
import { escHtml }  from './utils.js';

// ─── Show modal ───────────────────────────────────────────────────────────────

export function showDataDictionary() {
  const dialog = document.getElementById('dict-dialog');
  if (!dialog) return;
  _render();
  dialog.showModal();
}

export function exportDictionaryCSV() {
  const rows = [['Entidade', 'Tipo Entidade', 'Atributo', 'Tipo Dado', 'PK', 'FK', 'UK', 'NN', 'AI', 'Multivalorado', 'Derivado', 'Composto', 'Referência FK', 'Descrição Atributo', 'Descrição Entidade']];

  const entities = Array.from(state.nodes.values()).filter(
    n => n.kind === 'entity' || n.kind === 'weak_entity'
  );

  for (const entity of entities) {
    const attrs  = state.getAttributesOf(entity.id);
    const fkMap  = _buildFKMap(entity.id);
    const entityType = entity.kind === 'weak_entity' ? 'Entidade Fraca' : 'Entidade';
    const entityDesc = entity.props?.description || '';

    if (!attrs.length) {
      rows.push([entity.label, entityType, '', '', '', '', '', '', '', '', '', '', '', '', entityDesc]);
      continue;
    }

    for (const attr of attrs) {
      const p    = attr.props || {};
      const fkR  = fkMap.get(attr.id) || '';
      const csvType = (p.dataType === 'ENUM' && p.enumValues?.length)
        ? `ENUM(${p.enumValues.join(',')})`
        : (p.dataType || '');
      rows.push([
        entity.label,
        entityType,
        attr.label,
        csvType,
        p.isPK            ? 'Sim' : '',
        fkR               ? 'Sim' : '',
        p.isUnique        ? 'Sim' : '',
        (p.isNotNull || p.isPK) ? 'Sim' : '',
        p.isAutoIncrement ? 'Sim' : '',
        p.isMultivalued   ? 'Sim' : '',
        p.isDerived       ? 'Sim' : '',
        p.isComposite     ? 'Sim' : '',
        fkR,
        p.description     || '',
        entityDesc,
      ]);
    }
  }

  const csv = rows.map(r => r.map(_csvCell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'dicionario-de-dados.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function _csvCell(value) {
  const str = String(value ?? '');
  return str.includes(';') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function _render() {
  const content = document.getElementById('dict-content');
  if (!content) return;

  const scrollTop = content.scrollTop;

  const entities = Array.from(state.nodes.values()).filter(
    n => n.kind === 'entity' || n.kind === 'weak_entity'
  );

  if (!entities.length) {
    content.innerHTML = `<p class="text-slate-500 text-sm italic py-4">Nenhuma entidade no diagrama.</p>`;
    return;
  }

  content.innerHTML = entities.map(e => _entityTable(e)).join('');
  content.scrollTop = scrollTop;
  _wire(content);
}

function _entityTable(entity) {
  const attrs  = state.getAttributesOf(entity.id);
  const fkMap  = _buildFKMap(entity.id);

  const sorted = [...attrs].sort((a, b) => {
    const rank = node => {
      const p = node.props || {};
      if (p.isPK)                        return 0;
      if (p.isUnique && !p.isPK)         return 1;
      if (fkMap.has(node.id))            return 3;
      return 2;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.label || '').localeCompare(b.label || '', 'pt');
  });

  const rows = sorted.length
    ? sorted.map(a => _attrRow(a, fkMap)).join('')
    : `<tr><td colspan="9" class="dict-cell italic text-slate-400">Sem atributos definidos</td></tr>`;

  const entityDesc = entity.props?.description
    ? `<p class="text-xs text-slate-500 mt-0.5 mb-2">${escHtml(entity.props.description)}</p>`
    : '';

  return `
    <div class="mb-8">
      <h3 class="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
        <span class="text-slate-400">${entity.kind === 'weak_entity' ? '⊡' : '□'}</span>
        ${escHtml(entity.label)}
        ${entity.kind === 'weak_entity' ? '<span class="text-xs font-normal text-slate-400 ml-1">(entidade fraca)</span>' : ''}
      </h3>
      ${entityDesc}
      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-sm">
          <caption class="sr-only">Atributos de ${escHtml(entity.label)}</caption>
          <thead class="bg-slate-100 text-slate-600">
            <tr>
              <th scope="col" class="dict-head text-left">Atributo</th>
              <th scope="col" class="dict-head text-left">Tipo</th>
              <th scope="col" class="dict-head text-center w-10" data-tooltip="Chave Primária — identifica unicamente cada registro">PK</th>
              <th scope="col" class="dict-head text-center w-10" data-tooltip="Chave Estrangeira — referencia outra entidade">FK</th>
              <th scope="col" class="dict-head text-center w-10" data-tooltip="Chave Única — valor não se repete na tabela">UK</th>
              <th scope="col" class="dict-head text-center w-12" data-tooltip="Não Nulo — campo obrigatório">NN</th>
              <th scope="col" class="dict-head text-center w-10" data-tooltip="Auto Incremento — valor gerado automaticamente">AI</th>
              <th scope="col" class="dict-head text-left">Referência FK</th>
              <th scope="col" class="dict-head text-left">Descrição</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _attrRow(attr, fkMap) {
  const p    = attr.props || {};
  const fkR  = fkMap.get(attr.id) || '';
  const isFk = !!fkR;
  const nnChecked = !!(p.isNotNull || p.isPK);
  const attrName  = escHtml(attr.label || 'atributo');

  const flags = [
    p.isMultivalued ? '<span class="text-purple-600 text-xs font-bold ml-1" aria-label="Multivalorado">MV</span>' : '',
    p.isDerived     ? '<span class="text-slate-400 text-xs italic ml-1" aria-label="Derivado">DER</span>'    : '',
    p.isComposite   ? '<span class="text-orange-500 text-xs font-bold ml-1" aria-label="Composto">COMP</span>' : '',
  ].join('');

  const labelCell = p.isPK
    ? `<span class="font-bold text-blue-700">${attrName}</span>${flags}`
    : `${attrName}${flags}`;

  const typeCell = (p.dataType === 'ENUM')
    ? `<div class="font-mono text-xs font-bold text-purple-700">ENUM</div>${
        p.enumValues?.length
          ? `<div class="text-xs text-slate-400 leading-tight mt-0.5">${escHtml(p.enumValues.slice(0, 5).join(', '))}${p.enumValues.length > 5 ? '…' : ''}</div>`
          : '<div class="text-xs text-slate-300 italic">sem valores</div>'
      }`
    : `<label class="sr-only" for="dict-type-${attr.id}">Tipo de dado de ${attrName}</label>
       <input id="dict-type-${attr.id}" class="dict-type prop-input font-mono text-xs w-full" data-prop="dataType"
         value="${escHtml(p.dataType || '')}" placeholder="ex: VARCHAR(50)"
         aria-label="Tipo de dado de ${attrName}">`;

  return `<tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors" data-attr-id="${attr.id}">
    <td class="dict-cell font-medium">${labelCell}</td>
    <td class="dict-cell">${typeCell}</td>
    <td class="dict-cell text-center">${_checkbox('isPK',            p.isPK,           'blue',   false,  `Chave Primária de ${attrName}`)}</td>
    <td class="dict-cell text-center">${isFk ? _tick('green', `${attrName} é Chave Estrangeira`) : ''}</td>
    <td class="dict-cell text-center">${_checkbox('isUnique',        p.isUnique,       'indigo', false,  `Chave Única de ${attrName}`)}</td>
    <td class="dict-cell text-center">${_checkbox('isNotNull',       nnChecked,        'slate',  p.isPK, `Não Nulo de ${attrName}`)}</td>
    <td class="dict-cell text-center">${_checkbox('isAutoIncrement', p.isAutoIncrement,'purple', false,  `Auto Incremento de ${attrName}`)}</td>
    <td class="dict-cell text-slate-500 text-xs">${escHtml(fkR)}</td>
    <td class="dict-cell text-slate-500 text-xs italic">${escHtml(p.description || '')}</td>
  </tr>`;
}

function _checkbox(prop, checked, color, disabled = false, label = '') {
  const accent = {
    blue:'accent-blue-600', indigo:'accent-indigo-600',
    slate:'accent-slate-600', purple:'accent-purple-600',
  };
  const ariaLabel = label ? ` aria-label="${escHtml(label)}"` : '';
  return `<input type="checkbox" data-prop="${prop}"
    class="dict-cb cursor-pointer w-4 h-4 ${accent[color] || ''}"
    ${checked   ? 'checked'  : ''}
    ${disabled  ? 'disabled' : ''}${ariaLabel}>`;
}

function _tick(color, label = 'sim') {
  const colors = {
    blue:'text-blue-600', green:'text-green-600', indigo:'text-indigo-600',
    slate:'text-slate-600', purple:'text-purple-600',
  };
  return `<span class="${colors[color]||'text-slate-600'} font-bold text-base" aria-label="${escHtml(label)}">✓</span>`;
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function _wire(content) {
  // Prop checkboxes — event delegation on tbody rows
  content.querySelectorAll('tr[data-attr-id]').forEach(row => {
    const attrId = row.dataset.attrId;

    row.querySelectorAll('.dict-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        history.snapshot();
        state.updateNode(attrId, { props: { [cb.dataset.prop]: cb.checked } });
        // PK forces NN — re-render to reflect dependency
        _render();
      });
    });

    row.querySelectorAll('.dict-type').forEach(inp => {
      inp.addEventListener('change', () => {
        history.snapshot();
        state.updateNode(attrId, { props: { dataType: inp.value } });
      });
    });
  });
}

// ─── FK map ───────────────────────────────────────────────────────────────────

function _buildFKMap(entityId) {
  const fkMap   = new Map();
  const myAttrs = new Set(state.getAttributesOf(entityId).map(a => a.id));

  for (const edge of state.edges.values()) {
    if (!edge.fkAttributeId || !myAttrs.has(edge.fkAttributeId)) continue;

    const otherNodeId = edge.sourceId === entityId ? edge.targetId : edge.sourceId;
    const otherNode   = state.nodes.get(otherNodeId);
    if (!otherNode) continue;

    let refStr = '';
    if (otherNode.kind === 'entity' || otherNode.kind === 'weak_entity') {
      refStr = otherNode.label;
    } else if (otherNode.kind === 'relationship' || otherNode.kind === 'weak_relationship') {
      const entities = state.getEntitiesOf(otherNode.id).filter(e => e.id !== entityId);
      refStr = entities.map(e => e.label).join(', ') || otherNode.label;
    }

    fkMap.set(edge.fkAttributeId, refStr);
  }
  return fkMap;
}
