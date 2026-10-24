const appMarkup = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Plotter home">
        <span class="brand-mark" aria-hidden="true">ƒ</span>
        <span>plotter<span class="brand-period">.</span></span>
      </a>
      <span class="topbar-note">A small space for big ideas</span>
    </header>

    <main class="workspace">
      <button
        class="sidebar-backdrop"
        id="sidebar-backdrop"
        type="button"
        aria-label="Close controls"
        aria-hidden="true"
        tabindex="-1"
      ></button>
      <aside
        class="sidebar"
        id="functions-sidebar"
        aria-labelledby="functions-heading"
        aria-hidden="false"
      >
        <div class="sidebar-heading">
          <div>
            <p class="eyebrow">YOUR WORKSPACE</p>
            <h1 id="functions-heading">Functions</h1>
          </div>
          <div class="sidebar-heading-actions">
            <span class="function-count" id="function-count">0</span>
            <button
              class="sidebar-close"
              id="sidebar-close"
              type="button"
              aria-label="Close controls"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div class="function-list" id="function-list"></div>

        <button class="add-function-button" id="add-function" type="button">
          <span aria-hidden="true">＋</span> Add function
        </button>
        <button class="add-function-button add-points-button" id="add-points" type="button">
          <span aria-hidden="true">＋</span> Add coordinates
        </button>

        <form class="range-form" id="range-form">
          <div class="section-divider"></div>
          <div class="range-heading">
            <div>
              <p class="eyebrow">VIEWPORT</p>
              <h2>Horizontal range</h2>
            </div>
            <button class="text-button" id="reset-range" type="button">Reset</button>
          </div>
          <div class="range-fields">
            <label>
              <span>Min</span>
              <input id="x-min" name="min" type="number" step="any" value="-10" />
            </label>
            <span class="range-separator" aria-hidden="true">to</span>
            <label>
              <span>Max</span>
              <input id="x-max" name="max" type="number" step="any" value="10" />
            </label>
          </div>
          <button class="range-button" type="submit">Update graph</button>
        </form>
        <p class="sidebar-hint">Try <code>sin(x)</code> or add data as <code>[[0, 1], [2, 3]]</code> or <code>[{"time": 0, "value": 1}]</code>; set X/Y keys for object data.</p>
      </aside>

      <section class="graph-panel" aria-labelledby="graph-heading">
        <div class="graph-header">
          <div>
            <p class="eyebrow">LIVE PREVIEW</p>
            <h2 id="graph-heading">Function graph</h2>
          </div>
          <div class="graph-header-tools">
            <button
              class="sidebar-toggle"
              id="sidebar-toggle"
              type="button"
              aria-controls="functions-sidebar"
              aria-expanded="true"
            >
              <span class="sidebar-toggle-icon" aria-hidden="true">‹</span>
              <span id="sidebar-toggle-label">Hide controls</span>
            </button>
            <button class="reset-zoom-button" id="reset-zoom" type="button" hidden>
              Reset zoom
            </button>
            <div class="graph-meta">
              <span class="live-dot" aria-hidden="true"></span>
              <span>Y-axis auto-scales</span>
            </div>
          </div>
        </div>
        <div class="graph-frame">
          <canvas
            id="graph"
            role="img"
            aria-label="Graph of the entered functions"
            aria-describedby="graph-description"
          >
            Your browser does not support canvas.
          </canvas>
        </div>
        <p class="sr-only" id="graph-description"></p>
        <p class="graph-error" id="graph-error" role="status" aria-live="polite"></p>
        <p class="graph-caption">Drag across the graph to zoom into an area. Enter a mathematical expression in <code>x</code> to see it take shape.</p>
      </section>
    </main>
    <footer class="footer">
      <span>Made for curious minds</span>
      <span>Expressions are evaluated locally in your browser</span>
    </footer>
  </div>
`;

function getElement<T extends HTMLElement>(app: HTMLDivElement, selector: string): T {
  const element = app.querySelector<T>(selector);
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
  app.innerHTML = appMarkup;

  return {
    functionList: getElement<HTMLDivElement>(app, '#function-list'),
    functionCount: getElement<HTMLSpanElement>(app, '#function-count'),
    errorMessage: getElement<HTMLParagraphElement>(app, '#graph-error'),
    graphDescription: getElement<HTMLParagraphElement>(app, '#graph-description'),
    minInput: getElement<HTMLInputElement>(app, '#x-min'),
    maxInput: getElement<HTMLInputElement>(app, '#x-max'),
    graph: getElement<HTMLCanvasElement>(app, '#graph'),
    workspace: getElement<HTMLElement>(app, '.workspace'),
    sidebarToggle: getElement<HTMLButtonElement>(app, '#sidebar-toggle'),
    sidebar: getElement<HTMLElement>(app, '#functions-sidebar'),
    sidebarBackdrop: getElement<HTMLButtonElement>(app, '#sidebar-backdrop'),
    sidebarClose: getElement<HTMLButtonElement>(app, '#sidebar-close'),
    sidebarToggleLabel: getElement<HTMLSpanElement>(app, '#sidebar-toggle-label'),
    sidebarToggleIcon: getElement<HTMLSpanElement>(app, '.sidebar-toggle-icon'),
    addFunction: getElement<HTMLButtonElement>(app, '#add-function'),
    addCoordinates: getElement<HTMLButtonElement>(app, '#add-points'),
    rangeForm: getElement<HTMLFormElement>(app, '#range-form'),
    resetRange: getElement<HTMLButtonElement>(app, '#reset-range'),
    resetZoom: getElement<HTMLButtonElement>(app, '#reset-zoom'),
  };
}
