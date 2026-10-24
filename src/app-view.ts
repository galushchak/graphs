function getElement<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required app element was not found: ${selector}`);
  }
  return element;
}

export function mountApp() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('The app root element was not found.');
  }

  return {
    functionList: getElement<HTMLDivElement>(app, '#function-list'),
    functionCount: getElement<HTMLSpanElement>(app, '#function-count'),
    errorMessage: getElement<HTMLParagraphElement>(app, '#graph-error'),
    graphDescription: getElement<HTMLParagraphElement>(app, '#graph-description'),
    minInput: getElement<HTMLInputElement>(app, '#x-min'),
    maxInput: getElement<HTMLInputElement>(app, '#x-max'),
    graph: getElement<HTMLCanvasElement>(app, '#graph'),
    graphCrosshair: getElement<HTMLDivElement>(app, '#graph-crosshair'),
    graphLegend: getElement<HTMLDivElement>(app, '#graph-legend'),
    graphInspector: getElement<HTMLDivElement>(app, '#graph-inspector'),
    workspace: getElement<HTMLElement>(app, '.workspace'),
    sidebarToggle: getElement<HTMLButtonElement>(app, '#sidebar-toggle'),
    sidebar: getElement<HTMLElement>(app, '#functions-sidebar'),
    sidebarBackdrop: getElement<HTMLButtonElement>(app, '#sidebar-backdrop'),
    sidebarClose: getElement<HTMLButtonElement>(app, '#sidebar-close'),
    sidebarToggleLabel: getElement<HTMLSpanElement>(app, '#sidebar-toggle-label'),
    sidebarToggleIcon: getElement<HTMLSpanElement>(app, '.sidebar-toggle-icon'),
    addFunction: getElement<HTMLButtonElement>(app, '#add-function'),
    addCoordinates: getElement<HTMLButtonElement>(app, '#add-points'),
    presetName: getElement<HTMLInputElement>(app, '#preset-name'),
    presetList: getElement<HTMLSelectElement>(app, '#preset-list'),
    savePreset: getElement<HTMLButtonElement>(app, '#save-preset'),
    loadPreset: getElement<HTMLButtonElement>(app, '#load-preset'),
    deletePreset: getElement<HTMLButtonElement>(app, '#delete-preset'),
    undoButton: getElement<HTMLButtonElement>(app, '#undo-button'),
    redoButton: getElement<HTMLButtonElement>(app, '#redo-button'),
    exportJson: getElement<HTMLButtonElement>(app, '#export-json'),
    importJson: getElement<HTMLButtonElement>(app, '#import-json'),
    importJsonInput: getElement<HTMLInputElement>(app, '#import-json-input'),
    statusAnnouncer: getElement<HTMLParagraphElement>(app, '#status-announcer'),
    saveStatus: getElement<HTMLParagraphElement>(app, '#save-status'),
    rangeForm: getElement<HTMLFormElement>(app, '#range-form'),
    resetRange: getElement<HTMLButtonElement>(app, '#reset-range'),
    resetZoom: getElement<HTMLButtonElement>(app, '#reset-zoom'),
  };
}
