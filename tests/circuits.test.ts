import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { circuitRevealAt, createCircuitry, createPulseMaterial } from '../src/scene/circuits';
import type { CircuitRig } from '../src/scene/circuits';
import { createHardware } from '../src/scene/hardware';
import type { HardwareRig } from '../src/types';

// Only Canvas2D labels need a browser; geometry, materials, and assembly remain real Three objects.
vi.mock('../src/scene/labels', async () => {
  const { CanvasTexture } = await import('three');
  return {
    createHardwareLabelTexture: () => new CanvasTexture({ width: 16, height: 16 } as HTMLCanvasElement),
  };
});

type StandardMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
const renderer = {} as THREE.WebGLRenderer;
const rigs: (CircuitRig | HardwareRig)[] = [];
const epsilon = 1e-8;

function prepareShader(material: THREE.Material, kind: 'standard' | 'depth' | 'distanceRGBA' = 'standard') {
  const source = THREE.ShaderLib[kind];
  const shader = {
    uniforms: THREE.UniformsUtils.clone(source.uniforms),
    vertexShader: source.vertexShader,
    fragmentShader: source.fragmentShader,
  } as Parameters<THREE.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader, renderer);
  return shader;
}

function circuits() {
  const rig = createCircuitry();
  rigs.push(rig);
  const copper = rig.group.getObjectByName('45-degree copper buses') as StandardMesh;
  const signal = rig.group.getObjectByName('powered signal packets') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const vias = rig.group.getObjectByName('plated through-hole vias') as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const shader = prepareShader(copper.material);
  return { rig, copper, signal, vias, shader };
}

function hardware() {
  const rig = createHardware(renderer);
  rigs.push(rig);
  const core = rig.group.getObjectByName('PCB / exposed laminated core') as StandardMesh;
  const mask = rig.group.getObjectByName('PCB / precision solder mask') as StandardMesh;
  const details = rig.group.getObjectByName('PCB / seated surface components') as THREE.Group;
  const screws = rig.group.getObjectByName('PCB / captive nickel screws') as StandardMesh;
  const silk = rig.components.get('pcb')!.meshes.find((mesh) =>
    mesh instanceof THREE.Mesh && mesh.material.name === 'pcb / engraved pcb') as StandardMesh;
  const signal = rig.group.getObjectByName('powered signal packets') as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const shader = prepareShader(screws.material);
  return { rig, core, mask, details, screws, silk, signal, shader };
}

function viaScale(vias: THREE.InstancedMesh, index: number): number {
  const matrix = new THREE.Matrix4();
  vias.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix).x;
}

afterEach(() => {
  for (const rig of rigs) rig.dispose();
  rigs.length = 0;
});

describe('scroll-bound circuit reveal', () => {
  it.each([
    [-100, 0], [0, 0], [0.14, 0], [0.15, 0], [0.21, 0.5], [0.27, 1], [0.30, 1], [1, 1], [100, 1],
    [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], [Number.NEGATIVE_INFINITY, 0],
  ])('maps progress %s to reveal %s', (progress, expected) => {
    expect(circuitRevealAt(progress)).toBeCloseTo(expected, 12);
  });

  it('is continuous at both endpoints, monotone, and independent of traversal order', () => {
    expect(circuitRevealAt(0.15 + epsilon)).toBeLessThan(1e-10);
    expect(circuitRevealAt(0.27 - epsilon)).toBeGreaterThan(1 - 1e-10);
    const samples = Array.from({ length: 401 }, (_, i) => i / 400);
    const forward = samples.map(circuitRevealAt);
    for (let i = 1; i < forward.length; i += 1) expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1]);
    expect([...samples].reverse().map(circuitRevealAt)).toEqual([...forward].reverse());
  });
});

describe('batched circuitry materials and geometry', () => {
  it('starts hidden and keeps three batches with staggered route-local deadlines', () => {
    const { rig, copper, signal, vias, shader } = circuits();
    expect(rig.group.children).toHaveLength(3);
    expect(rig.group.visible).toBe(false);
    expect(signal.visible).toBe(false);
    expect(shader.uniforms.uCircuitReveal.value).toBe(0);
    expect(signal.material.uniforms.uReveal.value).toBe(0);
    expect(copper.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(vias).toBeInstanceOf(THREE.InstancedMesh);
    expect(vias.count).toBe(70);
    expect(vias.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
    for (const geometry of [copper.geometry, signal.geometry]) {
      const progress = geometry.getAttribute('aCircuitProgress');
      expect(progress.count).toBe(geometry.getAttribute('position').count);
      expect(Array.from(progress.array).every((value) => value >= 0 && value <= 0.921)).toBe(true);
      expect(progress.getX(0)).toBe(0);
      // Different starts survive geometry merging; UVs retain their original packet coordinates.
      expect(Array.from(progress.array).some((value, i) => geometry.getAttribute('uv').getX(i) === 0 && value > 0)).toBe(true);
    }
  });

  it('draws copper before power-up, grows vias progressively, and leaves geometry and lighting intact', () => {
    const { rig, copper, signal, vias, shader } = circuits();
    const positions = copper.geometry.getAttribute('position').array;
    const normals = copper.geometry.getAttribute('normal').array;
    const index = copper.geometry.index;
    const fullBounds = vias.boundingSphere!.clone();
    rig.update(0.16, 0, 200, false, false);
    expect(rig.group.visible).toBe(true);
    expect(shader.uniforms.uCircuitReveal.value).toBe(circuitRevealAt(0.16));
    expect(signal.material.uniforms.uReveal.value).toBe(circuitRevealAt(0.16));
    expect(signal.visible).toBe(false);
    expect(viaScale(vias, 0)).toBeGreaterThan(0.0001);
    expect(viaScale(vias, 0)).toBeLessThan(1);
    expect(viaScale(vias, 1)).toBeCloseTo(0.0001, 8);
    rig.update(0.21, 0, 400, false, false);
    expect(shader.uniforms.uCircuitReveal.value).toBeCloseTo(0.5, 12);
    expect(viaScale(vias, 0)).toBe(1);
    expect(viaScale(vias, 1)).toBeCloseTo(0.0001, 8);
    expect(vias.boundingSphere).toEqual(fullBounds);
    expect(copper.geometry.getAttribute('position').array).toBe(positions);
    expect(copper.geometry.getAttribute('normal').array).toBe(normals);
    expect(copper.geometry.index).toBe(index);
    expect(copper.material.metalness).toBe(0.72);
    expect(copper.material.roughness).toBe(0.44);
    expect(copper.material.envMapIntensity).toBe(0.75);
    expect(copper.material.transparent).toBe(true);
    expect(copper.material.depthWrite).toBe(false);
    expect(shader.vertexShader).toContain('#include <defaultnormal_vertex>');
    expect(shader.fragmentShader).toContain('#include <lights_physical_fragment>');
    expect(shader.fragmentShader).toContain('#include <tonemapping_fragment>');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= circuitCoverage');
    expect(signal.material.defines.PCB_REVEAL).toBe(1);
    expect(signal.material.fragmentShader).toContain('strength * rim * reveal');
  });

  it('is fully present by 0.27 and reverses real via matrices and both reveal uniforms exactly', () => {
    const { rig, signal, vias, shader } = circuits();
    const samples = [0, 0.14, 0.15, 0.16, 0.18, 0.21, 0.24, 0.26, 0.27, 0.30, 1];
    function snapshot(progress: number) {
      rig.update(progress, 0.7, 0, false, false);
      return {
        visible: rig.group.visible,
        copper: shader.uniforms.uCircuitReveal.value,
        signal: signal.material.uniforms.uReveal.value,
        matrices: Array.from(vias.instanceMatrix.array),
      };
    }
    const forward = samples.map(snapshot);
    for (let i = 0; i < vias.count; i += 1) expect(viaScale(vias, i)).toBe(1);
    expect(forward.at(-3)!.copper).toBe(1);
    expect([...samples].reverse().map(snapshot)).toEqual([...forward].reverse());
    expect(snapshot(0.24)).toEqual(forward[6]);
    expect(snapshot(1)).toEqual(forward.at(-1));
    expect(snapshot(0)).toEqual(forward[0]);
  });

  it('does not upload via matrices again at fixed scroll and only time-drives decorative packets', () => {
    const { rig, signal, vias, shader } = circuits();
    rig.update(0.24, 0.25, 10, false, true);
    const version = vias.instanceMatrix.version;
    const matrices = Array.from(vias.instanceMatrix.array);
    const reveal = shader.uniforms.uCircuitReveal.value;
    rig.update(0.24, 0.25, 1000, false, true);
    expect(vias.instanceMatrix.version).toBe(version);
    expect(signal.material.uniforms.uTime.value).toBe(1000);
    expect(signal.material.uniforms.uHighlight.value).toBe(1);
    rig.update(0.24, 0.25, 2000, true, false);
    expect(signal.material.uniforms.uTime.value).toBe(0);
    expect(signal.material.uniforms.uReducedMotion.value).toBe(1);
    expect(signal.material.uniforms.uHighlight.value).toBe(0);
    expect(signal.material.uniforms.uPowerProgress.value).toBe(0.25);
    expect(shader.uniforms.uCircuitReveal.value).toBe(reveal);
    expect(Array.from(vias.instanceMatrix.array)).toEqual(matrices);
    expect(vias.instanceMatrix.version).toBe(version);
  });

  it('normalizes unsafe inputs without non-finite material or instance state', () => {
    const { rig, signal, vias, shader } = circuits();
    for (const invalid of [Number.NaN, Infinity, -Infinity]) {
      rig.update(1, 1, 1, false, false);
      rig.update(invalid, invalid, invalid, false, false);
      expect(rig.group.visible).toBe(false);
      expect(signal.visible).toBe(false);
      expect(shader.uniforms.uCircuitReveal.value).toBe(0);
      expect(Object.values(signal.material.uniforms).every(({ value }) => Number.isFinite(value))).toBe(true);
      expect(signal.material.uniforms.uPowerProgress.value).toBe(0);
      expect(signal.material.uniforms.uTime.value).toBe(0);
      expect(Array.from(vias.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    }
    rig.update(100, 100, -10, false, false);
    expect(shader.uniforms.uCircuitReveal.value).toBe(1);
    expect(signal.material.uniforms.uPowerProgress.value).toBe(1);
    expect(signal.material.uniforms.uTime.value).toBe(0);
    rig.update(-100, -100, 1, false, false);
    expect(shader.uniforms.uCircuitReveal.value).toBe(0);
    expect(signal.material.uniforms.uPowerProgress.value).toBe(0);
  });

  it('disposes owned GPU resources once and ignores updates after disposal', () => {
    const { rig, copper, signal, vias, shader } = circuits();
    const disposals = [...[copper, signal, vias].flatMap((mesh) => [mesh.geometry, mesh.material]), vias]
      .map((resource) => vi.spyOn(resource, 'dispose'));
    rig.update(0.21, 0, 0, false, false);
    rig.dispose();
    rig.dispose();
    rig.update(1, 1, 1, false, true);
    expect(rig.group.children).toHaveLength(0);
    for (const listener of disposals) expect(listener).toHaveBeenCalledTimes(1);
    expect(shader.uniforms.uCircuitReveal.value).toBeCloseTo(0.5, 12);
  });

  it('leaves the shared non-PCB contact-fiber material contract unchanged', () => {
    const material = createPulseMaterial();
    expect(material.uniforms.uReveal.value).toBe(1);
    expect(material.defines.PCB_REVEAL).toBeUndefined();
    expect(material.fragmentShader).toContain('if (vUv.x > uReveal) discard;');
    material.dispose();
  });
});

describe('PCB surface integration', () => {
  it('replaces the carrier pop with overlapping surface, silkscreen, and component reveals', () => {
    const { rig, core, mask, details, silk, shader } = hardware();
    for (const progress of [0, 0.14]) {
      rig.update(progress, 0, 0, null, false);
      expect(mask.parent!.visible).toBe(false);
      expect(mask.material.opacity).toBe(0);
      expect(details.visible).toBe(false);
    }
    rig.update(0.14 + epsilon, 0, 0, null, false);
    expect(mask.parent!.visible).toBe(true);
    expect(mask.material.opacity).toBeGreaterThan(0);
    expect(mask.material.opacity).toBeLessThan(1e-10);
    rig.update(0.17, 0, 0, null, false);
    expect(core.material.opacity).toBeGreaterThan(0);
    expect(core.material.opacity).toBeLessThan(1);
    expect(mask.material.opacity).toBe(core.material.opacity);
    expect(silk.material.opacity).toBeGreaterThan(0);
    expect(silk.material.opacity).toBeLessThan(1);
    expect(details.visible).toBe(true);
    expect(shader.uniforms.uPcbDetailReveal.value).toBeGreaterThan(0);
    expect(shader.uniforms.uPcbDetailReveal.value).toBeLessThan(1);
    expect(details.scale.y).toBe(shader.uniforms.uPcbDetailReveal.value);
    expect(details.matrixWorld.determinant()).toBeGreaterThan(0);
    expect(core.renderOrder).toBeLessThan(mask.renderOrder);
    expect(mask.renderOrder).toBeLessThan(0);
    rig.update(0.235, 0, 0, null, false);
    expect(core.material.opacity).toBe(1);
    expect(mask.material.opacity).toBe(1);
    expect(core.material.depthWrite).toBe(true);
    expect(mask.material.depthWrite).toBe(true);
    expect(silk.material.opacity).toBe(1);
    expect(shader.uniforms.uPcbDetailReveal.value).toBe(1);
    expect(details.scale.toArray()).toEqual([1, 1, 1]);
    expect(details.position.toArray()).toEqual([0, 0, 0]);
  });

  it('isolates surface growth from shared hardware metals and deforms shadow passes identically', () => {
    const { rig, screws, shader } = hardware();
    const seam = rig.group.getObjectByName('island / fine nickel seam') as StandardMesh;
    const vrm = rig.group.getObjectByName('VRM / north heatsink') as StandardMesh;
    expect(screws.material).not.toBe(seam.material);
    expect(screws.material.color).toEqual(seam.material.color);
    expect(screws.material.metalness).toBe(seam.material.metalness);
    expect(prepareShader(seam.material).uniforms.uPcbDetailReveal).toBeUndefined();
    const depth = prepareShader(vrm.customDepthMaterial!, 'depth');
    const distance = prepareShader(vrm.customDistanceMaterial!, 'distanceRGBA');
    expect(depth.uniforms.uPcbDetailReveal).toBe(shader.uniforms.uPcbDetailReveal);
    expect(distance.uniforms.uPcbDetailReveal).toBe(shader.uniforms.uPcbDetailReveal);
    for (const program of [shader, depth, distance]) expect(program.vertexShader).toContain('transformed *= uPcbDetailReveal;');
    expect(shader.vertexShader).toContain('#include <defaultnormal_vertex>');
    expect(vrm.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);
    const disposed = [screws.material, vrm.customDepthMaterial!, vrm.customDistanceMaterial!].map((material) => {
      const listener = vi.fn();
      material.addEventListener('dispose', listener);
      return listener;
    });
    rig.dispose();
    rig.dispose();
    for (const listener of disposed) expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preserves ignition, highlights, reduced motion, and complete free-orbit progress', () => {
    const { rig, details, signal, shader } = hardware();
    const led = rig.group.getObjectByName('PCB / boot diagnostic LEDs') as StandardMesh;
    const islandInlay = rig.group.getObjectByName('island / recessed status inlays') as StandardMesh;
    rig.update(0.22, 100, 0, null, false);
    expect(signal.material.uniforms.uPowerProgress.value).toBe(0);
    expect(signal.visible).toBe(false);
    rig.update(0.26, 100, 0, 'pcb', false);
    expect(signal.material.uniforms.uPowerProgress.value).toBeCloseTo(0.5, 12);
    expect(signal.material.uniforms.uReveal.value).toBe(circuitRevealAt(0.26));
    expect(led.material).not.toBe(islandInlay.material);
    expect(led.material.emissiveIntensity).toBeCloseTo(islandInlay.material.emissiveIntensity, 12);
    expect(led.material.emissiveIntensity).toBeCloseTo(0.25 * 0.5 + 0.7, 12);
    rig.update(1, 200, 0, null, true);
    expect(details.visible).toBe(true);
    expect(shader.uniforms.uPcbDetailReveal.value).toBe(1);
    expect(signal.visible).toBe(true);
    expect(signal.material.uniforms.uReveal.value).toBe(1);
    expect(signal.material.uniforms.uPowerProgress.value).toBe(1);
    expect(signal.material.uniforms.uTime.value).toBe(0);
  });

  it('restores the same surface state after forward, reverse, random, and invalid samples', () => {
    const { rig, core, mask, details, silk, shader, signal } = hardware();
    const samples = [0, 0.14, 0.145, 0.155, 0.17, 0.185, 0.21, 0.235, 0.27, 0.30, 1];
    function snapshot(progress: number) {
      rig.update(progress, 0, 0, null, false);
      return {
        surface: [core.material.opacity, mask.material.opacity, silk.material.opacity],
        visible: [mask.parent!.visible, details.visible],
        details: [shader.uniforms.uPcbDetailReveal.value, ...details.matrixWorld.elements],
        traces: signal.material.uniforms.uReveal.value,
        power: signal.material.uniforms.uPowerProgress.value,
      };
    }
    const forward = samples.map(snapshot);
    expect([...samples].reverse().map(snapshot)).toEqual([...forward].reverse());
    expect(snapshot(1)).toEqual(forward.at(-1));
    expect(snapshot(0.17)).toEqual(forward[4]);
    expect(snapshot(0.14)).toEqual(forward[1]);
    for (const invalid of [NaN, Infinity, -Infinity, -100]) expect(snapshot(invalid)).toEqual(forward[0]);
    expect(snapshot(100)).toEqual(forward.at(-1));
  });
});
