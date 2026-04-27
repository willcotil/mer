import { state }                           from './state.js';
import { history }                         from './history.js';
import { screenToCanvas, computeAutoSize } from './utils.js';
import { getDefaultStyle }                 from './shapes.js';
import { grid }                            from './grid.js';

let _svg         = null;
let _activeTool  = null;  // kind string or null
let _activePreset = null; // preset string or null

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initToolbox(svg) {
  _svg = svg;

  document.querySelectorAll('[data-tool-kind]').forEach(item => {
    // HTML5 drag-and-drop
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/mer-kind',   item.dataset.toolKind);
      e.dataTransfer.setData('application/mer-preset', item.dataset.preset || '');
      e.dataTransfer.effectAllowed = 'copy';
    });
    // Click-to-place mode
    item.addEventListener('click', e => {
      e.stopPropagation();
      _setActiveTool(item.dataset.toolKind, item.dataset.preset || '');
    });
  });

  svg.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  svg.addEventListener('drop',     _onDrop);
  svg.addEventListener('click',    _onCanvasClick);

  // Snap-to-grid controls
  const snapChk  = document.getElementById('snap-enabled');
  const snapSize = document.getElementById('snap-size');
  snapChk?.addEventListener('change', () => { grid.enabled = snapChk.checked; });
  snapSize?.addEventListener('change', () => { grid.size = parseInt(snapSize.value, 10); });
}

// ─── Active tool ──────────────────────────────────────────────────────────────

function _setActiveTool(kind, preset = '') {
  // Toggle off if same tool clicked again
  if (_activeTool === kind && _activePreset === preset) {
    _activeTool = null; _activePreset = null;
  } else {
    _activeTool = kind; _activePreset = preset;
  }
  _svg.style.cursor = _activeTool ? 'crosshair' : '';
  // Highlight active item in toolbox
  document.querySelectorAll('[data-tool-kind]').forEach(item => {
    item.classList.toggle('active',
      item.dataset.toolKind === _activeTool && (item.dataset.preset || '') === (_activePreset || ''));
  });
}

function _onCanvasClick(e) {
  if (!_activeTool) return;
  // Don't place over an existing element
  const hit = e.target.closest('[data-id]');
  if (hit) return;
  const pos = screenToCanvas(e.clientX, e.clientY, _svg, state.canvas);
  _placeNode(_activeTool, pos.x, pos.y, _activePreset || '');
  _setActiveTool(null); // single-use
}

// ─── Drop handler ─────────────────────────────────────────────────────────────

function _onDrop(e) {
  e.preventDefault();
  const kind   = e.dataTransfer.getData('application/mer-kind');
  const preset = e.dataTransfer.getData('application/mer-preset') || '';
  if (!kind) return;
  const pos = screenToCanvas(e.clientX, e.clientY, _svg, state.canvas);
  _placeNode(kind, pos.x, pos.y, preset);
}

// ─── Place node ───────────────────────────────────────────────────────────────

function _placeNode(kind, cx, cy, preset = '') {
  const label = _defaultLabel(kind, preset);
  const props = _defaultProps(kind, preset);
  const { width, height } = computeAutoSize(label, kind);
  history.snapshot();
  const node = state.addNode({
    kind,
    x: grid.snap(cx) - width  / 2,
    y: grid.snap(cy) - height / 2,
    width, height,
    autoSize: true,
    label,
    style: getDefaultStyle(kind),
    props,
  });
  state.setSelection([node.id]);
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function _defaultLabel(kind, preset = '') {
  if (kind === 'attribute') {
    if (preset === 'pk')          return 'id';
    if (preset === 'multivalued') return 'valores';
    if (preset === 'derived')     return 'calculado';
    return 'atributo';
  }
  const map = {
    entity:'Entidade', weak_entity:'Ent. Fraca',
    relationship:'relacionamento', weak_relationship:'rel. fraca',
    aggregation:'', generalization:'',
  };
  return map[kind] ?? 'Novo';
}

function _defaultProps(kind, preset = '') {
  if (kind === 'attribute') {
    const base = {
      dataType:'VARCHAR(50)', isPK:false, isUnique:false, isNotNull:false,
      isAutoIncrement:false, isMultivalued:false, isDerived:false, isComposite:false,
    };
    if (preset === 'pk')           return { ...base, dataType:'SERIAL', isPK:true, isNotNull:true, isAutoIncrement:true };
    if (preset === 'multivalued')  return { ...base, isMultivalued:true };
    if (preset === 'derived')      return { ...base, isDerived:true };
    return base;
  }
  if (kind === 'aggregation')    return { containedNodeIds:[] };
  if (kind === 'generalization') return { isDisjoint:true };
  return {};
}
