import type { GraphDomain, GraphPlotter } from './graph';

const defaultDomain: GraphDomain = { min: -10, max: 10 };
const invalidRangeMessage = 'Enter a valid range where the minimum is less than the maximum.';

interface ViewportControls {
  form: HTMLFormElement;
  minInput: HTMLInputElement;
  maxInput: HTMLInputElement;
  resetRangeButton: HTMLButtonElement;
  resetZoomButton: HTMLButtonElement;
  plotter: GraphPlotter;
  updateGraph: () => void;
  showError: (message: string) => void;
  onDomainChange: (domain: GraphDomain) => void;
  initialDomain?: GraphDomain;
}

export interface ViewportControlsController {
  syncDomain(domain: GraphDomain): void;
}

export function setupViewportControls({
  form,
  minInput,
  maxInput,
  resetRangeButton,
  resetZoomButton,
  plotter,
  updateGraph,
  showError,
  onDomainChange,
  initialDomain = defaultDomain,
}: ViewportControls): ViewportControlsController {
  let rangeBeforeZoom = { ...initialDomain };
  minInput.value = String(initialDomain.min);
  maxInput.value = String(initialDomain.max);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const min = minInput.valueAsNumber;
    const max = maxInput.valueAsNumber;

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max ||
      !Number.isFinite(max - min)
    ) {
      showError(invalidRangeMessage);
      return;
    }

    rangeBeforeZoom = { min, max };
    resetZoomButton.hidden = true;
    plotter.setDomain({ min, max });
    onDomainChange({ min, max });
    updateGraph();
  });

  resetRangeButton.addEventListener('click', () => {
    minInput.value = String(defaultDomain.min);
    maxInput.value = String(defaultDomain.max);
    rangeBeforeZoom = { ...defaultDomain };
    resetZoomButton.hidden = true;
    plotter.setDomain(defaultDomain);
    onDomainChange(defaultDomain);
    updateGraph();
  });

  plotter.setOnZoom((domain) => {
    minInput.value = String(Number(domain.min.toPrecision(6)));
    maxInput.value = String(Number(domain.max.toPrecision(6)));
    resetZoomButton.hidden = false;
    onDomainChange(domain);
  });

  resetZoomButton.addEventListener('click', () => {
    minInput.value = String(rangeBeforeZoom.min);
    maxInput.value = String(rangeBeforeZoom.max);
    resetZoomButton.hidden = true;
    plotter.setDomain(rangeBeforeZoom);
    onDomainChange(rangeBeforeZoom);
    updateGraph();
  });

  plotter.setDomain(initialDomain);
  return {
    syncDomain(domain) {
      rangeBeforeZoom = { ...domain };
      minInput.value = String(domain.min);
      maxInput.value = String(domain.max);
      resetZoomButton.hidden = true;
    },
  };
}
