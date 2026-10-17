import { arsenal, chapters, contacts, identity, projects } from '../data';
import type { HardwareId, InterfaceActions, InterfaceController, InterfaceState, PortfolioProject } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const escapeHTML = (value: string | number): string => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const ramProjects = projects.filter((project) => project.hardware.startsWith('ram-'));
const aiProjects = projects.filter((project) => project.hardware === 'gpu');
const skillCount = arsenal.reduce((total, category) => total + category.items.length, 0);
const chapterTarget = (index: number): number => index === 0 ? 0 : Math.min(chapters[index].range[0] + 0.02, 1);
const ramTarget = (index: number): number => chapters[4].range[0] + (chapters[4].range[1] - chapters[4].range[0]) * ((index + 0.5) / ramProjects.length);

const hardware: Record<HardwareId, { label: string; short: string; title: string; description: string; index: string }> = {
  pcb: { label: 'PCB / THE FOUNDATION', short: 'Mainboard', title: 'Built on curiosity.', description: chapters[1].description, index: '00' },
  cpu: { label: 'CPU / THE HUMAN CORE', short: 'CPU', title: 'Human at the core.', description: chapters[2].description, index: '01' },
  gpu: { label: 'GPU / THE NEURAL ENGINE', short: 'GPU', title: 'Intelligence, applied.', description: chapters[3].description, index: '02' },
  'ram-0': { label: 'DIMM_A1 / COMMERCE', short: 'RAM · A1', title: 'Steam1st Store', description: ramProjects[0].description, index: '03' },
  'ram-1': { label: 'DIMM_A2 / COMMUNITY', short: 'RAM · A2', title: 'Alcoders', description: ramProjects[1].description, index: '04' },
  'ram-2': { label: 'DIMM_B1 / EDUCATION', short: 'RAM · B1', title: 'EasyBio', description: ramProjects[2].description, index: '05' },
  'ram-3': { label: 'DIMM_B2 / INFRASTRUCTURE', short: 'RAM · B2', title: 'Kotobee', description: ramProjects[3].description, index: '06' },
  'nvme-0': { label: 'NVME_01 / THE KNOWLEDGE BANK', short: 'NVMe · 01', title: 'The right tools.', description: chapters[5].description, index: '07' },
  'nvme-1': { label: 'NVME_02 / THE CREATIVE BANK', short: 'NVMe · 02', title: 'Always in development.', description: 'From systems thinking to creative coding. A practice built around continuous learning.', index: '08' },
  pch: { label: 'PCH / CONNECTED THINKING', short: 'Chipset', title: 'Connect the dots.', description: 'AI research, full-stack development, and creative curiosity. Different disciplines. One connected practice.', index: '09' },
  io: { label: 'I/O / OPEN CONNECTIONS', short: 'I/O', title: 'A good place to start.', description: chapters[6].description, index: '10' },
};
const hardwareIds = Object.keys(hardware) as HardwareId[];
type InspectorTab = 'overview' | 'bio' | 'projects' | 'arsenal' | 'contact';
const inspectorTabs: readonly { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Component' }, { id: 'bio', label: 'Biography' }, { id: 'projects', label: 'Projects' }, { id: 'arsenal', label: 'Arsenal' }, { id: 'contact', label: 'Contact' },
];

type IconName = 'arrow' | 'down' | 'orbit' | 'close' | 'pin' | 'chip' | 'plus' | 'chevron';
function icon(name: IconName): string {
  const paths: Record<IconName, string> = {
    arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
    down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
    orbit: '<ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-35 12 12)"/><path d="M8 3c-2 3-2 8 0 13s5 7 7 5 2-8 0-13-5-7-7-5Z"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><rect x="9" y="9" width="6" height="6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name]}</svg>`;
}

function boardDrawing(): string {
  return '<svg class="board-drawing" viewBox="0 0 88 100" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true"><path d="M9 4h58l12 12v79H9Z"/><path d="M14 9h46m14 13v63M14 89h54" opacity=".35"/><rect x="23" y="24" width="29" height="29"/><rect x="28" y="29" width="19" height="19"/><path d="M29 19v5m6-5v5m6-5v5m6-5v5M29 53v6m6-6v6m6-6v6m6-6v6M18 30h5m-5 6h5m-5 6h5m-5 6h5m29-18h5m-5 6h5m-5 6h5m-5 6h5"/><path d="M63 27h5v36h-5zM63 68h5v15h-5zM19 69h35v5H19zM19 80h35v5H19zM12 17h6v30h-6z"/><path d="M35 59v5H19v5m28-10v5h10v16m0-44h6M18 54v9h-4v20" opacity=".5"/><circle cx="15" cy="10" r="1.4"/><circle cx="73" cy="89" r="1.4"/><path d="M34 35h7v7h-7z" fill="currentColor" stroke="none"/></svg>';
}

function techList(items: readonly string[]): string {
  return `<ul class="tech-list" aria-label="Technologies">${items.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
}

function projectCard(project: PortfolioProject, detailed = false): string {
  return `<article class="project-card${detailed ? ' project-card--detailed' : ''}">
    <div class="project-card__overline"><span>${escapeHTML(project.index)} / ${escapeHTML(project.category)}</span><span class="project-card__signal" aria-hidden="true"></span></div>
    <div class="project-card__heading"><h3>${escapeHTML(project.title)}</h3><a class="icon-link" href="${escapeHTML(project.url)}" target="_blank" rel="noopener noreferrer" aria-label="Visit ${escapeHTML(project.title)} (opens in a new tab)">${icon('arrow')}</a></div>
    <p class="project-card__description">${escapeHTML(project.description)}</p>
    ${techList(project.tech)}
    ${detailed ? `<dl class="project-details"><div><dt>Contribution</dt><dd>${escapeHTML(project.role)}</dd></div><div><dt>Specification</dt><dd>${escapeHTML(project.spec)}</dd></div></dl><a class="text-link" href="${escapeHTML(project.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(new URL(project.url).hostname)} ${icon('arrow')}<span class="sr-only"> (opens in a new tab)</span></a>` : `<div class="project-card__bottom"><span>${escapeHTML(project.role)}</span><button class="micro-button" type="button" data-action="inspect" data-hardware="${project.hardware}" aria-label="Inspect ${escapeHTML(project.title)}">DETAILS ${icon('plus')}</button></div>`}
  </article>`;
}

function bioContent(): string {
  return `<div class="biography"><p class="biography__full">${escapeHTML(identity.bio)}</p><div class="bio-stats"><div><strong>08<span>Y/O</span></strong><span>FIRST LINE OF CODE</span></div><div><strong>30<span>+</span></strong><span>LANGUAGES & TECHNOLOGIES</span></div></div><div class="interests"><span class="micro-label">AWAY FROM THE KEYBOARD</span><ul>${identity.interests.map((interest) => `<li>${escapeHTML(interest)}</li>`).join('')}</ul></div></div>`;
}

function allSkills(): string {
  return `<div class="full-arsenal">${arsenal.map((category, index) => `<section class="skill-group" aria-label="${escapeHTML(category.title)}"><div class="skill-group__heading"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHTML(category.title)}</h3><span>${String(category.items.length).padStart(2, '0')}</span></div><ul>${category.items.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section>`).join('')}</div>`;
}

function contactLinks(detailed = false): string {
  return `<ul class="contact-links${detailed ? ' contact-links--detailed' : ''}">${contacts.map((contact, index) => `<li><a href="${escapeHTML(contact.href)}"${contact.href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="contact-links__number">0${index + 1}</span><span class="contact-links__text"><span class="contact-links__name">${escapeHTML(contact.name)}</span><span class="contact-links__value">${escapeHTML(detailed ? contact.value : contact.label)}</span></span>${icon('arrow')}<span class="sr-only">${contact.href.startsWith('https://') ? ' (opens in a new tab)' : ''}</span></a></li>`).join('')}</ul>`;
}

function availability(): string {
  return `<span class="availability"><span class="status-dot" aria-hidden="true"></span>${escapeHTML(identity.availability)}</span>`;
}

function chapterHeading(index: number, title: string): string {
  return `<p class="chapter-eyebrow"><span class="eyebrow-cross" aria-hidden="true">+</span>${escapeHTML(chapters[index].eyebrow)}</p><h2 class="chapter-title">${title}</h2>`;
}

function inspectionButton(id: HardwareId, label: string): string {
  return `<button class="inspect-link" type="button" data-action="inspect" data-hardware="${id}">${icon('plus')}<span>${escapeHTML(label)}</span><span class="inspect-link__code">${escapeHTML(id.toUpperCase())}</span></button>`;
}

function foundationStats(): string {
  return '<dl class="ignition-stats"><div><dt>THE FIRST SPARK</dt><dd>08<span> Y/O</span></dd></div><div><dt>TOOLS IN THE SYSTEM</dt><dd>30<span>+</span></dd></div><div><dt>SELECTED PROJECTS</dt><dd>06</dd></div></dl>';
}

function staticPortfolio(): string {
  return `<div class="fallback-content">
    <section class="fallback-intro" data-static-chapter="0" id="static-intro"><div class="fallback-edition"><span class="status-dot" aria-hidden="true"></span>THE STATIC EDITION / ALL SIGNAL, NO RENDER</div><h1 id="fallback-heading">Youssef<br>Elsaid<span>.</span></h1><p class="fallback-role">${escapeHTML(identity.role)}</p><p class="fallback-subcopy">Building intelligent systems. Making complex feel simple.</p>${availability()}<div class="fallback-notice" role="status"><p>The 3D experience is unavailable. The complete portfolio is right here.</p><details><summary>Rendering report</summary><p data-ref="fallback-error"></p></details></div></section>
    <section class="fallback-section" data-static-chapter="1" id="static-foundation"><p class="chapter-eyebrow">02 / THE FOUNDATION</p><h2>A foundation for possibility.</h2><p class="section-lead">${escapeHTML(chapters[1].description)}</p>${foundationStats()}</section>
    <section class="fallback-section" data-static-chapter="2" id="static-bio"><p class="chapter-eyebrow">03 / THE HUMAN CORE</p><h2>Human at the core.</h2>${bioContent()}${inspectionButton('cpu', 'Open the human specification')}</section>
    <section class="fallback-section" data-static-chapter="3" id="static-ai"><p class="chapter-eyebrow">04 / THE NEURAL ENGINE</p><h2>Intelligence, accelerated.</h2><div class="fallback-projects">${aiProjects.map((project) => projectCard(project, true)).join('')}</div></section>
    <section class="fallback-section" data-static-chapter="4" id="static-work"><p class="chapter-eyebrow">05 / SELECTED WORK</p><h2>Ideas, loaded into reality.</h2><div class="fallback-projects">${ramProjects.map((project) => projectCard(project, true)).join('')}</div></section>
    <section class="fallback-section" data-static-chapter="5" id="static-arsenal"><p class="chapter-eyebrow">06 / THE KNOWLEDGE BANK</p><h2>A constantly evolving arsenal.</h2><p class="section-lead">${escapeHTML(chapters[5].description)}</p>${allSkills()}</section>
    <section class="fallback-section fallback-contact" data-static-chapter="6" id="static-contact"><p class="chapter-eyebrow">07 / OPEN CONNECTIONS</p><h2>Your next idea.<br><span>Our next build.</span></h2>${availability()}${contactLinks(true)}<p class="fallback-colophon">${escapeHTML(identity.location)} / Working everywhere.<br>${escapeHTML(identity.copyright)} ${escapeHTML(identity.alias)}. Engineered to think.</p></section>
  </div>`;
}

/** A pinned, DOM-only interface. Scene ownership stays with the application. */
export function createInterface(root: HTMLElement, actions: InterfaceActions): InterfaceController {
  const events = new AbortController();
  const { signal } = events;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let isReady = false;
  let failed = false;
  let activeChapter = 0;
  let activeRam = 0;
  let activeSkill = 0;
  let orbit = false;
  let hovered: HardwareId | null = null;
  let inspectorId: HardwareId | null = null;
  let inspectorTab: InspectorTab = 'overview';
  let restoreFocus: HTMLElement | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let peelTimer: ReturnType<typeof setTimeout> | undefined;
  let peelFrame = 0;
  let fallbackFrame = 0;
  let lastProgress = '';
  let lastFocal = '';
  let lastFps = '';
  let lastBootProgress = -1;
  let lastBootMessage = '';
  let lastTelemetryTime = 0;

  root.classList.add('portfolio-interface', 'is-booting');
  root.dataset.chapter = '0';
  root.innerHTML = `
    <button class="skip-link" type="button" data-action="focus-story">Skip to chapter content</button>
    <header class="site-header">
      <button class="brand" type="button" data-action="navigate" data-progress="0" aria-label="pplo. — back to the beginning"><span class="brand__name">pplo<span>.</span></span><span class="brand__descriptor">ENGINEERED<br>TO THINK</span></button>
      <div class="header-availability">${availability()}</div>
      <nav class="primary-nav" aria-label="Main navigation"><button type="button" data-action="navigate" data-progress="${chapterTarget(3)}" data-nav-group="work">Work<span>01</span></button><button type="button" data-action="navigate" data-progress="${chapterTarget(2)}" data-nav-group="about">About<span>02</span></button><button type="button" data-action="navigate" data-progress="${chapterTarget(6)}" data-nav-group="contact">Contact${icon('arrow')}</button></nav>
    </header>
    <div class="interface-vignette" aria-hidden="true"></div>
    <div class="blueprint-peel" aria-hidden="true"><div class="blueprint-peel__sheet"><span class="blueprint-peel__label"></span><span class="blueprint-peel__folio"></span><span class="blueprint-peel__spec">PPLO—Z990 / ARCHITECTURE IN MOTION</span></div></div>
    <div class="stage-coordinate" aria-hidden="true"><span>PERSONAL SYSTEM / 2027</span><span>FORM FOLLOWS CURIOSITY.</span></div>
    <main class="story-panels" aria-label="Anatomy of a builder">
      <section class="chapter-panel chapter-panel--hero is-active" data-chapter="0" id="story-chapter-0" aria-labelledby="hero-name" tabindex="-1">
        <p class="hero-eyebrow"><span class="signal-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span>ANATOMY OF A BUILDER<span class="hero-edition">PORTFOLIO / 01—07</span></p>
        <h1 class="hero-name" id="hero-name"><span class="hero-name__clip"><span>YOUSSEF</span></span><span class="hero-name__clip"><span>ELSAID<span class="hero-period">.</span></span></span></h1>
        <p class="hero-role">Software Engineer <span>&</span> AI Architect</p>
        <p class="hero-subcopy">Building intelligent systems.<br>Making complex feel simple.</p>
        <div class="hero-bottom"><button class="explore-button" type="button" data-action="navigate" data-progress="0.16"><span class="explore-button__arrow">${icon('down')}</span><span>EXPLORE THE SYSTEM<span class="explore-button__hint">SCROLL TO ASSEMBLE</span></span></button><div class="location-stamp"><span>BASED IN ALEXANDRIA</span><span>WORKING EVERYWHERE ${icon('arrow')}</span></div></div>
      </section>
      <section class="chapter-panel" data-chapter="1" id="story-chapter-1" aria-labelledby="foundation-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(1, 'A foundation<br>for possibility.').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="foundation-title">')}<p class="section-lead">${escapeHTML(chapters[1].description)}</p><div class="ignition-label"><span class="status-dot" aria-hidden="true"></span>THE SYSTEM BEGINS WITH A SPARK</div>${foundationStats()}<ol class="foundation-sequence"><li><span>01</span>Curiosity.</li><li><span>02</span>Architecture.</li><li><span>03</span>Possibility.</li></ol>${inspectionButton('pcb', 'Inspect the foundation')}</div>
      </section>
      <section class="chapter-panel" data-chapter="2" id="story-chapter-2" aria-labelledby="bio-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(2, 'Human at<br>the core.').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="bio-title">')}<div class="bio-location">${icon('pin')} ${escapeHTML(identity.location)} <span>// ${escapeHTML(identity.since)}</span></div>${bioContent()}${inspectionButton('cpu', 'Inspect the human core')}</div>
      </section>
      <section class="chapter-panel chapter-panel--projects" data-chapter="3" id="story-chapter-3" aria-labelledby="ai-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(3, 'Intelligence,<br>accelerated.').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="ai-title">')}<p class="section-lead section-lead--compact">${escapeHTML(chapters[3].description)}</p><div class="ai-projects">${aiProjects.map((project) => projectCard(project)).join('')}</div></div>
      </section>
      <section class="chapter-panel chapter-panel--ram" data-chapter="4" id="story-chapter-4" aria-labelledby="work-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(4, 'Ideas. Loaded<br>into reality.').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="work-title">')}<p class="section-lead section-lead--compact">${escapeHTML(chapters[4].description)}</p><div class="memory-readout"><span>ACTIVE MEMORY / SELECT A MODULE</span><span><b data-ref="ram-count">01</b> / 04</span></div><div class="memory-tabs" role="tablist" aria-label="Selected project modules">${ramProjects.map((project, index) => `<button type="button" role="tab" id="memory-tab-${index}" class="memory-tab${index === 0 ? ' is-active' : ''}" aria-controls="memory-project" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" data-action="memory-tab" data-index="${index}" aria-label="Module ${index + 1}: ${escapeHTML(project.title)}"><span class="memory-tab__index">0${index + 1}</span><span>DIMM_${['A1', 'A2', 'B1', 'B2'][index]}</span><span class="memory-tab__pins" aria-hidden="true"></span></button>`).join('')}</div><div id="memory-project" class="memory-project" role="tabpanel" aria-labelledby="memory-tab-0" tabindex="0">${projectCard(ramProjects[0], true)}${inspectionButton('ram-0', 'Inspect this module')}</div></div>
      </section>
      <section class="chapter-panel chapter-panel--arsenal" data-chapter="5" id="story-chapter-5" aria-labelledby="arsenal-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(5, 'Never stop<br>developing.').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="arsenal-title">')}<p class="section-lead section-lead--compact">${escapeHTML(chapters[5].description)}</p><div class="arsenal-summary"><span>${String(skillCount).padStart(2, '0')} SKILLS / ${String(arsenal.length).padStart(2, '0')} DISCIPLINES</span><span>KNOWLEDGE IS NON-VOLATILE</span></div><div class="arsenal-tabs" role="tablist" aria-label="Skill categories">${arsenal.map((category, index) => `<button type="button" role="tab" id="arsenal-tab-${category.id}" aria-controls="arsenal-panel-${category.id}" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" class="arsenal-tab${index === 0 ? ' is-active' : ''}" data-action="skill-tab" data-index="${index}"><span>${String(index + 1).padStart(2, '0')}</span>${escapeHTML(category.title)}</button>`).join('')}</div><div class="arsenal-panels">${arsenal.map((category, index) => `<section id="arsenal-panel-${category.id}" class="arsenal-panel" role="tabpanel" aria-labelledby="arsenal-tab-${category.id}" tabindex="0"${index === 0 ? '' : ' hidden'}><div class="arsenal-panel__heading"><h3>${escapeHTML(category.title)}</h3><span>${String(category.items.length).padStart(2, '0')} ENTRIES</span></div><ul class="skill-list">${category.items.map((item, skillIndex) => `<li><span>${String(skillIndex + 1).padStart(2, '0')}</span>${escapeHTML(item)}</li>`).join('')}</ul></section>`).join('')}</div>${inspectionButton('nvme-0', 'Open the complete arsenal')}</div>
      </section>
      <section class="chapter-panel chapter-panel--contact" data-chapter="6" id="story-chapter-6" aria-labelledby="contact-title" aria-hidden="true" inert tabindex="-1">
        <div class="panel-scroll">${chapterHeading(6, 'Your next idea.<br><span>Our next build.</span>').replace('<h2 class="chapter-title">', '<h2 class="chapter-title" id="contact-title">')}<p class="section-lead section-lead--compact">${escapeHTML(chapters[6].description)}</p><div class="contact-availability">${availability()}<span>ALEXANDRIA → EVERYWHERE</span></div>${contactLinks()}${inspectionButton('io', 'Inspect the connections')}</div>
      </section>
    </main>
    <aside class="hero-plaque" aria-label="PPLO Z990 personal architecture"><div class="hero-plaque__drawing">${boardDrawing()}</div><div><span class="hero-plaque__model">PPLO—Z990</span><span class="hero-plaque__description">A PERSONAL<br>ARCHITECTURE.</span><span class="hero-plaque__serial">PROCEDURAL / NO. 001 ${icon('plus')}</span></div></aside>
    <aside class="orbit-console" aria-labelledby="orbit-heading" aria-hidden="true" inert tabindex="-1"><p class="chapter-eyebrow"><span class="status-dot" aria-hidden="true"></span>MANUAL CONTROL</p><h2 id="orbit-heading">A closer look.</h2><p class="orbit-console__instructions">Drag to orbit. Scroll to zoom.<br>Select a component to inspect.</p><div class="component-list" aria-label="Inspect components">${hardwareIds.map((id) => `<button type="button" data-action="inspect" data-hardware="${id}" data-part="${id}"><span>${escapeHTML(hardware[id].index)}</span>${escapeHTML(hardware[id].short)}${icon('plus')}</button>`).join('')}</div><p class="orbit-console__legend">${icon('chip')} INSPECT COMPONENTS <span>ESC TO RETURN</span></p></aside>
    <div class="orbit-control"><button class="orbit-toggle" type="button" data-action="orbit" aria-pressed="false" aria-keyshortcuts="O" aria-label="Enable free orbit to explore the motherboard">${icon('orbit')}<span data-ref="orbit-label">FREE ORBIT</span><kbd>O</kbd></button><span class="orbit-control__caption" data-ref="orbit-caption">TAKE THE SYSTEM FOR A SPIN</span></div>
    <footer class="interface-footer">
      <div class="location-hud"><span class="location-hud__name">${icon('pin')}ALEXANDRIA, EG<span class="location-hud__cross" aria-hidden="true">+</span></span><span class="location-hud__coordinates">${escapeHTML(identity.coordinates)}</span><span class="copyright">${escapeHTML(identity.copyright)} PPLO.</span></div>
      <nav class="chapter-dock" aria-label="Story chapters"><div class="chapter-dock__top"><span data-ref="chapter-short">THE CODIC VOID</span><span><span data-ref="scroll-percent">000</span><span class="chapter-dock__percent">%</span></span></div><div class="chapter-dock__buttons">${chapters.map((chapter, index) => `<button type="button" class="chapter-dot${index === 0 ? ' is-active' : ''}" data-action="navigate" data-progress="${chapterTarget(index)}" data-dock-chapter="${index}" aria-label="Chapter ${index + 1}: ${escapeHTML(chapter.title)}"${index === 0 ? ' aria-current="step"' : ''}><span class="chapter-dot__number">0${index + 1}</span><span class="chapter-dot__name">${escapeHTML(chapter.short.split(' / ')[0])}</span></button>`).join('')}</div><div class="chapter-dock__track" role="progressbar" aria-label="Portfolio scroll progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-ref="story-progress"></span></div></nav>
      <div class="telemetry-hud"><div class="telemetry-hud__line"><span>FOCAL <b data-ref="focal-length">—</b> MM</span><span><b data-ref="fps">—</b> FPS</span></div><div class="telemetry-hud__line telemetry-hud__line--memory"><span>6400 MT/s</span><span>1.24 V</span></div><div class="system-status"><span class="status-dot" aria-hidden="true"></span><span data-ref="system-status">SYSTEM INITIALIZING</span></div></div>
    </footer>
    <main class="static-fallback" hidden aria-labelledby="fallback-heading" tabindex="-1" data-lenis-prevent></main>
    <div class="chapter-announcer sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
    <div class="boot-screen" aria-label="Loading the 3D portfolio"><div class="boot-screen__top"><span>PPLO BIOS v4.02</span><span>PERSONAL SYSTEM / UEFI</span></div><div class="boot-screen__center"><div class="boot-screen__brand">pplo<span>.</span><span class="boot-screen__brand-cross">+</span></div><p class="boot-screen__title">INITIALIZING 3D<br>MOTHERBOARD DIORAMA<span class="boot-ellipsis">...</span></p><div class="boot-readout"><p data-ref="boot-message" role="status" aria-live="polite">Establishing the foundation.</p><span><b data-ref="boot-percent">000</b><span> / 100</span></span></div><div class="boot-progress" role="progressbar" aria-label="Loading 3D experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="boot-stages" aria-hidden="true"><span class="is-lit">01 / FOUNDATION</span><span>02 / GEOMETRY</span><span>03 / IGNITION</span></div></div><div class="boot-screen__bottom"><span>ENGINEERED TO THINK.</span><span>FROM ALEXANDRIA, WITH CURIOSITY.</span></div></div>
    <dialog class="inspector" aria-modal="true" aria-labelledby="inspector-title" aria-describedby="inspector-description" data-lenis-prevent><div class="inspector__surface"><header class="inspector__header"><div><p class="chapter-eyebrow">COMPONENT INSPECTION <span data-ref="inspector-index">00</span></p><p class="inspector__hardware" data-ref="inspector-hardware"></p></div><button class="inspector__close" type="button" data-action="close-inspector" aria-label="Close component inspector">${icon('close')}<span>ESC</span></button></header><div class="inspector__intro"><h2 id="inspector-title"></h2><p id="inspector-description"></p></div><div class="inspector__tabs" role="tablist" aria-label="Inspector content">${inspectorTabs.map((tab, index) => `<button id="inspector-tab-${tab.id}" type="button" role="tab" aria-controls="inspector-content" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" data-action="inspector-tab" data-tab="${tab.id}">${tab.label}</button>`).join('')}</div><div class="inspector__scroll"><div id="inspector-content" role="tabpanel" aria-labelledby="inspector-tab-overview" tabindex="0"></div><div class="inspector__colophon"><span>PPLO—Z990 / PERSONAL ARCHITECTURE</span><span>${escapeHTML(identity.copyright)}</span></div></div></div></dialog>
  `;

  const element = <T extends Element = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const ref = <T extends Element = HTMLElement>(name: string): T => element<T>(`[data-ref="${name}"]`);
  const header = element<HTMLElement>('.site-header');
  const panels = Array.from(root.querySelectorAll<HTMLElement>('.chapter-panel'));
  const blueprintPeel = element<HTMLElement>('.blueprint-peel');
  const peelLabel = element<HTMLElement>('.blueprint-peel__label');
  const peelFolio = element<HTMLElement>('.blueprint-peel__folio');
  const dock = element<HTMLElement>('.chapter-dock');
  const dockButtons = Array.from(dock.querySelectorAll<HTMLButtonElement>('[data-dock-chapter]'));
  const chapterShort = ref('chapter-short');
  const progressText = ref('scroll-percent');
  const progressFill = ref('story-progress');
  const progressTrack = element<HTMLElement>('.chapter-dock__track');
  const announcer = element<HTMLElement>('.chapter-announcer');
  const orbitConsole = element<HTMLElement>('.orbit-console');
  const orbitControl = element<HTMLElement>('.orbit-control');
  const orbitButton = element<HTMLButtonElement>('.orbit-toggle');
  const orbitLabel = ref('orbit-label');
  const orbitCaption = ref('orbit-caption');
  const systemStatus = ref('system-status');
  const focal = ref('focal-length');
  const fps = ref('fps');
  const ramCount = ref('ram-count');
  const memoryPanel = element<HTMLElement>('#memory-project');
  const memoryTabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.memory-tab'));
  const skillTabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.arsenal-tab'));
  const skillPanels = Array.from(root.querySelectorAll<HTMLElement>('.arsenal-panel'));
  const componentButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-part]'));
  const primaryButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-nav-group]'));
  const fallback = element<HTMLElement>('.static-fallback');
  const loader = element<HTMLElement>('.boot-screen');
  const bootProgress = element<HTMLElement>('.boot-progress');
  const bootFill = element<HTMLElement>('.boot-progress > span');
  const bootPercent = ref('boot-percent');
  const bootMessage = ref('boot-message');
  const bootStages = Array.from(root.querySelectorAll<HTMLElement>('.boot-stages > span'));
  const inspector = element<HTMLDialogElement>('.inspector');
  const inspectorTitle = element<HTMLElement>('#inspector-title');
  const inspectorDescription = element<HTMLElement>('#inspector-description');
  const inspectorIndex = ref('inspector-index');
  const inspectorHardware = ref('inspector-hardware');
  const inspectorBody = element<HTMLElement>('#inspector-content');
  const inspectorScroll = element<HTMLElement>('.inspector__scroll');
  const inspectorTabButtons = Array.from(inspector.querySelectorAll<HTMLButtonElement>('[data-action="inspector-tab"]'));
  const inspectorClose = element<HTMLButtonElement>('.inspector__close');

  const projectionSvg = document.createElementNS(SVG_NS, 'svg');
  projectionSvg.classList.add('projection-layer', 'projection-lines');
  projectionSvg.setAttribute('aria-hidden', 'true');
  projectionSvg.setAttribute('focusable', 'false');
  const projectionLabels = document.createElement('div');
  projectionLabels.className = 'projection-layer projection-labels';
  projectionLabels.setAttribute('aria-hidden', 'true');
  // These two layers are deliberately empty: the renderer owns their children.
  root.insertBefore(projectionSvg, element('.story-panels'));
  root.insertBefore(projectionLabels, element('.story-panels'));

  function setVisibility(): void {
    panels.forEach((panel, index) => {
      const visible = index === activeChapter && !orbit && !failed && isReady;
      panel.classList.toggle('is-active', index === activeChapter && !failed);
      panel.inert = !visible;
      panel.setAttribute('aria-hidden', String(!visible));
    });
    header.inert = !isReady;
    dock.inert = !isReady;
    orbitControl.inert = !isReady || failed;
    orbitConsole.inert = !isReady || !orbit || failed;
    orbitConsole.setAttribute('aria-hidden', String(!isReady || !orbit || failed));
  }

  function stopPeel(): void {
    clearTimeout(peelTimer);
    peelTimer = undefined;
    cancelAnimationFrame(peelFrame);
    peelFrame = 0;
    blueprintPeel.classList.remove('is-active');
  }

  function playPeel(previousChapter: number): void {
    stopPeel();
    if (!isReady || orbit || failed || disposed || reducedMotion.matches) return;
    blueprintPeel.classList.toggle('is-reverse', activeChapter < previousChapter);
    blueprintPeel.dataset.chapter = String(activeChapter);
    blueprintPeel.style.setProperty('--peel-grid-offset', `${activeChapter * 7}px`);
    peelLabel.textContent = chapters[activeChapter].eyebrow;
    peelFolio.textContent = String(activeChapter + 1).padStart(2, '0');
    // A painted inactive frame restarts consecutive wipes without a layout flush.
    peelFrame = requestAnimationFrame(() => {
      peelFrame = requestAnimationFrame(() => {
        peelFrame = 0;
        if (!isReady || orbit || failed || disposed || reducedMotion.matches) return;
        blueprintPeel.classList.add('is-active');
        peelTimer = setTimeout(stopPeel, 650);
      });
    });
  }

  function setChapter(index: number, announce = true, peel = true): void {
    const previousChapter = activeChapter;
    const previousPanel = panels[activeChapter];
    const focusWasInPanel = previousPanel.contains(document.activeElement);
    activeChapter = Math.round(clamp(index, 0, chapters.length - 1));
    root.dataset.chapter = String(activeChapter);
    dockButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === activeChapter;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    chapterShort.textContent = chapters[activeChapter].eyebrow.split(' / ').slice(1).join(' / ');
    primaryButtons.forEach((button) => {
      const active = button.dataset.navGroup === (activeChapter === 2 ? 'about' : activeChapter === 3 || activeChapter === 4 ? 'work' : activeChapter === 6 ? 'contact' : '');
      if (active) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
    setVisibility();
    if (peel && previousChapter !== activeChapter) playPeel(previousChapter);
    if (focusWasInPanel && previousPanel !== panels[activeChapter] && isReady && !orbit && !failed) panels[activeChapter].focus({ preventScroll: true });
    if (announce && isReady && !orbit && !failed) announcer.textContent = `Chapter ${activeChapter + 1} of ${chapters.length}. ${chapters[activeChapter].title}`;
  }

  function setProgress(progress: number): void {
    const value = clamp(progress);
    const scaled = (value * 100).toFixed(1);
    if (scaled === lastProgress) return;
    lastProgress = scaled;
    const [start, end] = chapters[activeChapter].range;
    const drift = isReady && !orbit && !failed && !reducedMotion.matches ? (0.5 - clamp((value - start) / (end - start))) * 8 : 0;
    root.style.setProperty('--panel-drift', `${drift.toFixed(2)}px`);
    const percent = Math.round(value * 100);
    progressText.textContent = String(percent).padStart(3, '0');
    progressFill.style.transform = `scaleX(${value.toFixed(4)})`;
    if (progressTrack.getAttribute('aria-valuenow') !== String(percent)) progressTrack.setAttribute('aria-valuenow', String(percent));
  }

  function setRam(index: number): void {
    activeRam = Math.round(clamp(index, 0, ramProjects.length - 1));
    const project = ramProjects[activeRam];
    ramCount.textContent = String(activeRam + 1).padStart(2, '0');
    memoryTabs.forEach((button, buttonIndex) => {
      const selected = buttonIndex === activeRam;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    memoryPanel.setAttribute('aria-labelledby', `memory-tab-${activeRam}`);
    memoryPanel.innerHTML = `${projectCard(project, true)}${inspectionButton(project.hardware, 'Inspect this module')}`;
  }

  function selectSkill(index: number, focus = false): void {
    const next = Math.round(clamp(index, 0, arsenal.length - 1));
    if (next !== activeSkill) {
      activeSkill = next;
      skillTabs.forEach((button, tabIndex) => {
        const selected = tabIndex === next;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        skillPanels[tabIndex].hidden = !selected;
      });
    }
    if (focus) skillTabs[next].focus({ preventScroll: true });
  }

  function inspectorContent(id: HardwareId, tab: InspectorTab): string {
    if (tab === 'bio') return `<div class="inspector-section-label">THE ENGINEER BEHIND THE SYSTEM</div>${bioContent()}`;
    if (tab === 'projects') return `<div class="inspector-section-label">SIX PROJECTS / ONE CONNECTED PRACTICE</div><div class="inspector-projects">${projects.map((project) => projectCard(project, true)).join('')}</div>`;
    if (tab === 'arsenal') return `<div class="inspector-section-label">${skillCount} SKILLS / ${arsenal.length} DISCIPLINES</div>${allSkills()}`;
    if (tab === 'contact') return `<div class="inspector-contact-intro">${availability()}<p>${escapeHTML(identity.location)}.<br>Working everywhere.</p></div>${contactLinks(true)}`;
    if (id === 'cpu') return `<div class="inspector-section-label">${escapeHTML(identity.role)}</div>${bioContent()}`;
    if (id === 'gpu') return `<div class="inspector-section-label">RESEARCH → REAL-WORLD INTELLIGENCE</div><div class="inspector-projects">${aiProjects.map((project) => projectCard(project, true)).join('')}</div>`;
    if (id.startsWith('ram-')) {
      const project = ramProjects.find((item) => item.hardware === id)!;
      return `${projectCard(project, true)}<div class="inspector-section-label inspector-section-label--spaced">THE OTHER MEMORY MODULES</div><div class="inspector-module-links">${ramProjects.filter((item) => item.hardware !== id).map((item) => `<button type="button" data-action="inspect" data-hardware="${item.hardware}"><span>${escapeHTML(item.spec.split(' // ')[0])}</span><strong>${escapeHTML(item.title)}</strong>${icon('chevron')}</button>`).join('')}</div>`;
    }
    if (id === 'nvme-0' || id === 'nvme-1') return `<div class="inspector-section-label">${skillCount} SKILLS / KNOWLEDGE IS NON-VOLATILE</div>${allSkills()}`;
    if (id === 'io') return `<div class="inspector-contact-intro">${availability()}<p>A question, a collaboration, or a good idea.<br>Every connection starts with a hello.</p></div>${contactLinks(true)}`;
    return `${foundationStats()}<div class="inspector-note"><span class="micro-label">THE OPERATING PRINCIPLE</span><p>Building intelligent systems.<br>Making complex feel simple.</p></div><dl class="system-spec"><div><dt>ARCHITECT</dt><dd>${escapeHTML(identity.name)}</dd></div><div><dt>BASED IN</dt><dd>${escapeHTML(identity.location)}</dd></div><div><dt>FIRST BOOT</dt><dd>${escapeHTML(identity.since)}</dd></div><div><dt>PRIMARY FOCUS</dt><dd>Python, Machine Learning & Full-Stack Development</dd></div><div><dt>STATUS</dt><dd>${escapeHTML(identity.availability)}</dd></div></dl><div class="inspector-note"><p>${escapeHTML(id === 'pch' ? chapters[5].description : chapters[1].description)}</p></div><button class="inspect-link" type="button" data-action="inspector-tab" data-tab="bio">${icon('plus')}Read the full biography${icon('chevron')}</button>`;
  }

  function selectInspectorTab(tab: InspectorTab, focus = false): void {
    if (!inspectorId || !inspectorTabs.some((item) => item.id === tab)) return;
    inspectorTab = tab;
    inspectorTabButtons.forEach((button) => {
      const selected = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    inspectorBody.setAttribute('aria-labelledby', `inspector-tab-${tab}`);
    inspectorBody.innerHTML = inspectorContent(inspectorId, tab);
    inspectorScroll.scrollTop = 0;
    if (focus) inspectorTabButtons.find((button) => button.dataset.tab === tab)?.focus({ preventScroll: true });
  }

  function openInspector(id: HardwareId): void {
    if (disposed || !Object.prototype.hasOwnProperty.call(hardware, id)) return;
    if (inspectorId === id && inspector.open) return;
    const wasOpen = inspector.open;
    if (!wasOpen) restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inspectorId = id;
    inspectorTitle.textContent = hardware[id].title;
    inspectorDescription.textContent = hardware[id].description;
    inspectorIndex.textContent = hardware[id].index;
    inspectorHardware.textContent = hardware[id].label;
    selectInspectorTab('overview');
    root.classList.add('is-inspecting');
    document.documentElement.classList.add('pplo-dialog-open');
    if (!wasOpen) {
      if (typeof inspector.showModal === 'function' && root.isConnected) inspector.showModal();
      else {
        inspector.setAttribute('open', '');
        inspector.setAttribute('data-dialog-fallback', '');
      }
    }
    inspectorClose.focus({ preventScroll: true });
  }

  function closeInspector(): void {
    if (!inspectorId && !inspector.open) return;
    inspectorId = null;
    if (typeof inspector.close === 'function' && inspector.open && !inspector.hasAttribute('data-dialog-fallback')) inspector.close();
    else inspector.removeAttribute('open');
    inspector.removeAttribute('data-dialog-fallback');
    root.classList.remove('is-inspecting');
    document.documentElement.classList.remove('pplo-dialog-open');
    if (restoreFocus?.isConnected && !restoreFocus.closest('[inert], [hidden]')) restoreFocus.focus({ preventScroll: true });
    else if (isReady) (failed ? fallback : orbit ? orbitButton : dockButtons[activeChapter]).focus({ preventScroll: true });
    restoreFocus = null;
  }

  function requestCloseInspector(): void {
    if (!inspectorId && !inspector.open) return;
    closeInspector();
    actions.onCloseInspector();
  }

  function navigate(progress: number): void {
    const destination = clamp(progress);
    if (inspector.open) requestCloseInspector();
    if (orbit && !failed) actions.onToggleOrbit();
    actions.onNavigate(destination);
    if (failed) {
      const index = chapters.findIndex((chapter, chapterIndex) => destination >= chapter.range[0] && (destination < chapter.range[1] || chapterIndex === chapters.length - 1));
      const target = fallback.querySelector<HTMLElement>(`[data-static-chapter="${Math.max(0, index)}"]`);
      target?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    }
  }

  function requestOrbit(): void {
    if (failed || !isReady) return;
    if (inspector.open) requestCloseInspector();
    actions.onToggleOrbit();
  }

  function handleClick(event: MouseEvent): void {
    if (disposed || !(event.target instanceof Element)) return;
    if (event.target === inspector) {
      const bounds = inspector.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestCloseInspector();
      return;
    }
    const control = event.target.closest<HTMLElement>('[data-action]');
    if (!control || !root.contains(control) || control.closest('[inert]') || control.matches(':disabled')) return;
    const action = control.dataset.action;
    if (action === 'navigate') navigate(Number(control.dataset.progress));
    else if (action === 'orbit') requestOrbit();
    else if (action === 'inspect') {
      const id = control.dataset.hardware as HardwareId;
      if (!Object.prototype.hasOwnProperty.call(hardware, id)) return;
      openInspector(id);
      actions.onInspect(id);
    } else if (action === 'close-inspector') requestCloseInspector();
    else if (action === 'memory-tab') navigate(ramTarget(Number(control.dataset.index)));
    else if (action === 'skill-tab') selectSkill(Number(control.dataset.index));
    else if (action === 'inspector-tab') selectInspectorTab(control.dataset.tab as InspectorTab);
    else if (action === 'focus-story') (failed ? fallback : orbit ? orbitConsole : panels[activeChapter]).focus({ preventScroll: true });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disposed || event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof HTMLElement)) return;
    if (inspector.open && event.key === 'Escape') {
      event.preventDefault();
      requestCloseInspector();
      return;
    }
    if (inspector.open && event.key === 'Tab') {
      const focusable = Array.from(inspector.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), summary')).filter((item) => !item.closest('[hidden], [inert]') && item.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last && (event.shiftKey ? document.activeElement === first || !inspector.contains(document.activeElement) : document.activeElement === last || !inspector.contains(document.activeElement))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    const target = event.target.closest<HTMLElement>('[data-action]');
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (target && (direction || event.key === 'Home' || event.key === 'End')) {
      const action = target.dataset.action;
      if (action === 'skill-tab' || action === 'memory-tab' || action === 'inspector-tab' || target.hasAttribute('data-dock-chapter')) {
        event.preventDefault();
        const count = action === 'skill-tab' ? skillTabs.length : action === 'memory-tab' ? memoryTabs.length : action === 'inspector-tab' ? inspectorTabs.length : dockButtons.length;
        const current = action === 'skill-tab' ? activeSkill : action === 'memory-tab' ? Number(target.dataset.index) : action === 'inspector-tab' ? inspectorTabs.findIndex((tab) => tab.id === inspectorTab) : Number(target.dataset.dockChapter);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (current + direction + count) % count;
        if (action === 'skill-tab') selectSkill(next, true);
        else if (action === 'memory-tab') {
          navigate(ramTarget(next));
          memoryTabs[next].focus({ preventScroll: true });
        } else if (action === 'inspector-tab') selectInspectorTab(inspectorTabs[next].id, true);
        else {
          navigate(chapterTarget(next));
          dockButtons[next].focus({ preventScroll: true });
        }
        return;
      }
    }
    if (event.target.matches('input, textarea, select, [contenteditable="true"]') || event.target.closest('[contenteditable="true"]')) return;
    if (!inspector.open && event.key.toLowerCase() === 'o' && !event.repeat) {
      event.preventDefault();
      requestOrbit();
    } else if (!inspector.open && orbit && event.key === 'Escape') {
      event.preventDefault();
      requestOrbit();
    }
  }

  function update(state: InterfaceState): void {
    if (disposed || failed) return;
    const nextChapter = Math.round(clamp(state.chapter, 0, chapters.length - 1));
    if (nextChapter !== activeChapter) setChapter(nextChapter, true, !state.orbit);
    const nextRam = Math.round(clamp(state.ramIndex, 0, ramProjects.length - 1));
    if (nextRam !== activeRam) setRam(nextRam);
    if (state.orbit !== orbit) {
      stopPeel();
      orbit = state.orbit;
      root.classList.toggle('is-orbit', orbit);
      root.classList.toggle('orbit-mode', orbit);
      orbitButton.setAttribute('aria-pressed', String(orbit));
      orbitButton.setAttribute('aria-label', orbit ? 'Return to the guided story' : 'Enable free orbit to explore the motherboard');
      orbitLabel.textContent = orbit ? 'BACK TO STORY' : 'FREE ORBIT';
      orbitCaption.textContent = orbit ? 'DRAG TO ORBIT / SELECT TO INSPECT' : 'TAKE THE SYSTEM FOR A SPIN';
      systemStatus.textContent = orbit ? 'MANUAL ORBIT' : isReady ? 'SYSTEM ONLINE' : 'SYSTEM INITIALIZING';
      setVisibility();
      if (orbit && panels.some((panel) => panel.contains(document.activeElement))) orbitButton.focus({ preventScroll: true });
      if (!orbit && orbitConsole.contains(document.activeElement)) orbitButton.focus({ preventScroll: true });
      if (isReady) announcer.textContent = orbit ? 'Free orbit enabled. Drag to explore. Select a component to inspect. Press Escape to return.' : `Guided story. Chapter ${activeChapter + 1}. ${chapters[activeChapter].title}`;
    }
    if (state.hovered !== hovered) {
      hovered = state.hovered;
      componentButtons.forEach((button) => button.classList.toggle('is-highlighted', button.dataset.part === hovered));
    }
    setProgress(state.progress);
    // Numeric telemetry is sampled, not rebuilt at animation-frame frequency.
    const now = performance.now();
    if (now - lastTelemetryTime >= 160 || !lastFocal) {
      lastTelemetryTime = now;
      const nextFocal = Number.isFinite(state.focalLength) && state.focalLength > 0 ? state.focalLength.toFixed(0) : '—';
      const nextFps = Number.isFinite(state.fps) && state.fps > 0 ? String(Math.round(state.fps)).padStart(2, '0') : '—';
      if (nextFocal !== lastFocal) { focal.textContent = nextFocal; lastFocal = nextFocal; }
      if (nextFps !== lastFps) { fps.textContent = nextFps; lastFps = nextFps; }
    }
  }

  function boot(progress: number, message: string): void {
    if (disposed || isReady || failed) return;
    const percentage = Math.round(clamp(progress) * 100);
    if (percentage !== lastBootProgress) {
      lastBootProgress = percentage;
      bootPercent.textContent = String(percentage).padStart(3, '0');
      bootProgress.setAttribute('aria-valuenow', String(percentage));
      bootFill.style.transform = `scaleX(${percentage / 100})`;
      bootStages.forEach((stage, index) => stage.classList.toggle('is-lit', percentage >= [0, 30, 75][index]));
    }
    if (message && message !== lastBootMessage) { bootMessage.textContent = message; lastBootMessage = message; }
  }

  function ready(): void {
    if (disposed || isReady || failed) return;
    boot(1, 'System online. A little curiosity goes a long way.');
    isReady = true;
    root.classList.remove('is-booting');
    root.classList.add('is-ready');
    loader.setAttribute('aria-hidden', 'true');
    loader.inert = true;
    readyTimer = setTimeout(() => { loader.hidden = true; }, reducedMotion.matches ? 0 : 700);
    systemStatus.textContent = orbit ? 'MANUAL ORBIT' : 'SYSTEM ONLINE';
    setVisibility();
    announcer.textContent = 'The system is online. Scroll to explore seven chapters, or enable free orbit.';
  }

  function syncFallbackScroll(): void {
    fallbackFrame = 0;
    if (!failed || disposed) return;
    const maxScroll = fallback.scrollHeight - fallback.clientHeight;
    setProgress(maxScroll > 0 ? fallback.scrollTop / maxScroll : 0);
    const top = fallback.getBoundingClientRect().top;
    let next = 0;
    fallback.querySelectorAll<HTMLElement>('[data-static-chapter]').forEach((section) => {
      if (section.getBoundingClientRect().top - top <= Math.min(180, fallback.clientHeight * 0.3)) next = Number(section.dataset.staticChapter);
    });
    if (next !== activeChapter) setChapter(next, false);
  }

  function error(message: string): void {
    if (disposed) return;
    if (!failed) {
      failed = true;
      isReady = true;
      orbit = false;
      clearTimeout(readyTimer);
      stopPeel();
      loader.remove();
      if (inspector.open) requestCloseInspector();
      root.classList.remove('is-booting', 'is-orbit', 'orbit-mode');
      root.classList.add('is-ready', 'is-fallback');
      document.documentElement.classList.add('pplo-static-mode');
      fallback.innerHTML = staticPortfolio();
      fallback.hidden = false;
      fallback.querySelectorAll<HTMLElement>('[data-static-chapter]').forEach((section) => { section.tabIndex = -1; });
      orbitButton.disabled = true;
      projectionSvg.style.display = 'none';
      projectionLabels.style.display = 'none';
      focal.textContent = '—';
      fps.textContent = '—';
      systemStatus.textContent = 'STATIC EDITION / ONLINE';
      setChapter(0, false);
      setProgress(0);
      fallback.addEventListener('scroll', () => {
        if (!fallbackFrame) fallbackFrame = requestAnimationFrame(syncFallbackScroll);
      }, { passive: true, signal });
      announcer.textContent = '3D rendering is unavailable. The complete portfolio is available in the static edition.';
      fallback.focus({ preventScroll: true });
    }
    const report = fallback.querySelector<HTMLElement>('[data-ref="fallback-error"]');
    if (report) report.textContent = message || 'A WebGL rendering context could not be initialized on this device.';
  }

  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopPeel(); }, { signal });
  root.addEventListener('click', handleClick, { signal });
  document.addEventListener('keydown', handleKeydown, { signal });
  inspector.addEventListener('cancel', (event) => { event.preventDefault(); requestCloseInspector(); }, { signal });
  inspector.addEventListener('close', () => { if (inspectorId && !inspector.open) requestCloseInspector(); }, { signal });
  setVisibility();

  return {
    projectionSvg,
    projectionLabels,
    update,
    boot,
    ready,
    openInspector,
    closeInspector,
    error,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      clearTimeout(readyTimer);
      stopPeel();
      cancelAnimationFrame(fallbackFrame);
      closeInspector();
      document.documentElement.classList.remove('pplo-dialog-open', 'pplo-static-mode');
      root.classList.remove('portfolio-interface', 'is-booting', 'is-ready', 'is-orbit', 'orbit-mode', 'is-inspecting', 'is-fallback');
      delete root.dataset.chapter;
      root.style.removeProperty('--panel-drift');
      root.replaceChildren();
    },
  };
}
