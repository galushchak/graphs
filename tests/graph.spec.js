import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the graph workspace with the default function series', async ({ page }) => {
  await expect(page).toHaveTitle('Plotter — Function Graphs');
  await expect(page.getByRole('heading', { name: 'Functions' })).toBeVisible();
  await expect(page.locator('.function-card')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: 'Expression for f1(x)' })).toHaveValue('sin(x)');
  await expect(page.getByRole('textbox', { name: 'Expression for f2(x)' })).toHaveValue(
    '0.25 * x^2 - 2',
  );
  await expect(page.getByRole('img', { name: 'Graph of the entered functions' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Graph of the entered functions' })).toHaveAttribute(
    'aria-describedby',
    'graph-description',
  );
  await expect(page.locator('#graph-description')).toContainText('y = sin(x)');
  await expect(page.locator('#graph-error')).toBeEmpty();
});

test('adds and edits a function and reports invalid expressions', async ({ page }) => {
  await page.getByRole('button', { name: 'Add function' }).click();

  const expression = page.getByRole('textbox', { name: 'Expression for f3(x)' });
  await expect(expression).toBeFocused();
  await expression.fill('x^2');
  await expect(page.locator('.function-card')).toHaveCount(3);
  await expect(page.locator('#graph-error')).toBeEmpty();

  await expression.fill('x +');
  await expect(page.locator('#graph-error')).not.toBeEmpty();

  await expression.fill('x / 2');
  await expect(page.locator('#graph-error')).toBeEmpty();
});

test('adds coordinate data and validates edits', async ({ page }) => {
  await page.getByRole('button', { name: 'Add coordinates' }).click();

  const coordinates = page.getByRole('textbox', { name: 'Coordinate data for dataset 3' });
  await expect(coordinates).toBeFocused();
  await expect(coordinates).toHaveValue('[[-4, 3], [-2, -1], [0, 2], [2, 1], [4, 4]]');
  await expect(page.locator('.function-card')).toHaveCount(3);

  await coordinates.fill('not json');
  await expect(page.locator('#graph-error')).toContainText('Enter coordinate data as a JSON array');

  await coordinates.fill('[[0, 1], [2, 3]]');
  await expect(page.locator('#graph-error')).toBeEmpty();

  await coordinates.fill('[[0, 1.7976931348623157e308]]');
  await expect(page.locator('#graph-error')).toContainText(
    'The plotted values are too large to display safely.',
  );

  await coordinates.fill('[[0, 1], [2, 3]]');
  await expect(page.locator('#graph-error')).toBeEmpty();
});

test('plots JSON objects using configurable nested X and Y property paths', async ({ page }) => {
  await page.getByRole('button', { name: 'Add coordinates' }).click();
  const coordinates = page.getByRole('textbox', { name: 'Coordinate data for dataset 3' });
  const xKey = page.getByRole('textbox', { name: 'X property path for coordinate set 3' });
  const yKey = page.getByRole('textbox', { name: 'Y property path for coordinate set 3' });

  await coordinates.fill(
    '[{"stamp":{"seconds":-2},"reading":{"level":3}},{"stamp":{"seconds":0},"reading":{"level":1}}]',
  );
  await expect(page.locator('#graph-error')).toContainText('X key "x"');

  await xKey.fill('stamp.seconds');
  await expect(page.locator('#graph-error')).toContainText('Y key "y"');

  await yKey.fill('reading.level');
  await expect(page.locator('#graph-error')).toBeEmpty();

  await xKey.fill('stamp..seconds');
  await expect(page.locator('#graph-error')).toContainText('Enter a valid X key path');

  await xKey.fill('stamp.seconds');
  await expect(page.locator('#graph-error')).toBeEmpty();
  await expect(page.locator('#graph-description')).toContainText('X key stamp.seconds');
});

test('plots object data with the default x and y keys', async ({ page }) => {
  await page.getByRole('button', { name: 'Add coordinates' }).click();

  await page
    .getByRole('textbox', { name: 'Coordinate data for dataset 3' })
    .fill('[{"x":-1,"y":2},{"x":1,"y":-2}]');

  await expect(page.locator('#graph-error')).toBeEmpty();
  await expect(page.locator('#graph-description')).toContainText('X key x and Y key y');
});

test('validates, applies, and resets the horizontal range', async ({ page }) => {
  const min = page.getByLabel('Min');
  const max = page.getByLabel('Max');

  await min.fill('5');
  await max.fill('-5');
  await page.getByRole('button', { name: 'Update graph' }).click();
  await expect(page.locator('#graph-error')).toContainText(
    'Enter a valid range where the minimum is less than the maximum.',
  );

  await min.fill('-4');
  await max.fill('4');
  await page.getByRole('button', { name: 'Update graph' }).click();
  await expect(min).toHaveValue('-4');
  await expect(max).toHaveValue('4');
  await expect(page.locator('#graph-error')).toBeEmpty();

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(min).toHaveValue('-10');
  await expect(max).toHaveValue('10');
});

test('sets a graph type per series and allows renaming', async ({ page }) => {
  const firstFunctionType = page.getByRole('combobox', { name: 'Graph type for function 1' });
  const secondFunctionType = page.getByRole('combobox', { name: 'Graph type for function 2' });
  await expect(secondFunctionType).toHaveValue('line');

  await page.getByRole('button', { name: 'Add coordinates' }).click();
  const coordinateType = page.getByRole('combobox', { name: 'Graph type for coordinate set 3' });
  for (const type of ['line', 'spline', 'dots', 'bars']) {
    await firstFunctionType.selectOption(type);
    await expect(firstFunctionType).toHaveValue(type);
    await expect(secondFunctionType).toHaveValue('line');
    await expect(coordinateType).toHaveValue('line');
  }

  for (const type of ['line', 'spline', 'dots', 'bars']) {
    await coordinateType.selectOption(type);
    await expect(coordinateType).toHaveValue(type);
    await expect(firstFunctionType).toHaveValue('bars');
    await expect(secondFunctionType).toHaveValue('line');
  }

  const name = page.getByRole('textbox', { name: 'Name for function 1' });
  await name.fill('Sine wave');
  await expect(name).toHaveValue('Sine wave');
  await expect(page.getByRole('button', { name: 'Remove function Sine wave' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hide function Sine wave' })).toBeVisible();

  const coordinateName = page.getByRole('textbox', { name: 'Name for coordinate set 3' });
  await coordinateName.fill('Measured samples');
  await expect(
    page.getByRole('button', { name: 'Remove coordinate set Measured samples' }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Hide coordinate set Measured samples' }).uncheck();
  await expect(
    page.getByRole('checkbox', { name: 'Show coordinate set Measured samples' }),
  ).toBeVisible();

  await coordinateName.fill('');
  await expect(page.getByRole('button', { name: 'Remove coordinate set Points 3' })).toBeVisible();
});

test('applies composable visual decorators to a series', async ({ page }) => {
  const dashed = page.getByRole('checkbox', { name: 'Dashed line for function 1' });
  const markers = page.getByRole('checkbox', { name: 'Point markers for function 1' });

  await dashed.check();
  await markers.check();
  await expect(page.locator('#graph-description')).toContainText('dashed with point markers');

  await page.getByRole('combobox', { name: 'Graph type for function 1' }).selectOption('dots');
  await expect(dashed).toBeDisabled();
  await expect(markers).toBeDisabled();
  await expect(page.locator('#graph-description')).not.toContainText('dashed with point markers');
});

test('slides the controls menu in and out and closes it with Escape or the backdrop', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sidebar = page.locator('#functions-sidebar');
  const toggle = page.locator('#sidebar-toggle');
  const backdrop = page.locator('#sidebar-backdrop');
  const close = page.locator('#sidebar-close');

  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  await expect(backdrop).toBeVisible();
  const openBounds = await sidebar.boundingBox();
  expect(openBounds?.x).toBeGreaterThanOrEqual(0);

  await close.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
  await expect(sidebar).toHaveJSProperty('inert', true);
  await expect(backdrop).toBeHidden();
  await expect(page.locator('.workspace')).toHaveClass(/sidebar-closed/);
  const closedBounds = await sidebar.boundingBox();
  expect(closedBounds).not.toBeNull();
  expect(closedBounds.x + closedBounds.width).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Show controls' }).click();
  await expect(page.getByRole('button', { name: 'Hide controls' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(close).toBeFocused();
  await expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.workspace')).not.toHaveClass(/sidebar-closed/);
  const reopenedBounds = await sidebar.boundingBox();
  expect(reopenedBounds?.x).toBeGreaterThanOrEqual(0);

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  await page.getByRole('button', { name: 'Show controls' }).click();
  await backdrop.click({ position: { x: 10, y: 10 } });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('zooms into a dragged graph region and resets the zoom', async ({ page }) => {
  await page.locator('#sidebar-close').click();
  const canvas = page.getByRole('img', { name: 'Graph of the entered functions' });
  const bounds = await canvas.boundingBox();

  if (!bounds) {
    throw new Error('The graph canvas is not visible.');
  }

  await page.mouse.move(bounds.x + 100, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 300, bounds.y + 200, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeVisible();
  await expect(page.getByLabel('Min')).not.toHaveValue('-10');
  await expect(page.getByLabel('Max')).not.toHaveValue('10');

  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await expect(page.getByLabel('Min')).toHaveValue('-10');
  await expect(page.getByLabel('Max')).toHaveValue('10');
  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeHidden();
});

test('clamps zoom selection when the drag ends in the canvas margin', async ({ page }) => {
  await page.locator('#sidebar-close').click();
  const canvas = page.getByRole('img', { name: 'Graph of the entered functions' });
  const bounds = await canvas.boundingBox();

  if (!bounds) {
    throw new Error('The graph canvas is not visible.');
  }

  await page.mouse.move(bounds.x + 100, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + 180, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByRole('button', { name: 'Reset zoom' })).toBeVisible();
  await expect(page.getByLabel('Max')).toHaveValue('10');
});

test('keeps the graph usable without horizontal overflow on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  const canvas = page.getByRole('img', { name: 'Graph of the entered functions' });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add function' })).toBeVisible();

  const documentWidth = await page.locator('html').evaluate((element) => element.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(375);
});
