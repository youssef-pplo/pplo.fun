import { expectedArsenal, expectedProjects, ramProgress } from '../fixtures/portfolio';
import {
  capture,
  expect,
  expectFiniteState,
  expectNoHorizontalOverflow,
  expectTouchTargets,
  openStory,
  readState,
  test,
  waitForProgress,
} from './support';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('keeps the 390px experience within the viewport with touch-sized controls, independently scrolling content, and complete arsenal tabs', async ({ page }, testInfo) => {
  await openStory(page);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page.locator('#interface'));
  await expect(page.locator('#hero-name')).toBeVisible();
  await capture(page, testInfo, 'mobile-hero.png');

  await page.locator('[data-dock-chapter="2"]').tap();
  await waitForProgress(page, 0.32);
  await capture(page, testInfo, 'mobile-cpu.png');
  const sidebar = page.locator('#story-chapter-2 .panel-scroll');
  expect(await sidebar.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
  const before = (await readState(page)).progress;
  await sidebar.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect((await readState(page)).progress).toBeCloseTo(before, 3);
  expect((await readState(page)).chapter).toBe(2);
  await expectNoHorizontalOverflow(page);
  await expectTouchTargets(page.locator('#interface'));

  await page.locator('[data-dock-chapter="4"]').tap();
  await waitForProgress(page, 0.64);
  const memoryTabs = page.getByRole('tablist', { name: 'Selected project modules' });
  await expectTouchTargets(memoryTabs);
  await memoryTabs.getByRole('tab').nth(3).tap();
  await waitForProgress(page, ramProgress[3]);
  await expect(memoryTabs.getByRole('tab').nth(3)).toHaveAttribute('aria-selected', 'true');
  const kotobee = expectedProjects.find(({ id }) => id === 'kotobee')!;
  await expect(page.locator('#memory-project .project-card__heading a')).toHaveAttribute('href', kotobee.url);
  await expect(page.locator('[data-ref="scroll-percent"]')).toHaveText('078');
  await expectNoHorizontalOverflow(page);

  await page.locator('[data-dock-chapter="5"]').tap();
  await waitForProgress(page, 0.82);
  const tabs = page.getByRole('tablist', { name: 'Skill categories' });
  await expect(tabs.getByRole('tab')).toHaveCount(expectedArsenal.length);
  await expectTouchTargets(tabs);
  await capture(page, testInfo, 'mobile-arsenal.png');
  for (let index = 0; index < expectedArsenal.length; index += 1) {
    const category = expectedArsenal[index];
    const tab = tabs.getByRole('tab').nth(index);
    await tab.tap();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { selected: true })).toHaveCount(1);
    const panel = page.locator(`#arsenal-panel-${category.id}`);
    await expect(panel).toHaveAttribute('aria-labelledby', `arsenal-tab-${category.id}`);
    await expect(panel).toBeVisible();
    await expect(panel.locator('.skill-list li')).toContainText([...category.items]);
    await expect(page.locator('.arsenal-panel:not([hidden])')).toHaveCount(1);
    expect((await readState(page)).chapter).toBe(5);
    expect((await readState(page)).progress).toBeCloseTo(0.82, 3);
    await expectNoHorizontalOverflow(page);
  }
  await tabs.getByRole('tab').nth(7).press('Home');
  await expect(tabs.getByRole('tab').nth(0)).toBeFocused();
  await expect(tabs.getByRole('tab').nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab').nth(7)).toBeFocused();
  await expect(tabs.getByRole('tab').nth(7)).toHaveAttribute('aria-selected', 'true');
  expectFiniteState(await readState(page));
});
