import { getSeriesName, graphTypeOptions, isGraphType, type EditableSeries } from './series';

interface SeriesEditorCallbacks {
  onChange: () => void;
  onNameChange: () => void;
  onRemove: (id: string) => void;
}

export function renderSeriesEditor(
  functionList: HTMLDivElement,
  functionCount: HTMLSpanElement,
  series: EditableSeries[],
  callbacks: SeriesEditorCallbacks,
): void {
  functionList.replaceChildren();
  functionCount.textContent = String(series.length);

  for (const item of series) {
    const card = document.createElement('article');
    card.className = 'function-card';

    const cardTop = document.createElement('div');
    cardTop.className = 'function-card-top';

    const name = document.createElement('input');
    name.className = 'function-name';
    name.type = 'text';
    name.value = getSeriesName(item);
    name.setAttribute(
      'aria-label',
      `Name for ${item.kind === 'function' ? `function ${item.id}` : `coordinate set ${item.id}`}`,
    );

    const actions = document.createElement('div');
    actions.className = 'function-actions';

    const visibilityLabel = document.createElement('label');
    visibilityLabel.className = 'visibility-toggle';
    const visibility = document.createElement('input');
    visibility.type = 'checkbox';
    visibility.checked = item.visible;

    const remove = document.createElement('button');
    remove.className = 'icon-button';
    remove.type = 'button';
    remove.textContent = '×';

    const getVisibilityLabel = () =>
      item.kind === 'function'
        ? `function ${getSeriesName(item)}`
        : `coordinate set ${getSeriesName(item)}`;
    const updateVisibilityLabel = () => {
      const seriesLabel = getVisibilityLabel();
      visibilityLabel.title = item.visible ? `Hide ${seriesLabel}` : `Show ${seriesLabel}`;
      visibility.setAttribute('aria-label', `${item.visible ? 'Hide' : 'Show'} ${seriesLabel}`);
      remove.title = `Remove ${seriesLabel}`;
      remove.setAttribute('aria-label', `Remove ${seriesLabel}`);
    };

    visibility.addEventListener('change', () => {
      item.visible = visibility.checked;
      updateVisibilityLabel();
      callbacks.onChange();
    });
    const toggleTrack = document.createElement('span');
    toggleTrack.className = 'toggle-track';
    visibilityLabel.append(visibility, toggleTrack);

    remove.addEventListener('click', () => callbacks.onRemove(item.id));
    updateVisibilityLabel();
    name.addEventListener('input', () => {
      item.name = name.value.trim() || undefined;
      updateVisibilityLabel();
      callbacks.onNameChange();
    });

    actions.append(visibilityLabel, remove);
    cardTop.append(name, actions);

    let editor: HTMLInputElement | HTMLTextAreaElement;
    let coordinateKeyControls: HTMLDivElement | undefined;
    if (item.kind === 'coordinates') {
      const textarea = document.createElement('textarea');
      textarea.className = 'expression-input coordinates-input';
      textarea.id = `coordinates-${item.id}`;
      textarea.spellcheck = false;
      textarea.value = item.dataText;
      textarea.setAttribute('aria-label', `Coordinate data for dataset ${item.id}`);
      textarea.addEventListener('input', () => {
        item.dataText = textarea.value;
        callbacks.onChange();
      });
      editor = textarea;

      coordinateKeyControls = document.createElement('div');
      coordinateKeyControls.className = 'coordinate-key-controls';
      for (const axis of ['x', 'y'] as const) {
        const keyLabel = document.createElement('label');
        keyLabel.className = 'coordinate-key-label';
        const labelText = document.createElement('span');
        labelText.textContent = `${axis.toUpperCase()} key`;

        const keyInput = document.createElement('input');
        keyInput.className = 'coordinate-key-input';
        keyInput.type = 'text';
        keyInput.autocomplete = 'off';
        keyInput.spellcheck = false;
        keyInput.value = axis === 'x' ? item.xKey : item.yKey;
        keyInput.placeholder = axis;
        keyInput.setAttribute(
          'aria-label',
          `${axis.toUpperCase()} property path for coordinate set ${item.id}`,
        );
        keyInput.addEventListener('input', () => {
          if (axis === 'x') {
            item.xKey = keyInput.value;
          } else {
            item.yKey = keyInput.value;
          }
          callbacks.onChange();
        });
        keyLabel.append(labelText, keyInput);
        coordinateKeyControls.append(keyLabel);
      }
      const keyHelp = document.createElement('p');
      keyHelp.className = 'coordinate-key-help';
      keyHelp.textContent = 'JSON objects support nested property paths, such as metrics.time.';
      coordinateKeyControls.append(keyHelp);
    } else {
      const input = document.createElement('input');
      input.className = 'expression-input';
      input.id = `expression-${item.id}`;
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = item.expression;
      input.placeholder = 'e.g. sin(x) + x / 2';
      input.setAttribute('aria-label', `Expression for f${item.id}(x)`);
      input.addEventListener('input', () => {
        item.expression = input.value;
        callbacks.onChange();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          callbacks.onChange();
        }
      });
      editor = input;
    }

    const typeLabel = document.createElement('label');
    typeLabel.className = 'series-type-control';
    const typeLabelText = document.createElement('span');
    typeLabelText.textContent = 'Graph type';
    const typeSelect = document.createElement('select');
    typeSelect.setAttribute(
      'aria-label',
      `Graph type for ${item.kind === 'function' ? `function ${item.id}` : `coordinate set ${item.id}`}`,
    );
    for (const { value, label } of graphTypeOptions) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      typeSelect.append(option);
    }
    typeSelect.value = item.type;
    const updateDecoratorAvailability = () => {
      const unsupportedType = item.type === 'dots' || item.type === 'bars';
      for (const input of decoratorControls.querySelectorAll('input')) {
        input.disabled = unsupportedType;
      }
    };
    typeSelect.addEventListener('change', () => {
      if (isGraphType(typeSelect.value)) {
        item.type = typeSelect.value;
        updateDecoratorAvailability();
        callbacks.onChange();
      }
    });
    typeLabel.append(typeLabelText, typeSelect);

    const decoratorControls = document.createElement('div');
    decoratorControls.className = 'series-decorator-controls';
    for (const [property, label] of [
      ['dashed', 'Dashed line'],
      ['markers', 'Point markers'],
    ] as const) {
      const decoratorLabel = document.createElement('label');
      decoratorLabel.className = 'series-decorator-label';
      const decoratorInput = document.createElement('input');
      decoratorInput.type = 'checkbox';
      decoratorInput.checked = item[property];
      decoratorInput.disabled = item.type === 'dots' || item.type === 'bars';
      decoratorInput.setAttribute(
        'aria-label',
        `${label} for ${item.kind === 'function' ? `function ${item.id}` : `coordinate set ${item.id}`}`,
      );
      decoratorInput.addEventListener('change', () => {
        item[property] = decoratorInput.checked;
        callbacks.onChange();
      });
      const decoratorText = document.createElement('span');
      decoratorText.textContent = label;
      decoratorLabel.append(decoratorInput, decoratorText);
      decoratorControls.append(decoratorLabel);
    }

    const colorIndicator = document.createElement('span');
    colorIndicator.className = 'function-color';
    colorIndicator.style.backgroundColor = item.color;
    colorIndicator.setAttribute('aria-hidden', 'true');

    card.append(cardTop, editor);
    if (coordinateKeyControls) {
      card.append(coordinateKeyControls);
    }
    card.append(typeLabel, decoratorControls, colorIndicator);
    functionList.append(card);
  }
}
