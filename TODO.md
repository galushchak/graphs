# Refactoring TODO

- [x] **Make series types more explicit.** Replace the combined `EditableSeries` interface with a discriminated union for function and coordinate series so each kind requires the fields it uses.
- [x] **Centralize series creation and updates.** Share ID allocation, palette selection, insertion, rendering, graph refresh, and focus behavior between the add-function and add-coordinates flows.
- [x] **Extract viewport and zoom state management.** Consolidate range validation, range resets, zoom callbacks, and reset-zoom behavior into a focused controller.
- [x] **Centralize graph-type options.** Use one typed source for supported graph types, labels, validation, and editor options.
- [x] **Avoid re-querying stable DOM elements.** Cache element references consistently or group them into a DOM-elements object.
- [x] **Separate UI rendering from application logic.** Extract static page markup and dynamic series-editor rendering into focused modules.
- [x] **Keep graph updates responsive as series grow.** Reuse compiled expressions that have not changed and coalesce canvas redraws to at most one per animation frame.
- [x] **Handle extreme finite values safely.** Guard y-range and tick calculations against overflow and report a useful graph error.
- [x] **Clamp zoom drags to the plot edge.** Keep drag-to-zoom usable when the pointer leaves the plot area.
- [x] **Describe the canvas graph accessibly.** Provide a text alternative summarizing plotted series and the current horizontal range.
- [x] **Test the mobile layout.** Cover graph visibility and horizontal overflow at a narrow viewport.
- [x] **Polish visual hierarchy and interaction states.** Soften the open sidebar backdrop, refine cards and graph surfaces, and make keyboard focus clearer.
- [x] **Support custom object-shaped datasets.** Plot JSON objects using configurable X/Y property paths, including nested paths, without removing coordinate-pair input.
