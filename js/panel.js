import { state }   from './state.js';
import { history } from './history.js';
import { escHtml } from './utils.js';

let _panelEl   = null;
let _currentId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initPanel(panelEl) {
  _panelEl = panelEl;
  state.on('selection-change', _onSelectionChange);
  state.on('change', ({ type, node, edge }) => {
    if (!_currentId) return;
    if ((type === 'node:update' && node?.id === _currentId) ||
        (type === 'edge:update' && edge?.id === _currentId)) {
      // Avoid re-rendering while user is typing — only update non-input fields
      _refreshNonInputFields();
    }
  });
  // Quick rename via double-click
  document.addEventListener('mer:rename', e => {
    const inp = _panelEl.querySelector('#prop-label');
    if (inp && _currentId === e.detail.id) { inp.focus(); inp.select(); }
  });
  _showEmpty();
}

// ─── Selection change ─────────────────────────────────────────────────────────

function _onSelectionChange() {
  if (!state.selection.size) { _showEmpty(); _currentId = null; return; }
  if (state.selection.size > 1) { _showMulti(state.selection.size); _currentId = null; return; }
  const [id] = state.selection;
  _currentId = id;
  _renderPanel(id);
}

function _renderPanel(id) {
  const node = state.nodes.get(id);
  const edge = state.edges.get(id);
  if (node) _renderNodePanel(node);
  else if (edge) _renderEdgePanel(edge);
}

// ─── Partial refresh (avoid disrupting input focus) ──────────────────────────

function _refreshNonInputFields() {
  // Only update the delete button state and similar
  // Inputs are kept as-is (user may be typing)
}

// ─── Empty / multi states ─────────────────────────────────────────────────────

function _showEmpty() {
  _panelEl.innerHTML = `
    <div class="p-4 pt-8 text-center text-slate-400 text-sm select-none">
      <div class="text-3xl mb-3 opacity-40">⟆</div>
      <p>Selecione um elemento</p>
      <p class="text-xs mt-1 opacity-70">para editar suas propriedades</p>
    </div>`;
}

function _showMulti(n) {
  _panelEl.innerHTML = `
    <div class="p-4 text-sm text-slate-600">
      <p class="font-semibold text-slate-700">${n} elementos selecionados</p>
      <p class="text-xs mt-1 text-slate-400">Arraste para mover em conjunto</p>
    </div>`;
}

// ─── Node panel ───────────────────────────────────────────────────────────────

const KIND_NAME = {
  entity:'Entidade', weak_entity:'Entidade Fraca', attribute:'Atributo',
  relationship:'Relacionamento', weak_relationship:'Rel. Identificador',
  aggregation:'Agregação', generalization:'Generalização',
};

const DATA_TYPES = [
  'VARCHAR(50)','VARCHAR(255)','CHAR(10)','INT','BIGINT','SMALLINT',
  'DECIMAL(10,2)','FLOAT','DOUBLE','BOOLEAN','DATE','TIME','DATETIME',
  'TIMESTAMP','TEXT','LONGTEXT','BLOB','UUID','SERIAL','JSON',
];

function _renderNodePanel(node) {
  const { id, kind, label='', style={}, props={} } = node;

  let html = `<div class="p-4 space-y-3">
    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">${KIND_NAME[kind]||kind}</h3>`;

  if (kind !== 'aggregation') {
    html += `<div>
      <label class="prop-label" for="prop-label" data-tooltip="Nome exibido no diagrama">Nome</label>
      <input type="text" id="prop-label" value="${escHtml(label)}"
        class="prop-input" placeholder="Nome do elemento">
    </div>`;
  }

  if (kind === 'entity' || kind === 'weak_entity') {
    html += `<fieldset class="space-y-1.5 border-0 p-0 m-0">
      <legend class="prop-label">Tipo</legend>
      ${_cb('prop-isWeak', 'Entidade Fraca', kind === 'weak_entity')}
    </fieldset>`;
  }

  if (kind === 'relationship' || kind === 'weak_relationship') {
    html += `<fieldset class="space-y-1.5 border-0 p-0 m-0">
      <legend class="prop-label">Tipo</legend>
      ${_cb('prop-isWeak', 'Relacionamento Identificador', kind === 'weak_relationship')}
    </fieldset>`;
  }

  if (kind === 'entity' || kind === 'weak_entity' || kind === 'attribute') {
    html += `<div>
      <label class="prop-label" for="prop-description">Descrição</label>
      <textarea id="prop-description" rows="3"
        class="prop-input resize-none" placeholder="Descreva este elemento...">${escHtml(props.description || '')}</textarea>
    </div>`;
  }

  if (kind === 'attribute') {
    html += `<div>
      <label class="prop-label" for="prop-dataType">Tipo de Dado</label>
      <select id="prop-dataType" class="prop-input">
        ${DATA_TYPES.map(t => `<option${props.dataType===t?' selected':''}>${escHtml(t)}</option>`).join('')}
        <option value="${escHtml(props.dataType||'')}"${!DATA_TYPES.includes(props.dataType)?` selected`:''}>Personalizado</option>
      </select>
    </div>
    <fieldset class="space-y-1.5 border-0 p-0 m-0">
      <legend class="prop-label">Restrições</legend>
      ${_cb('prop-isPK',           'Chave Primária (PK)',  props.isPK)}
      ${_cb('prop-isUnique',       'Chave Única (UK)',     props.isUnique)}
      ${_cb('prop-isNotNull',      'Não Nulo (NOT NULL)',  props.isNotNull)}
      ${_cb('prop-isAutoIncrement','Auto Incremento (AI)', props.isAutoIncrement)}
      ${_cb('prop-isMultivalued',  'Multivalorado',        props.isMultivalued)}
      ${_cb('prop-isDerived',      'Derivado',             props.isDerived)}
      ${_cb('prop-isComposite',    'Composto',             props.isComposite)}
    </fieldset>`;
  }

  if (kind === 'generalization') {
    html += `<fieldset class="space-y-1.5 border-0 p-0 m-0">
      <legend class="prop-label">Tipo de Especialização</legend>
      <label class="flex items-center gap-2 text-sm">
        <input type="radio" name="gen-type" value="disjoint" ${props.isDisjoint!==false?'checked':''}> Disjunto (d)
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="radio" name="gen-type" value="overlapping" ${props.isDisjoint===false?'checked':''}> Sobreposição (o)
      </label>
    </fieldset>`;
  }

  html += `<div class="pt-2 border-t border-slate-100">
    <fieldset class="border-0 p-0 m-0">
      <legend class="prop-label">Aparência</legend>
      <div class="flex gap-3 mt-1">
        <div>
          <label for="prop-fill" class="text-xs text-slate-400 mb-1 block" data-tooltip="Cor de preenchimento do elemento">Preenchimento</label>
          <input type="color" id="prop-fill" value="${escHtml(style.fill||'#ffffff')}"
            class="h-9 w-14 rounded cursor-pointer border border-slate-200 p-0.5 bg-white"
            aria-label="Cor de preenchimento">
        </div>
        <div>
          <label for="prop-stroke" class="text-xs text-slate-400 mb-1 block" data-tooltip="Cor da borda do elemento">Borda</label>
          <input type="color" id="prop-stroke" value="${escHtml(style.stroke||'#334155')}"
            class="h-9 w-14 rounded cursor-pointer border border-slate-200 p-0.5 bg-white"
            aria-label="Cor da borda">
        </div>
      </div>
    </fieldset>
  </div>

  <div class="flex items-center gap-2 text-sm">
    <input type="checkbox" id="prop-autoSize" ${node.autoSize?'checked':''}
      class="rounded border-slate-300 text-blue-500">
    <label for="prop-autoSize" class="text-slate-600">Tamanho automático</label>
  </div>

  <div class="pt-2 border-t border-slate-100">
    <button id="btn-delete"
      class="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium">
      ✕ Excluir elemento
    </button>
  </div></div>`;

  _panelEl.innerHTML = html;
  _wireNode(id);
}

// ─── Edge panel ───────────────────────────────────────────────────────────────

const CARD_OPTIONS = ['', '0..1', '1..1', '0..N', '1..N', 'M..N'];

function _renderEdgePanel(edge) {
  const { id, sourceId, targetId, sourceCardinality='', targetCardinality='',
          sourceParticipation='partial', targetParticipation='partial', fkAttributeId } = edge;

  const src = state.nodes.get(sourceId);
  const tgt = state.nodes.get(targetId);
  const srcName = escHtml(src?.label || 'Origem');
  const tgtName = escHtml(tgt?.label || 'Destino');

  // Collect attributes from both connected nodes (for FK selector)
  const allAttrs = [];
  const collectAttrs = (entityId, prefix) => {
    state.getAttributesOf(entityId).forEach(a => {
      allAttrs.push({ id: a.id, label: `${prefix}.${a.label}` });
    });
  };
  if (src) collectAttrs(sourceId, src.label || 'Origem');
  if (tgt) collectAttrs(targetId, tgt.label || 'Destino');

  const _cardOpts = (cur) =>
    CARD_OPTIONS.map(v => `<option value="${v}"${cur===v?' selected':''}>${v||'(nenhuma)'}</option>`).join('');

  const html = `<div class="p-4 space-y-3">
    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Conexão</h3>

    <div class="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
      ${srcName} → ${tgtName}
    </div>

    <div>
      <label class="prop-label" for="prop-srcCard" data-tooltip="Define quantas instâncias participam do relacionamento">Cardinalidade — ${srcName}</label>
      <select id="prop-srcCard" class="prop-input">${_cardOpts(sourceCardinality)}</select>
    </div>
    <div>
      <label class="prop-label" for="prop-tgtCard" data-tooltip="Define quantas instâncias participam do relacionamento">Cardinalidade — ${tgtName}</label>
      <select id="prop-tgtCard" class="prop-input">${_cardOpts(targetCardinality)}</select>
    </div>

    <fieldset class="border-0 p-0 m-0">
      <legend class="prop-label" data-tooltip="Total = todas as instâncias participam; Parcial = participação opcional">Participação — ${srcName}</legend>
      <div class="flex gap-4 text-sm mt-1">
        <label class="flex items-center gap-1.5"><input type="radio" name="src-part" value="partial" ${sourceParticipation!=='total'?'checked':''}> Parcial</label>
        <label class="flex items-center gap-1.5"><input type="radio" name="src-part" value="total"   ${sourceParticipation==='total'?'checked':''}>  Total</label>
      </div>
    </fieldset>
    <fieldset class="border-0 p-0 m-0">
      <legend class="prop-label" data-tooltip="Total = todas as instâncias participam; Parcial = participação opcional">Participação — ${tgtName}</legend>
      <div class="flex gap-4 text-sm mt-1">
        <label class="flex items-center gap-1.5"><input type="radio" name="tgt-part" value="partial" ${targetParticipation!=='total'?'checked':''}> Parcial</label>
        <label class="flex items-center gap-1.5"><input type="radio" name="tgt-part" value="total"   ${targetParticipation==='total'?'checked':''}>  Total</label>
      </div>
    </fieldset>

    <div>
      <label class="prop-label" for="prop-fk">Chave Estrangeira (FK)</label>
      <select id="prop-fk" class="prop-input">
        <option value="">— sem FK —</option>
        ${allAttrs.map(a => `<option value="${a.id}"${fkAttributeId===a.id?' selected':''}>${escHtml(a.label)}</option>`).join('')}
      </select>
      <p class="text-xs text-slate-400 mt-1">Atributo que armazena a referência à entidade relacionada</p>
    </div>

    <div class="pt-2 border-t border-slate-100">
      <button id="btn-delete"
        class="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium">
        ✕ Excluir conexão
      </button>
    </div>
  </div>`;

  _panelEl.innerHTML = html;
  _wireEdge(id);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function _wireNode(id) {
  const q = sel => _panelEl.querySelector(sel);

  q('#prop-label')?.addEventListener('input', e => {
    history.snapshotDebounced();
    state.updateNode(id, { label: e.target.value });
  });

  q('#prop-isWeak')?.addEventListener('change', e => {
    const node = state.nodes.get(id);
    if (!node) return;
    history.snapshot();
    const isEntity = node.kind === 'entity' || node.kind === 'weak_entity';
    const newKind  = isEntity
      ? (e.target.checked ? 'weak_entity'        : 'entity')
      : (e.target.checked ? 'weak_relationship'  : 'relationship');
    state.updateNode(id, { kind: newKind });
    // Re-render panel so the heading updates
    _renderPanel(id);
  });

  q('#prop-description')?.addEventListener('input', e => {
    history.snapshotDebounced();
    state.updateNode(id, { props: { description: e.target.value } });
  });

  q('#prop-dataType')?.addEventListener('change', e => {
    history.snapshot();
    state.updateNode(id, { props: { dataType: e.target.value } });
  });

  ['isPK','isUnique','isNotNull','isAutoIncrement','isMultivalued','isDerived','isComposite'].forEach(p => {
    q(`#prop-${p}`)?.addEventListener('change', e => {
      history.snapshot();
      state.updateNode(id, { props: { [p]: e.target.checked } });
    });
  });

  _panelEl.querySelectorAll('input[name="gen-type"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) { history.snapshot(); state.updateNode(id, { props: { isDisjoint: r.value === 'disjoint' } }); }
    });
  });

  const fillEl   = q('#prop-fill');
  const strokeEl = q('#prop-stroke');
  fillEl?.addEventListener('input',  e => state.updateNode(id, { style: { fill:   e.target.value } }));
  fillEl?.addEventListener('change', ()  => history.snapshot());
  strokeEl?.addEventListener('input',  e => state.updateNode(id, { style: { stroke: e.target.value } }));
  strokeEl?.addEventListener('change', ()  => history.snapshot());

  q('#prop-autoSize')?.addEventListener('change', e => {
    state.updateNode(id, { autoSize: e.target.checked });
  });

  q('#btn-delete')?.addEventListener('click', () => {
    history.snapshot();
    state.deleteNode(id);
  });
}

function _wireEdge(id) {
  const q = sel => _panelEl.querySelector(sel);

  q('#prop-srcCard')?.addEventListener('change', e => {
    history.snapshot();
    state.updateEdge(id, { sourceCardinality: e.target.value });
  });
  q('#prop-tgtCard')?.addEventListener('change', e => {
    history.snapshot();
    state.updateEdge(id, { targetCardinality: e.target.value });
  });

  _panelEl.querySelectorAll('input[name="src-part"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) { history.snapshot(); state.updateEdge(id, { sourceParticipation: r.value }); }
    });
  });
  _panelEl.querySelectorAll('input[name="tgt-part"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) { history.snapshot(); state.updateEdge(id, { targetParticipation: r.value }); }
    });
  });

  q('#prop-fk')?.addEventListener('change', e => {
    history.snapshot();
    state.updateEdge(id, { fkAttributeId: e.target.value || null });
  });

  q('#btn-delete')?.addEventListener('click', () => {
    history.snapshot();
    state.deleteEdge(id);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _CB_TOOLTIPS = {
  'prop-isPK':           'Marca o atributo como chave primária',
  'prop-isUnique':       'Chave alternativa — valor único na tabela',
  'prop-isNotNull':      'Campo obrigatório — não aceita valores nulos',
  'prop-isAutoIncrement':'Valor gerado automaticamente pelo banco',
  'prop-isMultivalued':  'Atributo que pode ter múltiplos valores (ex: telefones)',
  'prop-isDerived':      'Atributo calculado a partir de outros atributos',
  'prop-isComposite':    'Atributo formado por subatributos',
  'prop-isWeak':         'Entidade ou relacionamento dependente de outro para existir',
};

function _cb(id, label, checked) {
  const tip = _CB_TOOLTIPS[id] ? ` data-tooltip="${_CB_TOOLTIPS[id]}"` : '';
  return `<label class="flex items-center gap-2 text-sm cursor-pointer"${tip}>
    <input type="checkbox" id="${id}" ${checked?'checked':''}
      class="rounded border-slate-300 text-blue-500 cursor-pointer">
    ${label}
  </label>`;
}
