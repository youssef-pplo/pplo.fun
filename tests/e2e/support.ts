import { test as base, expect } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { HardwareId } from '../../src/types';
import { expectedChapters, hardwareIds } from '../fixtures/portfolio';

const scenePollTimeout = 45_000;

export interface DebugState {
  progress: number;
  chapter: number;
  orbit: boolean;
  selected: HardwareId | null;
  hovered: HardwareId | null;
  camera: { position: number[]; target: number[]; focalLength: number };
  hardware: {
    id: HardwareId;
    visible: boolean;
    position: number[];
    screen: { x: number; y: number; visible: boolean };
  }[];
  metrics: { calls: number; triangles: number; pixelRatio: number; fps: number };
}

type DebugWindow = Window & { readonly __PPLO__?: { getState(): DebugState } };

interface RuntimeLog {
  pageErrors: string[];
  consoleErrors: string[];
  shaderErrors: string[];
  externalRequests: string[];
}

export const test = base.extend<{ runtime: RuntimeLog }>({
  runtime: [async ({ page }, use, testInfo) => {
    const log: RuntimeLog = { pageErrors: [], consoleErrors: [], shaderErrors: [], externalRequests: [] };
    page.on('pageerror', (error) => log.pageErrors.push(error.stack ?? error.message));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error') log.consoleErrors.push(text);
      if (/Shader Error|THREE\.WebGLProgram:|VALIDATE_STATUS|GL_INVALID|INVALID_(?:ENUM|VALUE|OPERATION)/i.test(text)) {
        log.shaderErrors.push(text);
      }
    });
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:4173') {
        log.externalRequests.push(url.href);
      }
    });
    await use(log);
    if (log.pageErrors.length || log.consoleErrors.length || log.shaderErrors.length || log.externalRequests.length) {
      await testInfo.attach('browser-runtime.json', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
    }
    expect(log.pageErrors, 'uncaught browser/page errors').toEqual([]);
    expect(log.shaderErrors, 'shader compile/link or invalid WebGL operation errors').toEqual([]);
  }, { auto: true }],
});

export { expect };

export async function readState(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const debug = (window as DebugWindow).__PPLO__;
    if (!debug) throw new Error('The ready debug scene must expose read-only window.__PPLO__.getState().');
    return debug.getState();
  });
}

export async function openStory(page: Page): Promise<void> {
  await page.goto('/?debug');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready', { timeout: scenePollTimeout });
  await expect(page.locator('canvas#webgl')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.boot-screen')).toBeHidden();
  await expect.poll(() => page.evaluate(() => typeof (window as DebugWindow).__PPLO__?.getState), {
    message: 'debug state becomes available only after initialization',
    timeout: scenePollTimeout,
  }).toBe('function');
  await expect.poll(async () => (await readState(page)).metrics.calls, { timeout: scenePollTimeout }).toBeGreaterThan(0);
}

export async function waitForProgress(page: Page, progress: number): Promise<void> {
  await expect.poll(() => page.evaluate((target) => {
    const debug = (window as DebugWindow).__PPLO__;
    if (!debug) throw new Error('The ready debug scene must expose read-only window.__PPLO__.getState().');
    const story = document.querySelector<HTMLElement>('#scroll-story');
    if (!story) throw new Error('Missing native scroll story.');
    const end = story.offsetTop + story.offsetHeight - window.innerHeight;
    return {
      sceneProgress: Math.abs(debug.getState().progress - target) <= 0.0002,
      nativePosition: Math.abs(window.scrollY - Math.round(end * target)) <= 1,
      lenisIdle: !document.documentElement.classList.contains('lenis-scrolling'),
    };
  }, progress), {
    message: `scene progress, native position, and Lenis settle at ${progress}`,
    timeout: scenePollTimeout,
  }).toEqual({ sceneProgress: true, nativePosition: true, lenisIdle: true });
}

export async function scrollToProgress(page: Page, progress: number): Promise<DebugState> {
  // Arrival at the current position does not imply a no-op Lenis animation has finished.
  await expect(page.locator('html')).not.toHaveClass(/\blenis-scrolling\b/, { timeout: scenePollTimeout });
  await page.evaluate((target) => {
    const story = document.querySelector<HTMLElement>('#scroll-story');
    if (!story) throw new Error('Missing native scroll story.');
    const end = story.offsetTop + story.offsetHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(end * target), behavior: 'instant' });
  }, progress);
  await waitForProgress(page, progress);
  return readState(page);
}

export async function jumpToChapter(page: Page, index: number): Promise<void> {
  const target = index === 0 ? 0 : expectedChapters[index].range[0] + 0.02;
  const button = page.locator(`[data-dock-chapter="${index}"]`);
  await button.click();
  await waitForProgress(page, target);
  await expect.poll(async () => (await readState(page)).chapter, { timeout: scenePollTimeout }).toBe(index);
  await expect(button).toHaveAttribute('aria-current', 'step');
  await expect(page.locator(`#story-chapter-${index}`)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.chapter-panel[aria-hidden="false"]')).toHaveCount(1);
}

export function expectFiniteState(state: DebugState): void {
  expect(Number.isFinite(state.progress)).toBe(true);
  expect(state.progress).toBeGreaterThanOrEqual(0);
  expect(state.progress).toBeLessThanOrEqual(1);
  expect(Number.isInteger(state.chapter)).toBe(true);
  expect(state.chapter).toBeGreaterThanOrEqual(0);
  expect(state.chapter).toBeLessThanOrEqual(6);
  expect(typeof state.orbit).toBe('boolean');
  if (state.selected !== null) expect(hardwareIds).toContain(state.selected);
  if (state.hovered !== null) expect(hardwareIds).toContain(state.hovered);
  expect(state.camera.position).toHaveLength(3);
  expect(state.camera.target).toHaveLength(3);
  expect([...state.camera.position, ...state.camera.target, state.camera.focalLength].every(Number.isFinite)).toBe(true);
  expect(state.camera.focalLength).toBeGreaterThan(0);
  expect(state.hardware.map(({ id }) => id).sort()).toEqual([...hardwareIds].sort());
  state.hardware.forEach((part) => {
    expect(typeof part.visible).toBe('boolean');
    expect(part.position).toHaveLength(3);
    expect([...part.position, part.screen.x, part.screen.y].every(Number.isFinite)).toBe(true);
    expect(typeof part.screen.visible).toBe('boolean');
  });
  expect(Object.values(state.metrics).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  expect(state.metrics.pixelRatio).toBeGreaterThan(0);
}

export function assemblyVisibility(state: DebugState) {
  return state.hardware.map(({ id, visible }) => ({ id, visible })).sort((left, right) => left.id.localeCompare(right.id));
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.documentElement.clientWidth,
  ))).toBeLessThanOrEqual(1);
}

export async function expectTouchTargets(scope: Locator): Promise<void> {
  const undersized = await scope.locator('button, .contact-links a, .icon-link').evaluateAll((elements) => elements.flatMap((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (element.closest('[inert], [hidden]') || style.visibility === 'hidden' || style.display === 'none'
      || bounds.width === 0 || bounds.height === 0 || bounds.bottom <= 0 || bounds.top >= innerHeight) return [];
    return bounds.width < 43.5 || bounds.height < 43.5
      ? [{ label: element.getAttribute('aria-label') ?? element.textContent?.trim(), width: bounds.width, height: bounds.height }]
      : [];
  }));
  expect(undersized, 'visible interactive controls should offer at least 44×44 CSS pixels').toEqual([]);
}

export async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}
