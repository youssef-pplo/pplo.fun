import { expectedArsenal, expectedChapters, expectedContacts, expectedIdentity, expectedProjects } from '../fixtures/portfolio';
import { expect, expectNoHorizontalOverflow, expectTouchTargets, test } from './support';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]) {
  test.describe(`WebGL unavailable — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });

    test('retains the complete static portfolio, native scrolling, contact routes, navigation, and accessible inspector', async ({ page, runtime }) => {
      await page.addInitScript(() => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          configurable: true,
          value(this: HTMLCanvasElement, type: string, ...options: unknown[]) {
            if (/^(?:webgl2?|experimental-webgl)$/i.test(type)) return null;
            return Reflect.apply(nativeGetContext, this, [type, ...options]);
          },
        });
      });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-renderer', 'fallback', { timeout: 45_000 });
      const fallback = page.locator('.static-fallback');
      await expect(fallback).toBeVisible();
      await expect(page.locator('.boot-screen')).toBeHidden();
      await expect(page.locator('#webgl')).toBeHidden();
      await expect(fallback.getByRole('heading', { level: 1, name: /Youssef\s*Elsaid/i })).toBeVisible();
      await expect(fallback.getByText('The 3D experience is unavailable. The complete portfolio is right here.', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        return canvas.getContext('webgl2') === null && canvas.getContext('2d') !== null;
      }), 'only WebGL, not the DOM or Canvas2D, was deliberately disabled').toBe(true);

      await expect(fallback.locator('[data-static-chapter]')).toHaveCount(7);
      await expect(fallback.locator('.project-card')).toHaveCount(6);
      await expect(fallback.locator('.biography__full')).toHaveText(expectedIdentity.bio);
      await expect(fallback.locator('.interests li')).toHaveText([...expectedIdentity.interests]);
      for (const project of expectedProjects) {
        const link = fallback.getByRole('link', { name: `Visit ${project.title} (opens in a new tab)`, exact: true });
        await expect(link).toHaveAttribute('href', project.url);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(fallback.getByRole('heading', { name: project.title, exact: true })).toHaveCount(1);
      }
      await expect(fallback.locator('.skill-group')).toHaveCount(expectedArsenal.length);
      for (const category of expectedArsenal) {
        await expect(fallback.getByRole('region', { name: category.title, exact: true }).locator('li')).toHaveText([...category.items]);
      }
      await expect(fallback.locator('.contact-links a')).toHaveCount(expectedContacts.length);
      for (const contact of expectedContacts) {
        const link = fallback.locator(`.contact-links a[href="${contact.href}"]`);
        await expect(link).toHaveCount(1);
        await expect(link).toContainText(contact.value);
      }
      await expectNoHorizontalOverflow(page);
      if (viewport.mobile) await expectTouchTargets(page.locator('#interface'));

      const dock = page.getByRole('navigation', { name: 'Story chapters' });
      await expect(dock.getByRole('button')).toHaveCount(expectedChapters.length);
      for (const index of [0, 1, 2, 3, 4, 5, 6, 5, 3, 2, 0]) {
        const button = page.locator(`[data-dock-chapter="${index}"]`);
        await button.click();
        await expect(fallback.locator(`[data-static-chapter="${index}"]`)).toBeFocused();
        await expect(button).toHaveAttribute('aria-current', 'step');
      }
      for (const [group, index] of [['about', 2], ['work', 3], ['contact', 6]] as const) {
        await page.locator(`[data-nav-group="${group}"]`).click();
        await expect(fallback.locator(`[data-static-chapter="${index}"]`)).toBeFocused();
        await expect(page.locator(`[data-dock-chapter="${index}"]`)).toHaveAttribute('aria-current', 'step');
      }
      expect(await fallback.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

      const inspectorButton = fallback.getByRole('button', { name: /Open the human specification/ });
      await inspectorButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').locator('.biography__full')).toHaveText(expectedIdentity.bio);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(inspectorButton).toBeFocused();
      await expectNoHorizontalOverflow(page);
      expect(runtime.externalRequests, 'the complete fallback must not fetch remote content').toEqual([]);
      expect(runtime.consoleErrors.filter((message) => !/WebGL|rendering context/i.test(message))).toEqual([]);
    });
  });
}
