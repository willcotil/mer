import { state }  from './state.js';
import { escHtml } from './utils.js';

// ─── Show modal ───────────────────────────────────────────────────────────────

export function showDataDictionary() {
  const dialog = document.getElementById('dict-dialog');
  if (!dialog) return;
  _render();
  dialog.showModal();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function _render() {
  const content = document.getElementById('dict-content');
  if (!content) return;

  const entities = Array.from(state.nodes.values()).filter(
    n => n.kind === 'entity' || n.kind === 'weak_entity'
  );

  if (!entities.length) {
    content.innerHTML = `<p class="text-slate-500 text-sm italic py-4">Nenhuma entidade no diagrama.</p>`;
    return;
  }

  content.innerHTML = entities.map(e => _entityTable(e)).join('');
}

function _entityTable(entity) {
  const attrs  = state.getAttributesOf(entity.id);
  const fkMap  = _buildFKMap(entity.id);

  const rows = attrs.length
    ? attrs.map(a => _attrRow(a, fkMap)).join('')
    : `<tr><td colspan="8" class="dict-cell italic text-slate-400">Sem atributos definidos</td></tr>`;

  return `
    <div class="mb-8">
      <h3 class="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
        <span class="text-slate-400">${entity.kind === 'weak_entity' ? '⊡' : '□'}</span>
        ${escHtml(entity.label)}
        ${entity.kind === 'weak_entity' ? '<span class="text-xs font-normal text-slate-400 ml-1">(entidade fraca)</span>' : ''}
      </h3>
      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-slate-100 text-slate-600">
            <tr>
              <th class="dict-head text-left">Atributo</th>
              <th class="dict-head text-left">Tipo</th>
              <th class="dict-head text-center w-10">PK</th>
              <th class="dict-head text-center w-10">FK</th>
              <th class="dict-head text-center w-10">UK</th>
              <th class="dict-head text-center w-12">NN</th>
              <th class="dict-head text-center w-10">AI</th>
              <th class="dict-head text-left">Referência FK</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _attrRow(attr, fkMap) {
  const p   = attr.props || {};
  const fkR = fkMap.get(attr.id) || '';
  const isFk = !!fkR;

  const flags = [
    p.isMultivalued  ? '<span class="text-purple-600 text-xs font-bold ml-1">MV</span>' : '',
    p.isDerived      ? '<span class="text-slate-400 text-xs italic ml-1">DER</span>'    : '',
    p.isComposite    ? '<span class="text-orange-500 text-xs font-bold ml-1">COMP</span>' : '',
  ].join('');

  const labelCell = p.isPK
    ? `<span class="font-bold text-blue-700">${escHtml(attr.label)}</span>${flags}`
    : `${escHtml(attr.label)}${flags}`;

  return `<tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
    <td class="dict-cell font-medium">${labelCell}</td>
    <td class="dict-cell text-slate-600 font-mono text-xs">${escHtml(p.dataType || '')}</td>
    <td class="dict-cell text-center">${p.isPK  ? _tick('blue')   : ''}</td>
    <td class="dict-cell text-center">${isFk    ? _tick('green')  : ''}</td>
    <td class="dict-cell text-center">${p.isUnique ? _tick('indigo') : ''}</td>
    <td class="dict-cell text-center">${(p.isNotNull || p.isPK) ? _tick('slate') : ''}</td>
    <td class="dict-cell text-center">${p.isAutoIncrement ? _tick('purple') : ''}</td>
    <td class="dict-cell text-slate-500 text-xs">${escHtml(fkR)}</td>
  </tr>`;
}

function _tick(color) {
  const colors = {
    blue:'text-blue-600', green:'text-green-600', indigo:'text-indigo-600',
    slate:'text-slate-600', purple:'text-purple-600',
  };
  return `<span class="${colors[color]||'text-slate-600'} font-bold text-base">✓</span>`;
}

// Build Map<attrId, "RefEntity.attr"> for FK attributes of an entity
function _buildFKMap(entityId) {
  const fkMap   = new Map();
  const myAttrs = new Set(state.getAttributesOf(entityId).map(a => a.id));

  for (const edge of state.edges.values()) {
    if (!edge.fkAttributeId || !myAttrs.has(edge.fkAttributeId)) continue;

    // Find the other side of the relationship
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
