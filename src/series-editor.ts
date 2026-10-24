import { getSeriesName, graphTypeOptions, isGraphType, type EditableSeries } from './series';
import { validateCoordinateInput, validateExpressionText } from './series-state';

interface SeriesEditorCallbacks {
  onChange: () => void;
  onNameChange: () => void;
  onRemove: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}

function updateFieldValidity(
  input: HTMLInputElement | HTMLTextAreaElement,
  messageElement: HTMLParagraphElement,
  message: string | undefined,
): void {
  const isInvalid = typeof message === 'string' && message.length > 0;
  input.classList.toggle('is-invalid', isInvalid);
  input.setAttribute('aria-invalid', String(isInvalid));
  messageElement.hidden = !isInvalid;
  messageElement.textContent = isInvalid ? message : '';
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

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '↕';
    dragHandle.title = `Reorder ${item.kind === 'function' ? `function ${getSeriesName(item)}` : `coordinate set ${getSeriesName(item)}`}`;
    dragHandle.setAttribute(
      'aria-label',
      `Reorder ${item.kind === 'function' ? `function ${getSeriesName(item)}` : `coordinate set ${getSeriesName(item)}`}`,
    );
    dragHandle.draggable = true;

    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.className = 'move-series-button';
    moveUp.textContent = '↑';
    moveUp.disabled = series[0]?.id === item.id;
    moveUp.id = `move-up-${item.id}`;
    moveUp.setAttribute('aria-label', `Move ${getSeriesName(item)} up`);
    moveUp.addEventListener('click', () => {
      const index = series.findIndex((seriesItem) => seriesItem.id === item.id);
      const target = series[index - 1];
      if (target) {
        callbacks.onReorder(item.id, target.id);
        functionList.querySelector<HTMLButtonElement>(`#move-up-${item.id}`)?.focus();
      }
    });

    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.className = 'move-series-button';
    moveDown.textContent = '↓';
    moveDown.disabled = series[series.length - 1]?.id === item.id;
    moveDown.id = `move-down-${item.id}`;
    moveDown.setAttribute('aria-label', `Move ${getSeriesName(item)} down`);
    moveDown.addEventListener('click', () => {
      const index = series.findIndex((seriesItem) => seriesItem.id === item.id);
      const target = series[index + 1];
      if (target) {
        callbacks.onReorder(item.id, target.id);
        functionList.querySelector<HTMLButtonElement>(`#move-down-${item.id}`)?.focus();
      }
    });

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

    actions.append(dragHandle, moveUp, moveDown, visibilityLabel, remove);
    cardTop.append(name, actions);

    dragHandle.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', item.id);
      event.dataTransfer?.setData('application/x-graph-series-id', item.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
      card.classList.add('is-dragging');
    });
    dragHandle.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drop-target');
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const fromId = event.dataTransfer?.getData('application/x-graph-series-id') || item.id;
      if (fromId && fromId !== item.id) {
        callbacks.onReorder(fromId, item.id);
      }
    });

    let editor: HTMLInputElement | HTMLTextAreaElement;
    let coordinateKeyControls: HTMLDivElement | undefined;
    let fieldStatus: HTMLParagraphElement | undefined;
    if (item.kind === 'coordinates') {
      const textarea = document.createElement('textarea');
      textarea.className = 'expression-input coordinates-input';
      textarea.id = `coordinates-${item.id}`;
      textarea.spellcheck = false;
      textarea.value = item.dataText;
      textarea.setAttribute('aria-label', `Coordinate data for dataset ${item.id}`);

      const validationMessage = document.createElement('p');
      validationMessage.className = 'series-field-status';
      validationMessage.id = `coordinates-status-${item.id}`;
      validationMessage.hidden = true;
      fieldStatus = validationMessage;
      textarea.setAttribute('aria-describedby', validationMessage.id);
      const updateValidation = () => {
        updateFieldValidity(
          textarea,
          validationMessage,
          validateCoordinateInput(textarea.value, item.xKey, item.yKey),
        );
      };
      textarea.addEventListener('input', () => {
        item.dataText = textarea.value;
        updateValidation();
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
          updateValidation();
          callbacks.onChange();
        });
        keyLabel.append(labelText, keyInput);
        coordinateKeyControls.append(keyLabel);
      }
      const keyHelp = document.createElement('p');
      keyHelp.className = 'coordinate-key-help';
      keyHelp.textContent = 'JSON objects support nested property paths, such as metrics.time.';
      coordinateKeyControls.append(keyHelp);
      updateValidation();
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

      const validationMessage = document.createElement('p');
      validationMessage.className = 'series-field-status';
      validationMessage.id = `expression-status-${item.id}`;
      validationMessage.hidden = true;
      fieldStatus = validationMessage;
      input.setAttribute('aria-describedby', validationMessage.id);
      const updateValidation = () => {
        updateFieldValidity(input, validationMessage, validateExpressionText(input.value));
      };
      input.addEventListener('input', () => {
        item.expression = input.value;
        updateValidation();
        callbacks.onChange();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          callbacks.onChange();
        }
      });
      updateValidation();
      editor = input;
    }

    const advanced = document.createElement('details');
    advanced.className = 'series-advanced';
    advanced.id = `series-options-${item.id}`;
    const advancedSummary = document.createElement('summary');
    advancedSummary.textContent =
      item.kind === 'coordinates' ? 'Style and data options' : 'Style options';

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

    const colorLabel = document.createElement('label');
    colorLabel.className = 'series-color-control';
    colorLabel.textContent = 'Series color';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = item.color;
    colorInput.setAttribute('aria-label', `Color for ${getSeriesName(item)}`);
    colorInput.addEventListener('input', () => {
      item.color = colorInput.value;
      colorIndicator.style.backgroundColor = item.color;
      callbacks.onChange();
    });
    colorLabel.append(colorInput);

    advanced.append(advancedSummary);
    if (coordinateKeyControls) {
      advanced.append(coordinateKeyControls);
    }
    advanced.append(typeLabel, decoratorControls, colorLabel);

    card.append(cardTop, editor);
    if (fieldStatus) {
      card.append(fieldStatus);
    }
    card.append(advanced, colorIndicator);
    functionList.append(card);
  }
}
