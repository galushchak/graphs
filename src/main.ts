import './style.css';
import { mountApp } from './app-view';
import { parseCoordinates } from './coordinates';
import { GraphPlotter } from './graph';
import { renderSeriesEditor } from './series-editor';
import { createInitialSeries, createSeries, getSeriesName, type EditableSeries } from './series';
import { setupViewportControls } from './viewport-controls';

const elements = mountApp();
const plotter = new GraphPlotter(elements.graph);
let nextId = 3;
let series: EditableSeries[] = createInitialSeries();

function showError(message = ''): void {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.toggle('is-visible', message.length > 0);
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

function renderEditor(): void {
  renderSeriesEditor(elements.functionList, elements.functionCount, series, {
    onChange: updateGraph,
    onNameChange: updateGraphDescription,
    onRemove: (id) => {
      series = series.filter((item) => item.id !== id);
      renderEditor();
      updateGraph();
    },
  });
}

function addSeries(kind: 'function' | 'coordinates'): void {
  const item = createSeries(String(nextId++), kind);
  series.push(item);
  renderEditor();
  updateGraph();

  const editorId = kind === 'function' ? `#expression-${item.id}` : `#coordinates-${item.id}`;
  const editor = elements.functionList.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    editorId,
  );
  if (!editor) {
    throw new Error(`The editor for series ${item.id} was not rendered.`);
  }
  editor.focus();
}

elements.addFunction.addEventListener('click', () => addSeries('function'));
elements.addCoordinates.addEventListener('click', () => addSeries('coordinates'));

setupViewportControls({
  form: elements.rangeForm,
  minInput: elements.minInput,
  maxInput: elements.maxInput,
  resetRangeButton: elements.resetRange,
  resetZoomButton: elements.resetZoom,
  plotter,
  updateGraph,
  showError,
  onDomainChange: updateGraphDescription,
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
  }
});

renderEditor();
updateGraph();
