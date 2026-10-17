import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './style.css';
import { chapters } from './data';
import { createInterface } from './ui/interface';
import type { PortfolioExperience } from './scene/experience';

const root = document.querySelector<HTMLElement>('#interface');
const canvas = document.querySelector<HTMLCanvasElement>('#webgl');
if (!root || !canvas) throw new Error('The portfolio application shell is missing.');

let experience: PortfolioExperience | null = null;
let pendingDestination: number | null = null;
let disposed = false;
const lifecycle = new AbortController();
const ui = createInterface(root, {
  onNavigate: (progress) => { if (experience) experience.navigate(progress); else pendingDestination = progress; },
  onToggleOrbit: () => experience?.toggleOrbit(),
  onInspect: (id) => experience?.inspect(id),
  onCloseInspector: () => experience?.closeInspector(),
});

async function boot(): Promise<void> {
  ui.boot(0.04, 'PPLO BIOS v4.02 — Initializing a little curiosity.');
  try {
    // Typography is loaded locally before it is permanently etched onto hardware textures.
    await Promise.all([
      document.fonts.load('600 96px "Space Grotesk Variable"'),
      document.fonts.load('400 14px "JetBrains Mono"'),
      document.fonts.load('500 14px "JetBrains Mono"'),
    ]);
    ui.boot(0.10, 'Type calibrated. Building everything from first principles.');
    const { createExperience } = await import('./scene/experience');
    if (disposed) return;
    const initialized = await createExperience(canvas!, ui);
    if (disposed) { initialized.dispose(); return; }
    experience = initialized;
    ui.ready();
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
      Object.defineProperty(window, '__PPLO__', {
        configurable: true,
        value: Object.freeze({ getState: () => experience?.getState() }),
      });
    }
    const chapterIndex = chapters.findIndex((chapter) => `#${chapter.id}` === location.hash);
    if (pendingDestination !== null) experience.navigate(pendingDestination);
    else if (chapterIndex > 0) experience.navigate(chapters[chapterIndex].range[0] + 0.02);
  } catch (error) {
    if (disposed) return;
    console.warn('PPLO is using the complete static edition:', error);
    document.documentElement.dataset.renderer = 'fallback';
    ui.error(error instanceof Error ? error.message : 'This browser could not initialize WebGL. All portfolio content is available below.');
  }
}

void boot();

const dispose = (): void => {
  if (disposed) return;
  disposed = true;
  lifecycle.abort();
  experience?.dispose();
  ui.dispose();
  Reflect.deleteProperty(window, '__PPLO__');
};
window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); }, { signal: lifecycle.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
