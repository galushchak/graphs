import './style.css';
import { mountApp } from './app-view';
import { parseCoordinates } from './coordinates';
import { formatHoverX, formatHoverY, inspectSeriesAt } from './graph-inspector';
import { GraphPlotter } from './graph';
import { renderSeriesEditor } from './series-editor';
import { getSeriesName, type EditableSeries } from './series';
import {
  deletePreset,
  loadPresets,
  loadSeriesState,
  savePreset,
  saveSeriesState,
  seriesStateReducer,
} from './series-state';
import { setupViewportControls, type ViewportControlsController } from './viewport-controls';
import { GraphModel, exportGraphSnapshot, importGraphSnapshot } from './graph-model';

const elements = mountApp();
const plotter = new GraphPlotter(elements.graph);
const initialState = loadSeriesState();
let currentDomain = initialState.domain ?? { min: -10, max: 10 };
let keyboardInspectX = (currentDomain.min + currentDomain.max) / 2;
const graphModel = new GraphModel({
  series: initialState.series,
  nextId: initialState.nextId,
  domain: currentDomain,
});
let nextId = graphModel.getSnapshot().nextId;
let series: EditableSeries[] = graphModel.getSnapshot().series;
let historyCommitTimer: number | undefined;

function showError(message = ''): void {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.toggle('is-visible', message.length > 0);
}

function handleDomainChange(domain: typeof currentDomain): void {
  flushHistoryCommit();
  currentDomain = { ...domain };
  keyboardInspectX = (currentDomain.min + currentDomain.max) / 2;
  graphModel.commit({ series, nextId, domain: currentDomain });
  persistSeries();
  updateGraphDescription();
}

function announceStatus(message: string): void {
  elements.statusAnnouncer.textContent = message;
}

function syncHistoryControls(): void {
  elements.undoButton.disabled = !graphModel.canUndo();
  elements.redoButton.disabled = !graphModel.canRedo();
}

function applyCurrentSnapshot(snapshot: {
  series: EditableSeries[];
  nextId: number;
  domain?: typeof currentDomain;
}): void {
  series = snapshot.series;
  nextId = snapshot.nextId;
  currentDomain = snapshot.domain ?? currentDomain;
  keyboardInspectX = (currentDomain.min + currentDomain.max) / 2;
  elements.minInput.value = String(currentDomain.min);
  elements.maxInput.value = String(currentDomain.max);
  viewportControls?.syncDomain(currentDomain);
  plotter.setDomain(currentDomain);
  persistSeries();
  renderEditor();
  updateGraph();
  syncHistoryControls();
}

function flushHistoryCommit(): void {
  if (historyCommitTimer !== undefined) {
    window.clearTimeout(historyCommitTimer);
    historyCommitTimer = undefined;
    graphModel.commit({ series, nextId, domain: currentDomain });
    syncHistoryControls();
  }
}

function scheduleHistoryCommit(): void {
  if (historyCommitTimer !== undefined) {
    window.clearTimeout(historyCommitTimer);
  }
  historyCommitTimer = window.setTimeout(() => {
    historyCommitTimer = undefined;
    graphModel.commit({ series, nextId, domain: currentDomain });
    syncHistoryControls();
  }, 500);
}

function applySnapshot(
  snapshot: { series: EditableSeries[]; nextId: number },
  message?: string,
): void {
  flushHistoryCommit();
  const committed = graphModel.commit({ ...snapshot, domain: currentDomain });
  applyCurrentSnapshot(committed);
  if (message) {
    announceStatus(message);
  }
}

plotter.setOnError(showError);

function updateGraphDescription(): void {
  const descriptions = series.map((item) => {
    const graphType = item.type;
    if (item.kind === 'function') {
      const decorations = [
        item.dashed && (item.type === 'line' || item.type === 'spline') ? 'dashed' : '',
        item.markers && (item.type === 'line' || item.type === 'spline')
          ? 'with point markers'
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `${getSeriesName(item)}: ${item.visible ? 'visible' : 'hidden'} ${decorations ? `${decorations} ` : ''}${graphType} graph of y = ${item.expression || 'an empty expression'}.`;
    }
    const decorations = [
      item.dashed && (item.type === 'line' || item.type === 'spline') ? 'dashed' : '',
      item.markers && (item.type === 'line' || item.type === 'spline') ? 'with point markers' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return `${getSeriesName(item)}: ${item.visible ? 'visible' : 'hidden'} ${decorations ? `${decorations} ` : ''}${graphType} graph using coordinate data with X key ${item.xKey} and Y key ${item.yKey}.`;
  });
  const range = `Horizontal range: ${elements.minInput.value} to ${elements.maxInput.value}. The vertical axis auto-scales.`;
  elements.graphDescription.textContent = descriptions.length
    ? `${range} ${descriptions.join(' ')}`
    : `${range} No series are currently plotted.`;
}

function updateGraph(): boolean {
  updateGraphDescription();
  updateGraphLegend();
  try {
    const visibleSeries = series
      .filter((item) => item.visible)
      .map((item) => {
        if (item.kind === 'coordinates') {
          return { ...item, points: parseCoordinates(item.dataText, item.xKey, item.yKey) };
        }
        return item;
      });
    plotter.setSeries(visibleSeries);
    showError();
    return true;
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to plot this expression.');
    return false;
  }
}

function syncPresetControls(): void {
  const presets = loadPresets();
  const selected = elements.presetList.value;
  elements.presetList.replaceChildren();
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = presets.length ? 'Select a preset' : 'No presets saved';
  elements.presetList.append(emptyOption);

  for (const preset of presets) {
    const option = document.createElement('option');
    option.value = preset.name;
    option.textContent = preset.name;
    if (selected === preset.name) {
      option.selected = true;
    }
    elements.presetList.append(option);
  }

  if (selected && !presets.some((preset) => preset.name === selected)) {
    elements.presetList.value = '';
  } else if (!selected && presets.length > 0) {
    elements.presetList.value = presets[0].name;
  } else if (selected) {
    elements.presetList.value = selected;
  }

  elements.loadPreset.disabled = presets.length === 0;
  elements.deletePreset.disabled = presets.length === 0;
}

function persistSeries(): void {
  const didSave = saveSeriesState({ series, nextId, domain: currentDomain });
  elements.saveStatus.textContent = didSave
    ? 'Saved locally'
    : 'Changes could not be saved in this browser';
  elements.saveStatus.classList.toggle('is-error', !didSave);
}

function updateGraphLegend(): void {
  const entries = series.filter((item) => item.visible);
  if (entries.length === 0) {
    elements.graphLegend.innerHTML = '<span class="legend-empty">No visible series</span>';
    return;
  }

  elements.graphLegend.innerHTML = entries
    .map((item) => {
      const label = getSeriesName(item);
      const swatch = `<span class="legend-swatch" style="background:${item.color}"></span>`;
      return `<span class="legend-item">${swatch}<span>${label}</span></span>`;
    })
    .join('');
}

function updateGraphInspectorAt(hoverX: number, pointerX: number): void {
  elements.graphCrosshair.style.left = `${pointerX}px`;
  elements.graphCrosshair.classList.add('is-visible');
  elements.graphInspector.replaceChildren();
  const xRow = document.createElement('div');
  xRow.className = 'inspector-row';
  const xLabel = document.createElement('span');
  xLabel.className = 'inspector-label';
  xLabel.textContent = 'x';
  const xValue = document.createElement('span');
  xValue.className = 'inspector-value';
  xValue.textContent = `≈ ${formatHoverX(hoverX)}`;
  xRow.append(xLabel, xValue);
  elements.graphInspector.append(xRow);

  const samples = inspectSeriesAt(series, hoverX);
  for (const sample of samples) {
    const item = series.find((candidate) => getSeriesName(candidate) === sample.label);
    const row = document.createElement('div');
    row.className = 'inspector-row';
    const label = document.createElement('span');
    label.className = 'inspector-label';
    const swatch = document.createElement('span');
    swatch.className = 'inspector-swatch';
    swatch.style.backgroundColor = item?.color ?? '#85899a';
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = sample.label;
    label.append(swatch, name);
    const value = document.createElement('span');
    value.className = 'inspector-value';
    value.textContent = `y ≈ ${formatHoverY(sample.value)}`;
    row.append(label, value);
    elements.graphInspector.append(row);
  }
  if (samples.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'inspector-row';
    empty.textContent = 'No visible series values at this point.';
    elements.graphInspector.append(empty);
  }
}

function updateGraphInspector(event?: PointerEvent): void {
  if (!event) {
    elements.graphCrosshair.classList.remove('is-visible');
    elements.graphInspector.textContent = 'Hover over the graph to inspect values.';
    return;
  }

  const bounds = elements.graph.getBoundingClientRect();
  const min = currentDomain.min;
  const max = currentDomain.max;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    elements.graphInspector.textContent = 'Hover over the graph to inspect values.';
    return;
  }

  const plotLeft = 52;
  const plotRight = bounds.width - 24;
  const pointerX = event.clientX - bounds.left;
  if (pointerX < plotLeft || pointerX > plotRight) {
    elements.graphCrosshair.classList.remove('is-visible');
    elements.graphInspector.textContent = 'Hover over the graph to inspect values.';
    return;
  }

  const hoverX = min + ((pointerX - plotLeft) / (plotRight - plotLeft)) * (max - min);
  updateGraphInspectorAt(hoverX, pointerX);
}

function renderEditor(): void {
  renderSeriesEditor(elements.functionList, elements.functionCount, series, {
    onChange: () => {
      scheduleHistoryCommit();
      persistSeries();
      updateGraph();
    },
    onNameChange: () => {
      scheduleHistoryCommit();
      persistSeries();
      updateGraphDescription();
      updateGraphLegend();
    },
    onRemove: (id) => {
      const nextState = seriesStateReducer({ series, nextId }, { type: 'remove', id });
      applySnapshot(nextState, `Removed series ${id}.`);
    },
    onReorder: (fromId, toId) => {
      const nextState = seriesStateReducer({ series, nextId }, { type: 'reorder', fromId, toId });
      applySnapshot(nextState, 'Reordered series.');
    },
  });
}

function addSeries(kind: 'function' | 'coordinates'): void {
  const nextState = seriesStateReducer({ series, nextId }, { type: 'add', kind });
  applySnapshot(nextState, `${kind === 'function' ? 'Added function' : 'Added coordinate set'}.`);

  const item = series[series.length - 1];
  const editorId = kind === 'function' ? `#expression-${item.id}` : `#coordinates-${item.id}`;
  const editor = elements.functionList.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    editorId,
  );
  if (!editor) {
    throw new Error(`The editor for series ${item.id} was not rendered.`);
  }
  editor.focus();
}

function saveCurrentPreset(): void {
  try {
    const name = elements.presetName.value.trim();
    const updatedPresets = savePreset(name, { series, nextId, domain: currentDomain });
    elements.presetName.value = '';
    elements.presetList.value = updatedPresets[updatedPresets.length - 1].name;
    showError();
    syncPresetControls();
    announceStatus(`Saved preset ${updatedPresets[updatedPresets.length - 1].name}.`);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to save this preset.');
  }
}

function loadSelectedPreset(): void {
  const presetName = elements.presetList.value;
  if (!presetName) {
    showError('Select a preset to load.');
    return;
  }

  const preset = loadPresets().find((item) => item.name === presetName);
  if (!preset) {
    showError('That preset could not be found.');
    return;
  }

  if (!window.confirm(`Replace the current graph with preset "${presetName}"?`)) {
    return;
  }
  flushHistoryCommit();
  const committed = graphModel.commit({
    series: preset.series,
    nextId: preset.nextId,
    domain: preset.domain ?? currentDomain,
  });
  applyCurrentSnapshot(committed);
  showError();
  announceStatus(`Loaded preset ${presetName}.`);
}

function deleteSelectedPreset(): void {
  const presetName = elements.presetList.value;
  if (!presetName) {
    showError('Select a preset to delete.');
    return;
  }

  try {
    const updatedPresets = deletePreset(presetName);
    elements.presetList.value = updatedPresets.length > 0 ? updatedPresets[0].name : '';
    showError();
    syncPresetControls();
    announceStatus(`Deleted preset ${presetName}.`);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to delete this preset.');
  }
}

function exportCurrentGraph(): void {
  try {
    const json = exportGraphSnapshot({ series, nextId, domain: currentDomain });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plotter-graph.json';
    link.click();
    URL.revokeObjectURL(url);
    showError();
    announceStatus('Exported graph as JSON.');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to export this graph.');
  }
}

async function importGraphFile(file: File): Promise<void> {
  const text = await file.text();
  const snapshot = importGraphSnapshot(text);
  if (!window.confirm(`Replace the current graph with the contents of "${file.name}"?`)) {
    return;
  }
  flushHistoryCommit();
  const committed = graphModel.commit({ ...snapshot, domain: snapshot.domain ?? currentDomain });
  applyCurrentSnapshot(committed);
  announceStatus(`Imported ${file.name}.`);
}

elements.addFunction.addEventListener('click', () => addSeries('function'));
elements.addCoordinates.addEventListener('click', () => addSeries('coordinates'));
elements.savePreset.addEventListener('click', saveCurrentPreset);
elements.loadPreset.addEventListener('click', loadSelectedPreset);
elements.deletePreset.addEventListener('click', deleteSelectedPreset);
elements.undoButton.addEventListener('click', () => {
  flushHistoryCommit();
  applyCurrentSnapshot(graphModel.undo());
  announceStatus('Undid the last change.');
});
elements.redoButton.addEventListener('click', () => {
  flushHistoryCommit();
  applyCurrentSnapshot(graphModel.redo());
  announceStatus('Redid the last change.');
});
elements.exportJson.addEventListener('click', exportCurrentGraph);
elements.importJson.addEventListener('click', () => {
  elements.importJsonInput.click();
});
elements.importJsonInput.addEventListener('change', async (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  try {
    await importGraphFile(file);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unable to import this graph file.');
  } finally {
    target.value = '';
  }
});
elements.presetList.addEventListener('change', () => {
  elements.loadPreset.disabled = !elements.presetList.value;
  elements.deletePreset.disabled = !elements.presetList.value;
});
elements.graph.addEventListener('pointermove', (event) => {
  updateGraphInspector(event);
});
elements.graph.addEventListener('pointerleave', () => updateGraphInspector());

syncPresetControls();

const viewportControls: ViewportControlsController = setupViewportControls({
  form: elements.rangeForm,
  minInput: elements.minInput,
  maxInput: elements.maxInput,
  resetRangeButton: elements.resetRange,
  resetZoomButton: elements.resetZoom,
  plotter,
  updateGraph,
  showError,
  onDomainChange: handleDomainChange,
  initialDomain: currentDomain,
});

function setSidebarOpen(isOpen: boolean): void {
  elements.workspace.classList.toggle('sidebar-closed', !isOpen);
  elements.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  elements.sidebar.setAttribute('aria-hidden', String(!isOpen));
  elements.sidebar.inert = !isOpen;
  elements.sidebarClose.hidden = !isOpen;
  elements.sidebarToggleLabel.textContent = isOpen ? 'Hide controls' : 'Show controls';
  elements.sidebarToggleIcon.textContent = isOpen ? '‹' : '›';
}

elements.sidebarToggle.addEventListener('click', () => {
  const isOpen = elements.sidebarToggle.getAttribute('aria-expanded') !== 'true';
  setSidebarOpen(isOpen);
  if (isOpen) {
    elements.sidebarClose.focus();
  }
});

function closeSidebar(): void {
  if (elements.sidebarToggle.getAttribute('aria-expanded') === 'true') {
    setSidebarOpen(false);
    elements.sidebarToggle.focus();
  }
}

elements.sidebarClose.addEventListener('click', closeSidebar);
elements.sidebarBackdrop.addEventListener('click', closeSidebar);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSidebar();
    return;
  }

  const isModifier = event.metaKey || event.ctrlKey;
  if (!isModifier) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.matches('textarea, [contenteditable="true"]') ||
      target.matches(
        'input:not([type="checkbox"]):not([type="color"]):not([type="button"]):not([type="submit"])',
      ))
  ) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) {
      elements.redoButton.click();
    } else {
      elements.undoButton.click();
    }
  } else if (key === 'y') {
    event.preventDefault();
    elements.redoButton.click();
  }
});

elements.graph.addEventListener('keydown', (event) => {
  if (
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight' &&
    event.key !== 'Home' &&
    event.key !== 'End'
  ) {
    return;
  }
  event.preventDefault();
  const step = (currentDomain.max - currentDomain.min) / 100;
  if (event.key === 'Home') {
    keyboardInspectX = currentDomain.min;
  } else if (event.key === 'End') {
    keyboardInspectX = currentDomain.max;
  } else {
    keyboardInspectX += event.key === 'ArrowRight' ? step : -step;
    keyboardInspectX = Math.max(currentDomain.min, Math.min(currentDomain.max, keyboardInspectX));
  }
  const bounds = elements.graph.getBoundingClientRect();
  const plotLeft = 52;
  const plotRight = bounds.width - 24;
  const pointerX =
    plotLeft +
    ((keyboardInspectX - currentDomain.min) / (currentDomain.max - currentDomain.min)) *
      (plotRight - plotLeft);
  updateGraphInspectorAt(keyboardInspectX, pointerX);
  announceStatus(elements.graphInspector.textContent ?? '');
});

renderEditor();
updateGraph();
updateGraphInspector();
syncPresetControls();
syncHistoryControls();
