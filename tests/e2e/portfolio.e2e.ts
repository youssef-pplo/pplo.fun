import { expectedArsenal, expectedChapters, expectedContacts, expectedIdentity, expectedProjects, hardwareIds, ramProgress } from '../fixtures/portfolio';
import {
  assemblyVisibility,
  capture,
  expect,
  expectFiniteState,
  jumpToChapter,
  openStory,
  readState,
  scrollToProgress,
  test,
  waitForProgress,
} from './support';

test('boots a real WebGL scene with the name, seven chapter controls, and no runtime/shader errors', async ({ page, runtime }, testInfo) => {
  await openStory(page);
  await expect(page.getByRole('heading', { level: 1, name: /YOUSSEF\s*ELSAID/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Story chapters' }).getByRole('button')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button')).toHaveCount(3);
  await expect(page.locator('#scroll-story')).toBeAttached();
  expect(await page.locator('#scroll-story').evaluate((element) => element.getBoundingClientRect().height / innerHeight)).toBeCloseTo(10, 1);
  expect(await page.locator('#webgl').evaluate((element) => getComputedStyle(element).position)).toBe('fixed');

  const context = await page.locator('canvas#webgl').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return null;
    return {
      version: gl.getParameter(gl.VERSION) as string,
      lost: gl.isContextLost(),
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
    };
  });
  expect(context, 'the ready stage must have an actual WebGL context, not just a canvas').not.toBeNull();
  expect(context!.version).toMatch(/WebGL/);
  expect(context!.lost).toBe(false);
  expect(context!.width).toBeGreaterThan(0);
  expect(context!.height).toBeGreaterThan(0);
  const state = await readState(page);
  expectFiniteState(state);
  expect(state.chapter).toBe(0);
  expect(state.orbit).toBe(false);
  expect(state.selected).toBeNull();
  expect(state.metrics.calls).toBeGreaterThan(0);
  expect(state.metrics.triangles).toBeGreaterThan(0);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.externalRequests, 'fonts and scene assets must remain local').toEqual([]);
  await capture(page, testInfo, 'desktop-hero.png');
});

test('jumps and scrolls through every chapter, then reverses to a deterministic opening assembly', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openStory(page);
  const opening = assemblyVisibility(await scrollToProgress(page, 0));
  expect(opening.filter(({ id }) => id !== 'pcb').every(({ visible }) => !visible)).toBe(true);
  const forward = new Map<number, ReturnType<typeof assemblyVisibility>>();

  for (let index = 0; index < expectedChapters.length; index += 1) {
    await jumpToChapter(page, index);
    const [start, end] = expectedChapters[index].range;
    const state = await scrollToProgress(page, (start + end) / 2);
    expectFiniteState(state);
    expect(state.chapter).toBe(index);
    forward.set(index, assemblyVisibility(state));
    await expect(page.locator(`[data-dock-chapter="${index}"]`)).toHaveAttribute('aria-current', 'step');
    if (index === 2) {
      await capture(page, testInfo, 'desktop-cpu.png');
      await scrollToProgress(page, 0.438);
      await capture(page, testInfo, 'desktop-cpu-late.png');
      await scrollToProgress(page, (start + end) / 2);
    }
    if (index === 3) {
      await capture(page, testInfo, 'desktop-gpu.png');
      await scrollToProgress(page, 0.605);
      await capture(page, testInfo, 'desktop-gpu-late.png');
      await scrollToProgress(page, (start + end) / 2);
    }
    if (index === 4) await capture(page, testInfo, 'desktop-ram.png');
    if (index === 5) await capture(page, testInfo, 'desktop-nvme.png');
  }

  const complete = await scrollToProgress(page, 1);
  expectFiniteState(complete);
  expect(complete.chapter).toBe(6);
  expect(complete.hardware.every(({ visible }) => visible), 'all eleven components are assembled at the end').toBe(true);
  await capture(page, testInfo, 'desktop-assembled.png');

  for (let index = expectedChapters.length - 1; index >= 0; index -= 1) {
    const [start, end] = expectedChapters[index].range;
    const state = await scrollToProgress(page, (start + end) / 2);
    expectFiniteState(state);
    expect(state.chapter).toBe(index);
    expect(assemblyVisibility(state), `chapter ${index + 1} visibility must not depend on scroll direction`).toEqual(forward.get(index));
  }
  expect(assemblyVisibility(await scrollToProgress(page, 0))).toEqual(opening);
  await expect(page.locator('[data-ref="scroll-percent"]')).toHaveText('000');
  await expect(page.locator('[data-dock-chapter="0"]')).toHaveAttribute('aria-current', 'step');
});

test('synchronizes all four RAM tabs, projects, chapter navigation, and percent readout', async ({ page }) => {
  await openStory(page);
  await jumpToChapter(page, 4);
  const tabs = page.getByRole('tablist', { name: 'Selected project modules' });
  await expect(tabs.getByRole('tab')).toHaveCount(4);
  const ram = expectedProjects.filter(({ hardware }) => hardware.startsWith('ram-'));
  for (const index of [0, 1, 2, 3, 2, 1, 0]) {
    const tab = tabs.getByRole('tab').nth(index);
    await tab.click();
    await waitForProgress(page, ramProgress[index]);
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { selected: true })).toHaveCount(1);
    await expect(page.locator('#memory-project')).toHaveAttribute('aria-labelledby', `memory-tab-${index}`);
    await expect(page.locator('#memory-project').getByRole('heading', { name: ram[index].title, exact: true })).toBeVisible();
    await expect(page.locator('#memory-project .project-card__heading a')).toHaveAttribute('href', ram[index].url);
    await expect(page.locator('[data-ref="ram-count"]')).toHaveText(String(index + 1).padStart(2, '0'));
    await expect(page.locator('[data-ref="scroll-percent"]')).toHaveText(String(Math.round(ramProgress[index] * 100)).padStart(3, '0'));
    await expect(page.getByRole('progressbar', { name: 'Portfolio scroll progress' })).toHaveAttribute('aria-valuenow', String(Math.round(ramProgress[index] * 100)));
    await expect(page.locator('[data-dock-chapter="4"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-nav-group="work"]')).toHaveAttribute('aria-current', 'location');
    expect((await readState(page)).chapter).toBe(4);
  }
  await tabs.getByRole('tab').nth(0).focus();
  await page.keyboard.press('ArrowLeft');
  await waitForProgress(page, ramProgress[3]);
  await expect(tabs.getByRole('tab').nth(3)).toBeFocused();
  await expect(tabs.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await waitForProgress(page, ramProgress[0]);
  await expect(tabs.getByRole('tab').nth(0)).toBeFocused();
});

test('assembles every component in free orbit and supports button inspection, complete dialog content, and Escape focus restoration', async ({ page }) => {
  test.setTimeout(180_000);
  await openStory(page);
  await page.getByRole('button', { name: 'Enable free orbit to explore the motherboard' }).click();
  await expect.poll(async () => (await readState(page)).orbit).toBe(true);
  await expect.poll(async () => (await readState(page)).hardware.every(({ visible }) => visible)).toBe(true);
  await expect(page.locator('.orbit-console')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.component-list [data-part]')).toHaveCount(hardwareIds.length);
  expectFiniteState(await readState(page));

  for (const id of ['cpu', ...hardwareIds.filter((part) => part !== 'cpu')] as const) {
    const button = page.locator(`.component-list [data-part="${id}"]`);
    await button.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await readState(page)).selected).toBe(id);
    await expect(dialog.getByRole('button', { name: 'Close component inspector' })).toBeFocused();
    await expect(dialog.locator('#inspector-title')).not.toBeEmpty();
    await expect(dialog.locator('#inspector-content')).not.toBeEmpty();

    if (id === 'cpu') {
      await expect(dialog.locator('.biography__full')).toHaveText(expectedIdentity.bio);
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await dialog.getByRole('tab', { name: 'Projects', exact: true }).click();
      await expect(dialog.locator('.project-card')).toHaveCount(6);
      for (const project of expectedProjects) {
        await expect(dialog.getByRole('link', { name: `Visit ${project.title} (opens in a new tab)`, exact: true })).toHaveAttribute('href', project.url);
      }
      await dialog.getByRole('tab', { name: 'Arsenal', exact: true }).click();
      await expect(dialog.locator('.skill-group')).toHaveCount(expectedArsenal.length);
      for (const category of expectedArsenal) {
        const group = dialog.getByRole('region', { name: category.title, exact: true });
        await expect(group.locator('li')).toHaveText([...category.items]);
      }
      await dialog.getByRole('tab', { name: 'Contact', exact: true }).click();
      for (const contact of expectedContacts) {
        await expect(dialog.locator(`.contact-links a[href="${contact.href}"]`)).toHaveCount(1);
      }
      await dialog.getByRole('tab', { name: 'Contact', exact: true }).press('Home');
      await expect(dialog.getByRole('tab', { name: 'Component', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByRole('tab', { name: 'Biography', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(dialog.locator('.biography__full')).toHaveText(expectedIdentity.bio);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await readState(page)).selected).toBeNull();
    await expect(button).toBeFocused();
    expect((await readState(page)).orbit).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await readState(page)).orbit).toBe(false);
  await expect(page.locator('.orbit-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#story-chapter-0')).toHaveAttribute('aria-hidden', 'false');
});

test('selects a real component by direct canvas raycast when a projected component is unobstructed', async ({ page }, testInfo) => {
  await openStory(page);
  await page.keyboard.press('o');
  await expect.poll(async () => (await readState(page)).orbit).toBe(true);
  await expect.poll(async () => (await readState(page)).hardware.every(({ visible }) => visible)).toBe(true);
  const state = await readState(page);
  const points = state.hardware.filter((part) => part.visible && part.screen.visible).flatMap((part) => [
    { x: part.screen.x, y: part.screen.y },
    { x: part.screen.x, y: part.screen.y + 10 },
  ]);
  const unobstructed: { x: number; y: number }[] = [];
  for (const point of points) {
    const onCanvas = await page.evaluate(({ x, y }) => x > 1 && y > 1 && x < innerWidth - 1 && y < innerHeight - 1
      && document.elementFromPoint(x, y)?.matches('canvas#webgl') === true, point);
    if (onCanvas) unobstructed.push(point);
  }
  test.skip(unobstructed.length === 0, 'No projected hardware anchor is exposed on the canvas at this viewport.');

  let hit = false;
  for (const point of unobstructed.slice(0, 12)) {
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await readState(page)).hovered).toBeNull();
    await page.mouse.move(point.x, point.y);
    try {
      await expect.poll(async () => (await readState(page)).hovered, { timeout: 1_500 }).not.toBeNull();
    } catch {
      continue;
    }
    const hovered = (await readState(page)).hovered;
    await page.mouse.click(point.x, point.y);
    await expect.poll(async () => (await readState(page)).selected).toBe(hovered);
    await expect(page.getByRole('dialog')).toBeVisible();
    testInfo.annotations.push({ type: 'raycast', description: `Canvas hover and click selected ${hovered}.` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect.poll(async () => (await readState(page)).selected).toBeNull();
    hit = true;
    break;
  }
  expect(hit, 'at least one exposed component must be pickable by a genuine pointer click').toBe(true);
});
