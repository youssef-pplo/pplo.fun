import type * as THREE from 'three';

export type HardwareId = 'pcb' | 'cpu' | 'gpu' | 'ram-0' | 'ram-1' | 'ram-2' | 'ram-3' | 'nvme-0' | 'nvme-1' | 'pch' | 'io';

export interface HardwarePart {
  id: HardwareId;
  group: THREE.Group;
  anchor: THREE.Object3D;
  meshes: THREE.Object3D[];
}

export interface HardwareRig {
  group: THREE.Group;
  components: Map<HardwareId, HardwarePart>;
  anchors: Map<string, THREE.Object3D>;
  pickables: THREE.Object3D[];
  update: (progress: number, time: number, delta: number, highlighted: HardwareId | null, reducedMotion: boolean) => void;
  dispose: () => void;
}

export interface PortfolioProject {
  id: string;
  title: string;
  shortTitle: string;
  index: string;
  hardware: HardwareId;
  category: string;
  description: string;
  tech: readonly string[];
  url: string;
  spec: string;
  role: string;
}

export interface Chapter {
  id: string;
  short: string;
  title: string;
  eyebrow: string;
  description: string;
  range: readonly [number, number];
  hardware: HardwareId | null;
}

export interface InterfaceActions {
  onNavigate: (progress: number) => void;
  onToggleOrbit: () => void;
  onInspect: (id: HardwareId) => void;
  onCloseInspector: () => void;
}

export interface InterfaceState {
  progress: number;
  chapter: number;
  orbit: boolean;
  ramIndex: number;
  focalLength: number;
  fps: number;
  power: number;
  hovered: HardwareId | null;
}

export interface InterfaceController {
  projectionSvg: SVGSVGElement;
  projectionLabels: HTMLElement;
  update: (state: InterfaceState) => void;
  boot: (progress: number, message: string) => void;
  ready: () => void;
  openInspector: (id: HardwareId) => void;
  closeInspector: () => void;
  error: (message: string) => void;
  dispose: () => void;
}
