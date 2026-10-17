import * as THREE from 'three';
import type { HardwareId, HardwareRig } from '../types';
import type { EnvironmentRig } from './environment';
import { getRamIndex, powerAt } from './choreography';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

type Copy = { title: string; detail: string };
const hardwareCopy: Record<HardwareId, Copy> = {
  pcb: { title: 'PPLO—Z990 / FOUNDATION', detail: '50 Ω // 0.12mm TRACE WIDTH' },
  cpu: { title: 'CORE_ID / YOUSSEF ELSAID', detail: 'AI ARCHITECT // 1.24V' },
  gpu: { title: 'PPLO-RTX / NEURAL ENGINE', detail: 'I3RBLY + PPLO-GPT // TENSOR CORES' },
  'ram-0': { title: 'STEAM1ST STORE', detail: 'DIMM_A1 // 32GB // 6400 MT/s' },
  'ram-1': { title: 'ALCODERS', detail: 'DIMM_A2 // 32GB // 6400 MT/s' },
  'ram-2': { title: 'EASYBIO / DR. ABDELRAHMAN', detail: 'DIMM_B1 // 32GB // 6400 MT/s' },
  'ram-3': { title: 'KOTOBEE', detail: 'DIMM_B2 // 32GB // 6400 MT/s' },
  'nvme-0': { title: 'NVME_01 / AI & ML', detail: 'PYTORCH // TENSORFLOW // PYTHON' },
  'nvme-1': { title: 'NVME_02 / FULL STACK', detail: 'LANGUAGES // TOOLS // SYSTEMS' },
  pch: { title: 'PCH / CONNECTED THINKING', detail: 'DEVOPS // MOBILE // CREATIVE' },
  io: { title: 'I/O / OPEN CONNECTIONS', detail: 'ONLINE // AVAILABLE FOR HIRE' },
};

interface Callout {
  node: SVGGElement;
  leader: SVGPolylineElement;
  reticle: SVGPathElement;
  dot: SVGCircleElement;
  label: HTMLDivElement;
  title: HTMLElement;
  detail: HTMLElement;
  lastCopy: string;
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function isWorldVisible(object: THREE.Object3D): boolean {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor) {
    if (!ancestor.visible) return false;
    ancestor = ancestor.parent;
  }
  return true;
}

/** Every line endpoint is derived from a world anchor after the final camera update. */
export class ProjectionEngine {
  private readonly pool: Callout[] = [];
  private readonly position = new THREE.Vector3();
  private readonly ndc = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly projectedFrom = new THREE.Vector3();
  private readonly projectedTo = new THREE.Vector3();
  private readonly measure: SVGGElement;
  private readonly measureLine: SVGPathElement;
  private readonly measureLabel: HTMLDivElement;
  private width = 1;
  private height = 1;
  private portrait = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly hardware: HardwareRig,
    private readonly environment: EnvironmentRig,
    private readonly svg: SVGSVGElement,
    labels: HTMLElement,
  ) {
    for (let i = 0; i < 3; i += 1) {
      const node = svgElement('g');
      const leader = svgElement('polyline', { opacity: i === 0 ? '0.52' : '0.28' });
      const reticle = svgElement('path', { opacity: '0.65' });
      const dot = svgElement('circle', { r: '2.1', fill: '#d3ff65', stroke: 'none' });
      node.append(leader, reticle, dot);
      svg.append(node);
      const label = document.createElement('div');
      label.className = 'component-label';
      const title = document.createElement('strong');
      title.style.cssText = 'display:block;font-size:8px;letter-spacing:.04em;white-space:nowrap';
      const detail = document.createElement('span');
      detail.style.cssText = 'display:block;font-size:6px;letter-spacing:.03em;margin-top:4px;color:#a7b0a3';
      label.append(title, detail);
      labels.append(label);
      this.pool.push({ node, leader, reticle, dot, label, title, detail, lastCopy: '' });
    }
    this.measure = svgElement('g', { opacity: '0.35' });
    this.measureLine = svgElement('path', { 'stroke-dasharray': '2 4' });
    this.measure.append(this.measureLine);
    svg.append(this.measure);
    this.measureLabel = document.createElement('div');
    this.measureLabel.style.cssText = 'padding:3px 6px;background:#080b0cbb;font-size:7px;color:#a7b39d;letter-spacing:.06em;white-space:nowrap';
    labels.append(this.measureLabel);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.portrait = width <= 760;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  private getAnchor(name: string): THREE.Object3D | undefined {
    return this.hardware.anchors.get(name) ?? this.environment.anchors.get(name);
  }

  private project(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(world).project(this.camera);
    out.x = (out.x * 0.5 + 0.5) * this.width;
    out.y = (-out.y * 0.5 + 0.5) * this.height;
    return out;
  }

  private hide(index: number): void {
    this.pool[index].node.style.display = 'none';
    this.pool[index].label.style.display = 'none';
  }

  private show(index: number, anchorName: string, copy: Copy, offsetY: number): void {
    const anchor = this.getAnchor(anchorName);
    if (!anchor || !isWorldVisible(anchor) || (this.portrait && index > 0)) { this.hide(index); return; }
    anchor.getWorldPosition(this.position);
    this.ndc.copy(this.position).project(this.camera);
    if (this.ndc.z < -1 || this.ndc.z > 1 || Math.abs(this.ndc.x) > 1.2 || Math.abs(this.ndc.y) > 1.2) { this.hide(index); return; }
    const x = (this.ndc.x * 0.5 + 0.5) * this.width;
    const y = (-this.ndc.y * 0.5 + 0.5) * this.height;
    const callout = this.pool[index];
    callout.node.style.display = '';
    callout.label.style.display = '';
    const minimumX = this.portrait ? 16 : this.width * 0.53;
    const labelX = clamp(x + (index === 1 ? -160 : 34), minimumX, this.width - (this.portrait ? 202 : 218));
    const minimumY = this.portrait ? this.height * 0.57 : 170;
    const maximumY = this.portrait ? this.height - 230 : this.height - 255;
    const labelY = clamp(y + offsetY, minimumY, Math.max(minimumY, maximumY));
    callout.label.style.transform = `translate3d(${labelX.toFixed(1)}px,${labelY.toFixed(1)}px,0)`;
    const endX = labelX;
    const endY = labelY + 21;
    const bendX = endX > x ? Math.min(endX - 12, x + 26) : Math.max(endX + 12, x - 26);
    callout.leader.setAttribute('points', `${x.toFixed(1)},${y.toFixed(1)} ${bendX.toFixed(1)},${endY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`);
    callout.dot.setAttribute('cx', x.toFixed(1));
    callout.dot.setAttribute('cy', y.toFixed(1));
    const r = index === 0 ? 10 : 6;
    const arm = 3;
    callout.reticle.setAttribute('d', `M${x-r},${y-r+arm}v-${arm}h${arm} M${x+r-arm},${y-r}h${arm}v${arm} M${x+r},${y+r-arm}v${arm}h-${arm} M${x-r+arm},${y+r}h-${arm}v-${arm}`);
    const nextCopy = `${copy.title}|${copy.detail}`;
    if (callout.lastCopy !== nextCopy) {
      callout.title.textContent = copy.title;
      callout.detail.textContent = copy.detail;
      callout.lastCopy = nextCopy;
    }
  }

  update(progress: number, chapter: number, orbit: boolean, highlighted: HardwareId | null): void {
    this.pool.forEach((_, index) => this.hide(index));
    if (orbit) {
      if (highlighted) this.show(0, highlighted, hardwareCopy[highlighted], -70);
      else {
        this.show(0, 'cpu', hardwareCopy.cpu, -100);
        this.show(1, 'io', hardwareCopy.io, -35);
      }
    } else if (chapter === 0) {
      this.show(0, 'construct-core', { title: 'KERNEL: PPLO-v2026', detail: 'SYS.BOOT // ALEXANDRIA_EG' }, -80);
      this.show(1, 'construct-bracket', { title: '01 / THE FIRST INSTRUCTION', detail: '{ CURIOSITY: INFINITE }' }, 80);
    } else {
      const id: HardwareId = highlighted ?? (chapter === 1 ? 'pcb' : chapter === 2 ? 'cpu' : chapter === 3 ? 'gpu' : chapter === 4 ? `ram-${getRamIndex(progress)}` as HardwareId : chapter === 5 ? (progress > 0.87 ? 'nvme-1' : 'nvme-0') : 'io');
      this.show(0, id, hardwareCopy[id], -90);
      if (chapter === 1) this.show(1, 'power', { title: powerAt(progress) > 0.95 ? 'BUS_PWR: ONLINE' : 'BUS_PWR: INITIALIZING', detail: `${(powerAt(progress) * 12).toFixed(1)}V RAIL // TRACE IMPEDANCE: 50 Ω` }, 65);
      else if (chapter === 3) this.show(1, 'cpu', { title: 'NEURAL LINK / PCIe x16', detail: 'NLP & DEEP LEARNING // 4 YEARS R&D' }, -60);
      else if (chapter === 5) this.show(1, 'pch', hardwareCopy.pch, 50);
      else if (chapter === 6) this.show(1, 'gpu', { title: 'ALL SYSTEMS / CONNECTED', detail: 'PROCEDURAL ARCHITECTURE // NO. 001' }, 50);
    }
    this.updateMeasurement(chapter, orbit);
  }

  private updateMeasurement(chapter: number, orbit: boolean): void {
    this.measure.style.display = 'none';
    this.measureLabel.style.display = 'none';
    if (this.portrait) return;
    let title: string;
    if (chapter === 0 && !orbit) {
      const a = this.getAnchor('construct-core');
      const b = this.getAnchor('construct-bracket');
      if (!a || !b || !isWorldVisible(a)) return;
      a.getWorldPosition(this.from);
      b.getWorldPosition(this.to);
      title = `${this.from.distanceTo(this.to).toFixed(2)}m / WORLD SPACE`;
    } else if (chapter === 2 && !orbit) {
      const cpu = this.hardware.components.get('cpu');
      if (!cpu || !isWorldVisible(cpu.group)) return;
      this.from.set(-0.86, 0.20, 0.82).applyMatrix4(cpu.group.matrixWorld);
      this.to.set(0.86, 0.20, 0.82).applyMatrix4(cpu.group.matrixWorld);
      title = '45.0 × 37.5mm // LGA—PPLO';
    } else {
      const a = this.getAnchor('corner-sw');
      const b = this.getAnchor('corner-se');
      if (!a || !b || !isWorldVisible(a)) return;
      a.getWorldPosition(this.from);
      b.getWorldPosition(this.to);
      title = `${(this.from.distanceTo(this.to) / 3).toFixed(2)}m // ARCHITECTURAL SCALE`;
    }
    this.project(this.from, this.projectedFrom);
    this.project(this.to, this.projectedTo);
    const a = this.projectedFrom;
    const b = this.projectedTo;
    if (a.z > 1 || b.z > 1 || a.x < this.width * 0.42 || b.x < this.width * 0.42 || a.y > this.height - 150 || b.y > this.height - 150) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 10) return;
    const nx = -dy / length * 6;
    const ny = dx / length * 6;
    this.measureLine.setAttribute('d', `M${a.x},${a.y}L${b.x},${b.y} M${a.x-nx},${a.y-ny}L${a.x+nx},${a.y+ny} M${b.x-nx},${b.y-ny}L${b.x+nx},${b.y+ny}`);
    this.measureLabel.textContent = title;
    this.measureLabel.style.transform = `translate3d(${((a.x + b.x) / 2).toFixed(1)}px,${((a.y + b.y) / 2 + 9).toFixed(1)}px,0) translateX(-50%)`;
    this.measure.style.display = '';
    this.measureLabel.style.display = '';
  }

  dispose(): void {
    this.pool.forEach((callout) => { callout.node.remove(); callout.label.remove(); });
    this.measure.remove();
    this.measureLabel.remove();
    this.pool.length = 0;
  }
}
