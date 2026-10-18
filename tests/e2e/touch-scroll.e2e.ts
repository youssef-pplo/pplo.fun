import { expect, openStory, readState, test } from './support';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('canvas allows touch scrolling across the screen and disables it only in orbit mode', async ({ page }) => {
  await openStory(page);

  // 1. Initial scrollytelling state: canvas must have pan-y touch-action
  const initialTouchAction = await page.evaluate(() => {
    const canvas = document.querySelector('#webgl') as HTMLCanvasElement;
    return {
      inline: canvas.style.touchAction,
      computed: getComputedStyle(canvas).touchAction,
    };
  });
  expect(initialTouchAction.computed).toBe('pan-y');

  // 2. Swiping vertically on the canvas (at x=200, y=600, outside the hero text) must scroll the page
  const client = await page.context().newCDPSession(page);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const stateBefore = await readState(page);

  await (client.send as (method: string, params?: unknown) => Promise<unknown>)('Input.synthesizeScrollGesture', {
    x: 200,
    y: 600,
    xDistance: 0,
    yDistance: -300,
    interactionSource: 'touch',
  });

  await page.waitForTimeout(1000);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  const stateAfter = await readState(page);

  expect(scrollAfter).toBeGreaterThan(scrollBefore);
  expect(stateAfter.progress).toBeGreaterThan(stateBefore.progress);

  // 3. Toggling Free Orbit mode must switch canvas touch-action to none
  await page.locator('.orbit-toggle').tap();
  await page.waitForTimeout(500);

  const orbitTouchAction = await page.evaluate(() => {
    const canvas = document.querySelector('#webgl') as HTMLCanvasElement;
    return getComputedStyle(canvas).touchAction;
  });
  expect(orbitTouchAction).toBe('none');

  // 4. Exiting Free Orbit mode must restore canvas touch-action to pan-y
  await page.locator('.orbit-toggle').tap();
  await page.waitForTimeout(500);

  const restoredTouchAction = await page.evaluate(() => {
    const canvas = document.querySelector('#webgl') as HTMLCanvasElement;
    return getComputedStyle(canvas).touchAction;
  });
  expect(restoredTouchAction).toBe('pan-y');
});
