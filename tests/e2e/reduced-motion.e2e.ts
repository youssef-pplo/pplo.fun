import { expect, expectFiniteState, jumpToChapter, openStory, readState, scrollToProgress, test } from './support';

test.use({ reducedMotion: 'reduce' });

test('honors reduced motion with stable chapter-rest cameras while preserving native scroll and keyboard navigation', async ({ page }) => {
  await openStory(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const durations = await page.locator('#story-chapter-0').evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(durations.split(',').every((duration) => parseFloat(duration) <= 0.02)).toBe(true);

  await jumpToChapter(page, 2);
  const before = await scrollToProgress(page, 0.34);
  const after = await scrollToProgress(page, 0.40);
  expectFiniteState(before);
  expectFiniteState(after);
  expect(before.chapter).toBe(2);
  expect(after.chapter).toBe(2);
  after.camera.position.forEach((value, index) => expect(value).toBeCloseTo(before.camera.position[index], 6));
  after.camera.target.forEach((value, index) => expect(value).toBeCloseTo(before.camera.target[index], 6));
  expect(after.camera.focalLength).toBeCloseTo(before.camera.focalLength, 6);
  await expect(page.locator('#story-chapter-2')).toHaveAttribute('aria-hidden', 'false');

  await page.locator('[data-dock-chapter="2"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readState(page)).chapter).toBe(3);
  await expect(page.locator('[data-dock-chapter="3"]')).toBeFocused();
  await expect(page.locator('#story-chapter-3')).toHaveAttribute('aria-hidden', 'false');
  const gpu = await readState(page);
  expectFiniteState(gpu);
  expect(gpu.camera.target).not.toEqual(after.camera.target);

  await page.keyboard.press('o');
  await expect.poll(async () => (await readState(page)).orbit).toBe(true);
  await expect.poll(async () => (await readState(page)).hardware.every(({ visible }) => visible)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await readState(page)).orbit).toBe(false);
  const final = await scrollToProgress(page, 1);
  expectFiniteState(final);
  expect(final.chapter).toBe(6);
  await expect(page.locator('[data-dock-chapter="6"]')).toHaveAttribute('aria-current', 'step');
});
