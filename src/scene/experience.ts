import * as THREE from 'three';
import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { chapters } from '../data';
import type { HardwareId, HardwareRig, InterfaceController } from '../types';
import { createHardware } from './hardware';
import { createEnvironment } from './environment';
import type { EnvironmentRig } from './environment';
import { CameraChoreography, clamp01, createCameraPose, getChapterIndex, getRamIndex, isPortraitLayout, powerAt } from './choreography';
import { ProjectionEngine } from './projection';

gsap.registerPlugin(ScrollTrigger);

export interface ExperienceSnapshot {
  progress: number;
  chapter: number;
  orbit: boolean;
  selected: HardwareId | null;
  hovered: HardwareId | null;
  camera: { position: number[]; target: number[]; focalLength: number };
  hardware: { id: HardwareId; visible: boolean; position: number[]; screen: { x: number; y: number; visible: boolean } }[];
  metrics: { calls: number; triangles: number; pixelRatio: number; fps: number };
}

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const isVisible = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object;
  while (current) { if (!current.visible) return false; current = current.parent; }
  return true;
};

export class PortfolioExperience {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.08, 180);
  private readonly path = new CameraChoreography();
  private readonly pose = createCameraPose();
  private readonly currentTarget = new THREE.Vector3();
  private readonly targetPosition = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(-10, -10);
  private readonly mouse = new THREE.Vector2();
  private readonly dampedMouse = new THREE.Vector2();
  private readonly down = new THREE.Vector2();
  private readonly orbitFrom = new THREE.Vector3();
  private readonly targetFrom = new THREE.Vector3();
  private readonly orbitPosition = new THREE.Vector3(12.0, 13.0, 15.0);
  private readonly orbitTarget = new THREE.Vector3(0, 0.45, 0);
  private readonly blend = { value: 1 };
  private readonly events = new AbortController();
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly scrollStory: HTMLElement;
  private readonly story = { progress: 0 };
  private readonly metrics = { calls: 0, triangles: 0, pixelRatio: 1, fps: 0 };
  private hardware!: HardwareRig;
  private environment!: EnvironmentRig;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private output!: OutputPass;
  private controls!: OrbitControls;
  private projection!: ProjectionEngine;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private lenis: Lenis | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private trigger: ScrollTrigger | null = null;
  private orbitTween: gsap.core.Tween | null = null;
  private panelObserver: ResizeObserver | null = null;
  private width = window.innerWidth;
  private height = window.innerHeight;
  private portrait = isPortraitLayout(this.width, this.height);
  private reducedMotion = this.motionQuery.matches;
  private orbit = false;
  private selected: HardwareId | null = null;
  private hovered: HardwareId | null = null;
  private pointerOverCanvas = false;
  private pointerDown = false;
  private lastPickTime = 0;
  private lastShadowProgress = -1;
  private lastLens = 0;
  private lastFrame = performance.now();
  private sampleStart = this.lastFrame;
  private qualityStartedAt = this.lastFrame;
  private sampleFrames = 0;
  private slowSamples = 0;
  private fastSamples = 0;
  private elapsed = 0;
  private initialized = false;
  private disposed = false;
  private failed = false;
  private pendingResize = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ui: InterfaceController) {
    const story = document.getElementById('scroll-story');
    if (!story) throw new Error('The native scroll story container is missing.');
    this.scrollStory = story;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.info.autoReset = false;
    this.metrics.pixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
    this.scene.background = new THREE.Color('#080b0c');
    this.scene.fog = new THREE.FogExp2('#080b0c', 0.016);
    this.camera.filmGauge = 35;
    this.camera.position.copy(this.orbitPosition);
    this.camera.lookAt(0, 1, 0);
  }

  async initialize(): Promise<void> {
    this.ui.boot(0.16, 'Establishing a world. Calibrating the lens.');
    await nextFrame();
    await Promise.race([
      document.fonts?.ready,
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);
    this.setLighting();
    this.environment = createEnvironment();
    this.scene.add(this.environment.group);
    this.ui.boot(0.30, 'Etching 14 hardware surfaces. No models to download.');
    await nextFrame();
    this.hardware = createHardware(this.renderer);
    this.scene.add(this.hardware.group);
    this.ui.boot(0.61, 'Routing copper. Connecting 3,870 instanced details.');
    await nextFrame();
    this.setPostProcessing();
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 38;
    this.controls.minPolarAngle = 0.10;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.65;
    this.controls.target.copy(this.orbitTarget);
    this.canvas.style.touchAction = 'pan-y';
    this.projection = new ProjectionEngine(this.camera, this.hardware, this.environment, this.ui.projectionSvg, this.ui.projectionLabels);
    this.resize();
    this.ui.boot(0.77, 'Compiling light, shadows, and electrical pulse shaders.');
    this.hardware.update(1, 0, 0, null, true);
    this.environment.update(0, 0, this.camera, false, true, this.metrics.pixelRatio);
    let compilationTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.renderer.compileAsync(this.scene, this.camera),
        new Promise<never>((_, reject) => { compilationTimeout = setTimeout(() => reject(new Error('The graphics driver took too long to compile this scene. Try a hardware-accelerated browser.')), 25_000); }),
      ]);
    } finally { clearTimeout(compilationTimeout); }
    if (this.disposed) return;
    this.ui.boot(0.94, 'Mapping seven chapters. Bringing the system online.');
    this.createScroller();
    this.bindEvents();
    this.initialized = true;
    this.lastFrame = this.sampleStart = this.qualityStartedAt = performance.now();
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(this.tick);
    this.frame(0);
    await nextFrame();
    this.canvas.dataset.ready = 'true';
    document.documentElement.dataset.renderer = 'ready';
  }

  private setLighting(): void {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.62;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#dde8df', '#263027', 2.0));
    const key = new THREE.DirectionalLight('#f6f3df', 4.2);
    key.position.set(-4, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(this.portrait ? 1024 : 2048, this.portrait ? 1024 : 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -7;
    key.shadow.camera.right = key.shadow.camera.top = 7;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 35;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#bfe48e', 3.0);
    rim.position.set(4, 5, -7);
    this.scene.add(rim);
    const softbox = new THREE.DirectionalLight('#a8d6e2', 1.55);
    softbox.position.set(-8, 3, -2);
    this.scene.add(softbox);
    const fill = new THREE.PointLight('#d3ff65', 16, 13, 2);
    fill.position.set(3, 1, 4);
    this.scene.add(fill);
    const cyan = new THREE.PointLight('#55cadb', 10, 12, 2);
    cyan.position.set(-4, 1, 2);
    this.scene.add(cyan);
  }

  private setPostProcessing(): void {
    const target = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: this.renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.samples = Math.min(2, this.renderer.capabilities.maxSamples);
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomWidth = Math.max(128, Math.round(this.width * this.metrics.pixelRatio * 0.5));
    const bloomHeight = Math.max(128, Math.round(this.height * this.metrics.pixelRatio * 0.5));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(bloomWidth, bloomHeight), 0.32, 0.38, 1.05);
    this.output = new OutputPass();
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
  }

  private createScroller(): void {
    this.lenis?.destroy();
    this.lenis = new Lenis({
      duration: this.reducedMotion ? 0 : 1.12,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !this.reducedMotion,
      syncTouch: false,
      touchMultiplier: 1.2,
      wheelMultiplier: 0.9,
    });
    this.lenis.on('scroll', ScrollTrigger.update);
    this.watchPanelOverflow();
    if (!this.timeline) this.timeline = gsap.timeline({ paused: true }).to(this.story, { progress: 1, duration: 1, ease: 'none' });
    this.trigger?.kill(false, true);
    ScrollTrigger.config({ ignoreMobileResize: true });
    this.trigger = ScrollTrigger.create({
      animation: this.timeline,
      trigger: this.scrollStory,
      start: 'top top',
      end: 'bottom bottom',
      scrub: this.reducedMotion ? true : 1.2,
      invalidateOnRefresh: true,
    });
    ScrollTrigger.refresh();
    if (this.orbit || this.selected) this.lenis.stop();
  }

  /**
   * Lenis ignores wheel events over `[data-lenis-prevent]`. Only panels that genuinely overflow need
   * that: a panel that fits must let the wheel drive the story, wherever the pointer is.
   */
  private watchPanelOverflow(): void {
    this.panelObserver?.disconnect();
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel-scroll'));
    const sync = (): void => panels.forEach((panel) => {
      const overflows = panel.scrollHeight - panel.clientHeight > 1;
      if (overflows) panel.setAttribute('data-lenis-prevent', '');
      else panel.removeAttribute('data-lenis-prevent');
    });
    this.panelObserver = new ResizeObserver(sync);
    panels.forEach((panel) => { this.panelObserver?.observe(panel); Array.from(panel.children).forEach((child) => this.panelObserver?.observe(child)); });
    sync();
  }

  private bindEvents(): void {
    const { signal } = this.events;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(this.pendingResize);
      this.pendingResize = requestAnimationFrame(() => { this.resize(); this.lenis?.resize(); ScrollTrigger.refresh(); });
    }, { passive: true, signal });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true, signal });
    this.canvas.addEventListener('pointerdown', (event) => {
      this.pointerDown = true;
      this.down.set(event.clientX, event.clientY);
    }, { passive: true, signal });
    window.addEventListener('pointerup', (event) => {
      const wasDown = this.pointerDown;
      this.pointerDown = false;
      if (!wasDown || this.selected || event.target !== this.canvas || this.down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 6) return;
      this.setPointer(event);
      const part = this.pick();
      if (part) this.inspect(part);
    }, { passive: true, signal });
    window.addEventListener('pointercancel', () => { this.pointerDown = false; }, { passive: true, signal });
    document.addEventListener('pointerleave', () => { this.pointerOverCanvas = false; this.hovered = null; this.mouse.set(0, 0); }, { signal });
    document.addEventListener('keydown', (event) => {
      if (this.orbit && !this.selected && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key) && !(event.target instanceof Element && event.target.closest('button,a,input,textarea,[role="tab"]'))) event.preventDefault();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      this.lastFrame = this.sampleStart = performance.now();
      this.sampleFrames = 0;
    }, { signal });
    this.motionQuery.addEventListener('change', (event) => {
      this.reducedMotion = event.matches;
      this.dampedMouse.set(0, 0);
      this.createScroller();
      this.orbitTween?.progress(1);
    }, { signal });
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.fail('The graphics context was interrupted. Your complete portfolio is still available in the static edition; reload to try the 3D experience again.');
    }, { signal });
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerOverCanvas = event.target === this.canvas;
    this.setPointer(event);
    if (event.pointerType === 'mouse') this.mouse.set((event.clientX / this.width - 0.5) * 2, -(event.clientY / this.height - 0.5) * 2);
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-part]') : null;
    if (button && this.orbit) this.hovered = button.dataset.part as HardwareId;
    else if (!this.pointerOverCanvas) this.hovered = null;
  };

  private setPointer(event: PointerEvent): void {
    this.pointer.set(event.clientX / this.width * 2 - 1, -event.clientY / this.height * 2 + 1);
  }

  private pick(): HardwareId | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.hardware.pickables, false);
    return (intersections[0]?.object.userData.hardwareId as HardwareId | undefined) ?? null;
  }

  private readonly tick = (time: number): void => {
    if (this.disposed || this.failed || document.hidden) return;
    this.lenis?.raf(time * 1000);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += delta;
    try { this.frame(delta); }
    catch (error) { console.error('PPLO render interrupted:', error); this.fail(error instanceof Error ? error.message : 'The 3D scene was interrupted.'); return; }
    this.sampleFrames += 1;
    if (now - this.sampleStart > 1200) {
      this.metrics.fps = this.sampleFrames * 1000 / (now - this.sampleStart);
      this.sampleFrames = 0;
      this.sampleStart = now;
      this.adaptQuality();
    }
  };

  private frame(delta: number): void {
    const progress = clamp01(this.story.progress);
    const chapter = getChapterIndex(progress);
    const effectiveProgress = this.orbit ? 1 : progress;
    this.path.sample(progress, this.portrait, this.reducedMotion, this.pose);
    const clock = this.reducedMotion ? 0 : this.elapsed;
    if (this.orbit) {
      if (this.blend.value < 1) {
        this.camera.position.lerpVectors(this.orbitFrom, this.orbitPosition, this.blend.value);
        this.currentTarget.lerpVectors(this.targetFrom, this.orbitTarget, this.blend.value);
        this.controls.target.copy(this.currentTarget);
        this.camera.lookAt(this.currentTarget);
      } else {
        this.controls.update();
        this.currentTarget.copy(this.controls.target);
      }
      this.setLens(35 + (this.pose.focalLength - 35) * (1 - this.blend.value));
    } else {
      const damping = this.reducedMotion ? 1 : 1 - Math.exp(-3.4 * delta);
      this.dampedMouse.lerp(this.reducedMotion ? this.mouse.set(0, 0) : this.mouse, damping);
      this.targetPosition.copy(this.pose.position);
      this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      const parallax = this.portrait || this.reducedMotion ? 0 : 0.23;
      this.targetPosition.addScaledVector(this.right, this.dampedMouse.x * parallax);
      this.targetPosition.y += this.dampedMouse.y * parallax * 0.55 + Math.sin(clock * 0.42) * (this.reducedMotion ? 0 : 0.025);
      this.camera.position.lerpVectors(this.orbitFrom, this.targetPosition, this.blend.value);
      this.currentTarget.lerpVectors(this.targetFrom, this.pose.target, this.blend.value);
      this.camera.lookAt(this.currentTarget);
      this.setLens(this.pose.focalLength);
    }
    this.hardware.group.position.y = this.reducedMotion ? 0 : Math.sin(clock * 0.7) * 0.035;
    this.hardware.update(effectiveProgress, clock, delta, this.selected ?? this.hovered, this.reducedMotion);
    this.camera.updateMatrixWorld();
    this.environment.update(progress, clock, this.camera, this.orbit, this.reducedMotion, this.metrics.pixelRatio);
    if (this.pointerOverCanvas && !this.selected && !this.pointerDown && clock - this.lastPickTime > 0.05) {
      this.lastPickTime = clock;
      this.hovered = this.pick();
    }
    // Reduced-motion has no running scene clock, but pointer interaction still works.
    if (this.reducedMotion && this.pointerOverCanvas && !this.selected && !this.pointerDown) this.hovered = this.pick();
    this.canvas.style.cursor = this.selected ? '' : this.hovered ? 'pointer' : this.orbit ? this.pointerDown ? 'grabbing' : 'grab' : '';
    this.projection.update(effectiveProgress, this.orbit ? 6 : chapter, this.orbit, this.selected ?? this.hovered);
    const shadowProgress = this.orbit ? 1 : progress;
    if (Math.abs(shadowProgress - this.lastShadowProgress) > 0.0001) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowProgress = shadowProgress;
    }
    this.renderer.info.reset();
    this.composer.render(delta);
    this.metrics.calls = this.renderer.info.render.calls;
    this.metrics.triangles = this.renderer.info.render.triangles;
    this.ui.update({ progress, chapter, orbit: this.orbit, ramIndex: getRamIndex(progress), focalLength: this.camera.getFocalLength(), fps: this.metrics.fps, power: powerAt(effectiveProgress), hovered: this.hovered });
  }

  private setLens(focalLength: number): void {
    if (Math.abs(focalLength - this.lastLens) < 0.005) return;
    this.camera.setFocalLength(focalLength);
    this.lastLens = focalLength;
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.portrait = isPortraitLayout(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    const shiftX = this.portrait ? 0 : this.orbit ? 0.105 : 0.20;
    // Landscape: sit the stage a little lower so tall parts (RAM, GPU) clear the header rule.
    const shiftY = this.portrait ? this.orbit ? 0.10 : 0.205 : this.orbit ? 0.012 : 0.045;
    this.camera.setViewOffset(this.width, this.height, -this.width * shiftX, -this.height * shiftY, this.width, this.height);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.metrics.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.composer?.setPixelRatio(this.metrics.pixelRatio);
    this.composer?.setSize(this.width, this.height);
    const bloomWidth = Math.max(128, Math.round(this.width * this.metrics.pixelRatio * 0.5));
    const bloomHeight = Math.max(128, Math.round(this.height * this.metrics.pixelRatio * 0.5));
    this.bloom?.setSize(bloomWidth, bloomHeight);
    this.projection?.resize(this.width, this.height);
    if (this.portrait) this.orbitPosition.set(15.5, 16.5, 19.0);
    else this.orbitPosition.set(12.0, 13.0, 15.0);
    this.lastLens = 0;
    this.renderer.shadowMap.needsUpdate = true;
  }

  private adaptQuality(): void {
    // Give a generous warmup before quality adaptation: initial page loading and shader warmup must not downgrade quality.
    if (performance.now() - this.qualityStartedAt < 8000 || document.hidden) return;
    const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
    const minPixelRatio = (window.devicePixelRatio || 1) >= 2 ? 1.5 : 1.0;

    if (this.metrics.fps < 28) {
      this.slowSamples += 1;
      this.fastSamples = 0;
    } else if (this.metrics.fps >= 52) {
      this.fastSamples += 1;
      this.slowSamples = 0;
    } else {
      this.slowSamples = 0;
      this.fastSamples = 0;
    }

    if (this.slowSamples >= 3) {
      if (this.metrics.fps < 18 && this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { material.needsUpdate = true; });
        });
      }
      if (this.metrics.pixelRatio > minPixelRatio) {
        this.metrics.pixelRatio = Math.max(minPixelRatio, Number((this.metrics.pixelRatio - 0.25).toFixed(2)));
        this.resize();
        this.canvas.dataset.quality = 'adaptive';
      }
      this.slowSamples = 0;
    } else if (this.fastSamples >= 4 && this.metrics.pixelRatio < maxPixelRatio) {
      this.metrics.pixelRatio = Math.min(maxPixelRatio, Number((this.metrics.pixelRatio + 0.25).toFixed(2)));
      this.resize();
      this.fastSamples = 0;
    }
  }

  navigate(progress: number): void {
    if (!this.initialized || this.failed || this.disposed) return;
    if (this.selected) this.closeInspector();
    if (this.orbit) this.toggleOrbit();
    const p = clamp01(progress);
    const end = this.scrollStory.offsetTop + this.scrollStory.offsetHeight - this.height;
    const destination = Math.round(end * p);
    const alreadyThere = Math.abs(window.scrollY - destination) < 1;
    this.lenis?.scrollTo(destination, { duration: this.reducedMotion ? 0 : 1.55, immediate: this.reducedMotion || alreadyThere, force: true });
    const chapter = chapters[getChapterIndex(p)];
    history.replaceState(null, '', p === 0 ? `${location.pathname}${location.search}` : `#${chapter.id}`);
  }

  toggleOrbit(): void {
    if (!this.initialized || this.failed || this.disposed) return;
    this.closeInspector();
    this.orbitTween?.kill();
    this.orbitFrom.copy(this.camera.position);
    this.targetFrom.copy(this.currentTarget);
    this.orbit = !this.orbit;
    this.blend.value = this.reducedMotion ? 1 : 0;
    this.hovered = null;
    this.controls.enabled = false;
    this.canvas.style.touchAction = this.orbit ? 'none' : 'pan-y';
    this.resize();
    if (this.orbit) {
      this.lenis?.stop();
      this.controls.target.copy(this.orbitTarget);
      if (this.reducedMotion) {
        this.camera.position.copy(this.orbitPosition);
        this.currentTarget.copy(this.orbitTarget);
        this.camera.lookAt(this.currentTarget);
      }
      this.orbitTween = gsap.to(this.blend, { value: 1, duration: this.reducedMotion ? 0 : 0.85, ease: 'power3.inOut', onComplete: () => { if (this.orbit && !this.selected) this.controls.enabled = true; } });
    } else {
      this.lenis?.start();
      this.orbitTween = gsap.to(this.blend, { value: 1, duration: this.reducedMotion ? 0 : 0.8, ease: 'power3.inOut' });
    }
    // Make the mode and accessible component list available in the same input event.
    this.ui.update({ progress: this.story.progress, chapter: getChapterIndex(this.story.progress), orbit: this.orbit, ramIndex: getRamIndex(this.story.progress), focalLength: this.camera.getFocalLength(), fps: this.metrics.fps, power: 1, hovered: null });
  }

  inspect(id: HardwareId): void {
    if (this.failed || this.disposed || !this.hardware.components.has(id)) return;
    this.selected = id;
    this.hovered = id;
    this.lenis?.stop();
    this.controls.enabled = false;
    this.canvas.style.touchAction = 'pan-y';
    this.ui.openInspector(id);
  }

  closeInspector(): void {
    this.selected = null;
    this.hovered = null;
    this.ui.closeInspector();
    if (!this.orbit) {
      this.canvas.style.touchAction = 'pan-y';
      this.lenis?.start();
    } else if (this.blend.value === 1) {
      this.canvas.style.touchAction = 'none';
      this.controls.enabled = true;
    }
  }

  getState(): ExperienceSnapshot {
    const world = new THREE.Vector3();
    const projected = new THREE.Vector3();
    return {
      progress: clamp01(this.story.progress), chapter: getChapterIndex(this.story.progress), orbit: this.orbit, selected: this.selected, hovered: this.hovered,
      camera: { position: this.camera.position.toArray(), target: this.currentTarget.toArray(), focalLength: this.camera.getFocalLength() },
      hardware: [...this.hardware.components.values()].map((part) => {
        part.anchor.getWorldPosition(world);
        projected.copy(world).project(this.camera);
        return { id: part.id, visible: isVisible(part.group), position: part.group.position.toArray(), screen: { x: (projected.x * 0.5 + 0.5) * this.width, y: (-projected.y * 0.5 + 0.5) * this.height, visible: isVisible(part.group) && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 } };
      }),
      metrics: { ...this.metrics },
    };
  }

  private fail(message: string): void {
    if (this.failed || this.disposed) return;
    this.failed = true;
    this.canvas.dataset.ready = 'false';
    document.documentElement.dataset.renderer = 'fallback';
    this.dispose();
    this.ui.error(message);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.abort();
    cancelAnimationFrame(this.pendingResize);
    gsap.ticker.remove(this.tick);
    this.orbitTween?.kill();
    this.trigger?.kill();
    this.timeline?.kill();
    this.panelObserver?.disconnect();
    this.lenis?.destroy();
    this.controls?.dispose();
    this.projection?.dispose();
    this.hardware?.dispose();
    this.environment?.dispose();
    this.scene.traverse((object) => { if (object instanceof THREE.Light) object.dispose(); });
    this.scene.clear();
    this.scene.environment = null;
    this.envTarget?.dispose();
    this.bloom?.dispose();
    this.output?.dispose();
    this.composer?.passes.forEach((pass) => { if (pass !== this.bloom && pass !== this.output) pass.dispose(); });
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

export async function createExperience(canvas: HTMLCanvasElement, ui: InterfaceController): Promise<PortfolioExperience> {
  const experience = new PortfolioExperience(canvas, ui);
  try { await experience.initialize(); return experience; }
  catch (error) { experience.dispose(); throw error; }
}
