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
    if (type === 'node:update' && node?.id === _currentId) {
      _refreshNonInputFields();
      return;
    }
    // Re-render relationship panel when a connected edge changes cardinality
    if (type === 'edge:update' && edge) {
      const cur = state.nodes.get(_currentId);
      if ((cur?.kind === 'relationship' || cur?.kind === 'weak_relationship') &&
          (edge.sourceId === _currentId || edge.targetId === _currentId)) {
        _renderPanel(_currentId);
      }
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
  'TIMESTAMP','TEXT','LONGTEXT','BLOB','UUID','SERIAL','JSON','ENUM',
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

  if (kind === 'relationship' || kind === 'weak_relationship') {
    const connectedEdges = state.getEdgesFor(id).filter(e => {
      const otherId = e.sourceId === id ? e.targetId : e.sourceId;
      const other   = state.nodes.get(otherId);
      return other && other.kind !== 'attribute';
    });
    if (connectedEdges.length > 0) {
      html += `<div class="border-t border-slate-100 pt-2">
        <p class="prop-label mb-1">Cardinalidade</p>`;
      for (const edge of connectedEdges) {
        const otherId      = edge.sourceId === id ? edge.targetId : edge.sourceId;
        const other        = state.nodes.get(otherId);
        if (!other) continue;
        const entityIsSource = edge.sourceId === otherId;
        const card  = entityIsSource ? (edge.sourceCardinality  || '') : (edge.targetCardinality  || '');
        const part  = entityIsSource ? (edge.sourceParticipation || 'partial') : (edge.targetParticipation || 'partial');
        const eName = escHtml(other.label || 'Entidade');
        html += `<div class="mb-3">
          <label class="prop-label" for="prop-card-${escHtml(edge.id)}">${eName}</label>
          <select id="prop-card-${escHtml(edge.id)}" class="prop-input mb-1"
            data-edge-id="${escHtml(edge.id)}" data-is-source="${entityIsSource}">
            ${CARD_OPTIONS.map(v => `<option value="${v}"${card===v?' selected':''}>${v||'(nenhuma)'}</option>`).join('')}
          </select>
          <div class="flex gap-4 text-sm">
            <label class="flex items-center gap-1.5">
              <input type="radio" name="part-${escHtml(edge.id)}" value="partial"
                data-edge-id="${escHtml(edge.id)}" data-is-source="${entityIsSource}"
                ${part !== 'total' ? 'checked' : ''}> Parcial
            </label>
            <label class="flex items-center gap-1.5">
              <input type="radio" name="part-${escHtml(edge.id)}" value="total"
                data-edge-id="${escHtml(edge.id)}" data-is-source="${entityIsSource}"
                ${part === 'total' ? 'checked' : ''}> Total
            </label>
          </div>
        </div>`;
      }
      html += `</div>`;
    }
  }

  if (kind === 'relationship' || kind === 'weak_relationship') {
    const fkSec = _buildFKSection(id, node);
    if (fkSec) html += fkSec;
  }

  if (kind === 'entity' || kind === 'weak_entity' || kind === 'attribute') {
    html += `<div>
      <label class="prop-label" for="prop-description">Descrição</label>
      <textarea id="prop-description" rows="3"
        class="prop-input resize-none" placeholder="Descreva este elemento...">${escHtml(props.description || '')}</textarea>
    </div>`;
  }

  if (kind === 'attribute') {
    const isEnum = props.dataType === 'ENUM';
    html += `<div>
      <label class="prop-label" for="prop-dataType">Tipo de Dado</label>
      <select id="prop-dataType" class="prop-input">
        ${DATA_TYPES.map(t => `<option${props.dataType===t?' selected':''}>${escHtml(t)}</option>`).join('')}
        <option value="${escHtml(props.dataType||'')}"${!DATA_TYPES.includes(props.dataType)?` selected`:''}>Personalizado</option>
      </select>
    </div>
    <div id="prop-enum-section"${isEnum ? '' : ' style="display:none"'}>
      <label class="prop-label" for="prop-enumValues">Valores do ENUM
        <span class="text-xs text-slate-400 font-normal">(um por linha)</span>
      </label>
      <textarea id="prop-enumValues" rows="4"
        class="prop-input resize-none font-mono text-xs"
        placeholder="ativo&#10;inativo&#10;pendente"
        data-tooltip="Liste os valores possíveis, um por linha"
      >${escHtml((props.enumValues || []).join('\n'))}</textarea>
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

const CARD_OPTIONS = ['', '(0,1)', '(1,1)', '(0,N)', '(1,N)', '(M,N)'];

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

  const hasRel  = src?.kind === 'relationship' || src?.kind === 'weak_relationship'
               || tgt?.kind === 'relationship' || tgt?.kind === 'weak_relationship';
  const hasAttr = src?.kind === 'attribute'    || tgt?.kind === 'attribute';

  const _cardOpts = (cur) =>
    CARD_OPTIONS.map(v => `<option value="${v}"${cur===v?' selected':''}>${v||'(nenhuma)'}</option>`).join('');

  let html = `<div class="p-4 space-y-3">
    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Conexão</h3>

    <div class="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
      ${srcName} → ${tgtName}
    </div>`;

  if (!hasRel && !hasAttr) {
    html += `
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
    </fieldset>`;
  }

  if (hasRel) {
    html += `<p class="text-xs text-slate-400 italic">Cardinalidade definida no relacionamento</p>`;
  }

  if (!hasAttr) {
    html += `
    <div>
      <label class="prop-label" for="prop-fk">Chave Estrangeira (FK)</label>
      <select id="prop-fk" class="prop-input">
        <option value="">— sem FK —</option>
        ${allAttrs.map(a => `<option value="${a.id}"${fkAttributeId===a.id?' selected':''}>${escHtml(a.label)}</option>`).join('')}
      </select>
      <p class="text-xs text-slate-400 mt-1">Atributo que armazena a referência à entidade relacionada</p>
    </div>`;
  }

  html += `
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
    const newType = e.target.value;
    state.updateNode(id, { props: { dataType: newType } });
    const sec = q('#prop-enum-section');
    if (sec) sec.style.display = newType === 'ENUM' ? '' : 'none';
  });

  q('#prop-enumValues')?.addEventListener('input', e => {
    history.snapshotDebounced();
    const values = e.target.value.split('\n').map(v => v.trim()).filter(Boolean);
    state.updateNode(id, { props: { enumValues: values } });
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

  _panelEl.querySelectorAll('select[data-edge-id]').forEach(sel => {
    sel.addEventListener('change', e => {
      history.snapshot();
      const field = sel.dataset.isSource === 'true' ? 'sourceCardinality' : 'targetCardinality';
      state.updateEdge(sel.dataset.edgeId, { [field]: e.target.value });
    });
  });

  _panelEl.querySelectorAll('input[type="radio"][data-edge-id]').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      history.snapshot();
      const field = r.dataset.isSource === 'true' ? 'sourceParticipation' : 'targetParticipation';
      state.updateEdge(r.dataset.edgeId, { [field]: r.value });
    });
  });

  // 1:1 FK direction
  _panelEl.querySelectorAll('input[name="fk-dir"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      history.snapshot();
      state.updateNode(id, { props: { fk1to1ReceiverNodeId: r.value } });
      _renderPanel(id);
    });
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

// ─── Relationship FK derivation ───────────────────────────────────────────────

const _cardType = c =>
  c === '(1,1)' || c === '(0,1)' || c === '1..1' || c === '0..1' ? '1' :
  c === '(1,N)' || c === '(0,N)' || c === '(M,N)' || c === '1..N' || c === '0..N' || c === 'M..N' ? 'N' : null;

function _relPKCol(entityNode) {
  const pk = state.getAttributesOf(entityNode.id).find(a => a.props?.isPK);
  const name = pk ? pk.label : `${entityNode.label}_id`;
  return name.toLowerCase().replace(/\s+/g, '_');
}

function _fkColName(refEntity) {
  const pk   = state.getAttributesOf(refEntity.id).find(a => a.props?.isPK);
  const attr = pk ? pk.label.toLowerCase().replace(/\s+/g, '_') : null;
  const ent  = refEntity.label.toLowerCase().replace(/\s+/g, '_');
  return attr ? `${attr}_${ent}_fk` : `${ent}_fk`;
}

function _analyzeRel(relId) {
  const entityEdges = state.getEdgesFor(relId).filter(e => {
    const oid = e.sourceId === relId ? e.targetId : e.sourceId;
    const o   = state.nodes.get(oid);
    return o && (o.kind === 'entity' || o.kind === 'weak_entity');
  });
  if (entityEdges.length !== 2) return null;
  const [eA, eB] = entityEdges;
  const nAId = eA.sourceId === relId ? eA.targetId : eA.sourceId;
  const nBId = eB.sourceId === relId ? eB.targetId : eB.sourceId;
  const nodeA = state.nodes.get(nAId);
  const nodeB = state.nodes.get(nBId);
  const cardA = _cardType(eA.sourceId === nAId ? eA.sourceCardinality : eA.targetCardinality);
  const cardB = _cardType(eB.sourceId === nBId ? eB.sourceCardinality : eB.targetCardinality);
  const relAttrs = state.getAttributesOf(relId);
  if (!cardA || !cardB) return { type: null, nodeA, nodeB, relAttrs };
  if (cardA === '1' && cardB === '1') return { type: '1:1', nodeA, nodeB, relAttrs };
  if (cardA === '1' && cardB === 'N') return { type: '1:N', side1: nodeA, sideN: nodeB, relAttrs };
  if (cardA === 'N' && cardB === '1') return { type: '1:N', side1: nodeB, sideN: nodeA, relAttrs };
  return { type: 'N:N', nodeA, nodeB, relAttrs };
}

function _buildFKSection(relId, relNode) {
  const a = _analyzeRel(relId);
  if (!a) return '';
  const receiverId = relNode.props?.fk1to1ReceiverNodeId || null;
  let content = '';

  if (!a.type) {
    content = `<p class="text-xs text-slate-400 italic">Defina as cardinalidades das duas entidades para ver a derivação de chave.</p>`;
  } else if (a.type === '1:1') {
    const rcv   = receiverId ? state.nodes.get(receiverId) : null;
    const donor = rcv ? (rcv.id === a.nodeA.id ? a.nodeB : a.nodeA) : null;
    content = `
      <p class="text-xs text-slate-500 mb-2">Relacionamento 1:1 — quem recebe a FK?</p>
      <div class="space-y-1">
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="fk-dir" value="${escHtml(a.nodeA.id)}" ${receiverId===a.nodeA.id?'checked':''}>
          <span>${escHtml(a.nodeA.label)} recebe FK de ${escHtml(a.nodeB.label)}</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="fk-dir" value="${escHtml(a.nodeB.id)}" ${receiverId===a.nodeB.id?'checked':''}>
          <span>${escHtml(a.nodeB.label)} recebe FK de ${escHtml(a.nodeA.label)}</span>
        </label>
      </div>
      ${rcv && donor ? `<p class="text-xs font-mono bg-slate-50 border border-slate-200 rounded p-1.5 mt-2 text-slate-600">${escHtml(rcv.label)}.${_fkColName(donor)} → ${escHtml(donor.label)}</p>` : ''}`;
  } else if (a.type === '1:N') {
    content = `<p class="text-xs font-mono bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-600">${escHtml(a.sideN.label)}.${_fkColName(a.side1)} → ${escHtml(a.side1.label)}</p>`;
  } else if (a.type === 'N:N') {
    const attrLines = a.relAttrs.map(attr =>
      `<p class="font-mono text-slate-400">+ ${escHtml(attr.label)} (${escHtml(attr.props?.dataType||'?')})</p>`
    ).join('');
    const junctionName = `${a.nodeA.label.toLowerCase().replace(/\s+/g, '_')}_${a.nodeB.label.toLowerCase().replace(/\s+/g, '_')}`;
    content = `<div class="text-xs bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5">
      <p class="font-semibold text-slate-600">Tabela: ${escHtml(junctionName)}</p>
      <p class="font-mono text-slate-500">→ ${escHtml(_fkColName(a.nodeA))} FK → ${escHtml(a.nodeA.label)}</p>
      <p class="font-mono text-slate-500">→ ${escHtml(_fkColName(a.nodeB))} FK → ${escHtml(a.nodeB.label)}</p>
      ${attrLines}
    </div>`;
  }

  return `<div class="border-t border-slate-100 pt-2">
    <p class="prop-label mb-1">Derivação de Chave</p>
    ${content}
  </div>`;
}
