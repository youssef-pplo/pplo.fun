import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { arsenal, contacts, identity, projects } from '../data';
import type { HardwareId, HardwarePart, HardwareRig } from '../types';
import { createCircuitry, createPulseMaterial } from './circuits';
import { createHardwareLabelTexture } from './labels';
import { CPU_ASSEMBLY, CPU_REST, LOAD_PLATE, loadPlateRotation } from './cpu-install';
import { NVME_DRIVES, NVME_POST, NVME_REST_Y, NVME_REST_Z, nvmeInstallPose, socketBoxes } from './nvme-install';
import type { HardwareLabelConfig, SilkscreenMark } from './labels';

type XYZ = readonly [number, number, number];

interface Instance {
  position: XYZ;
  scale: XYZ;
  rotation?: XYZ;
  color?: THREE.ColorRepresentation;
}

interface AssemblyTrack {
  part: HardwarePart;
  rest: THREE.Vector3;
  start: number;
  end: number;
  offset: THREE.Vector3;
  tilt: XYZ;
}

interface HighlightTarget {
  id: HardwareId;
  material: THREE.MeshStandardMaterial;
  idle: number;
  boost: number;
}

const LIME = '#d3ff65';
const CYAN = '#6cdee8';
const GOLD = '#cfb579';
const HALF_PI = Math.PI / 2;

function smooth(start: number, end: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function chamferShape(width: number, depth: number, corner: number): THREE.Shape {
  const x = width / 2;
  const z = depth / 2;
  const c = Math.min(corner, x * 0.85, z * 0.85);
  const shape = new THREE.Shape();
  shape.moveTo(-x + c, -z);
  shape.lineTo(x - c, -z);
  shape.lineTo(x, -z + c);
  shape.lineTo(x, z - c);
  shape.lineTo(x - c, z);
  shape.lineTo(-x + c, z);
  shape.lineTo(-x, z - c);
  shape.lineTo(-x, -z + c);
  shape.closePath();
  return shape;
}

/** Centered in all axes, with the extrusion normal pointing up (+y). */
function plateGeometry(
  width: number,
  depth: number,
  height: number,
  corner = 0.08,
  bevel = 0.02,
  holes: readonly THREE.Path[] = [],
): THREE.ExtrudeGeometry {
  const b = Math.min(bevel, height * 0.24, width * 0.08, depth * 0.08);
  const shape = chamferShape(width - b * 2, depth - b * 2, corner);
  shape.holes.push(...holes);
  const extrusion = height - b * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: extrusion,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 20,
  });
  geometry.rotateX(-HALF_PI);
  geometry.translate(0, -extrusion / 2, 0);
  return geometry;
}

function mergedGeometry(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  if (!geometry) throw new Error('Could not merge a procedural hardware geometry.');
  return geometry;
}

function withColor(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function randomGenerator(): () => number {
  let state = 0x50504c4f;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * Asset-free, local-space motherboard. Final PCB top: y=.06; island bottom: y=-.80.
 * Assembly poses depend only on scroll, never on accumulated animation state.
 */
export function createHardware(renderer: THREE.WebGLRenderer): HardwareRig {
  const group = new THREE.Group();
  group.name = 'PPLO / procedural hardware diorama';
  const components = new Map<HardwareId, HardwarePart>();
  const anchors = new Map<string, THREE.Object3D>();
  const pickables: THREE.Object3D[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instanceMeshes: THREE.InstancedMesh[] = [];
  const highlightTargets: HighlightTarget[] = [];
  const assembly: AssemblyTrack[] = [];
  let pcbSilkscreen: THREE.MeshStandardMaterial | undefined;
  const random = randomGenerator();
  let disposed = false;

  function ownGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    geometries.add(geometry);
    return geometry;
  }

  function ownMaterial<T extends THREE.Material>(material: T): T {
    materials.add(material);
    return material;
  }

  function metal(name: string, color: string, metalness: number, roughness: number): THREE.MeshStandardMaterial {
    return ownMaterial(new THREE.MeshStandardMaterial({ name, color, metalness, roughness, envMapIntensity: 0.85 }));
  }

  function accent(id: HardwareId, color = LIME, idle = 0.38, boost = 0.95): THREE.MeshStandardMaterial {
    const material = ownMaterial(new THREE.MeshStandardMaterial({
      name: `${id} / illuminated inlay`,
      color,
      emissive: color,
      emissiveIntensity: 0,
      metalness: 0.25,
      roughness: 0.3,
      envMapIntensity: 0.65,
    }));
    highlightTargets.push({ id, material, idle, boost });
    return material;
  }

  function part(id: HardwareId, parent: THREE.Object3D, position: XYZ, anchorPosition: XYZ): HardwarePart {
    const node = new THREE.Group();
    node.name = `hardware:${id}`;
    node.userData.hardwareId = id;
    node.position.set(...position);
    parent.add(node);
    const anchor = new THREE.Object3D();
    anchor.name = id;
    anchor.position.set(...anchorPosition);
    anchor.userData.hardwareId = id;
    node.add(anchor);
    const result: HardwarePart = { id, group: node, anchor, meshes: [] };
    components.set(id, result);
    anchors.set(id, anchor);
    return result;
  }

  function register(mesh: THREE.Mesh, id: HardwareId, interactive: boolean): void {
    mesh.userData.hardwareId = id;
    components.get(id)?.meshes.push(mesh);
    if (interactive) {
      // Three's raycaster does not otherwise skip invisible assembly ancestors.
      const raycast = mesh.raycast.bind(mesh);
      mesh.raycast = (raycaster, intersections) => {
        let ancestor: THREE.Object3D | null = mesh;
        while (ancestor) {
          if (!ancestor.visible) return;
          ancestor = ancestor.parent;
        }
        raycast(raycaster, intersections);
      };
      pickables.push(mesh);
    }
  }

  function mesh(
    parent: THREE.Object3D,
    id: HardwareId,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: XYZ = [0, 0, 0],
    name = '',
    rotation: XYZ = [0, 0, 0],
    interactive = true,
    shadow = true,
  ): THREE.Mesh {
    const result = new THREE.Mesh(geometry, material);
    result.name = name || `${id} / ${material.name}`;
    result.position.set(...position);
    result.rotation.set(...rotation);
    result.castShadow = shadow;
    result.receiveShadow = true;
    parent.add(result);
    register(result, id, interactive);
    return result;
  }

  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 16));
  const pinCylinder = ownGeometry(new THREE.CylinderGeometry(1, 0.8, 1, 6));
  const unitPlane = ownGeometry(new THREE.PlaneGeometry(1, 1));
  const dummy = new THREE.Object3D();

  function instances(
    parent: THREE.Object3D,
    id: HardwareId,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    specs: readonly Instance[],
    name: string,
    interactive = false,
    shadow = false,
  ): THREE.InstancedMesh {
    const result = new THREE.InstancedMesh(geometry, material, specs.length);
    result.name = name;
    specs.forEach((spec, index) => {
      dummy.position.set(...spec.position);
      dummy.scale.set(...spec.scale);
      dummy.rotation.set(...(spec.rotation ?? [0, 0, 0]));
      dummy.updateMatrix();
      result.setMatrixAt(index, dummy.matrix);
      if (spec.color !== undefined) result.setColorAt(index, new THREE.Color(spec.color));
    });
    result.instanceMatrix.needsUpdate = true;
    if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.computeBoundingBox();
    result.computeBoundingSphere();
    result.castShadow = shadow;
    result.receiveShadow = true;
    instanceMeshes.push(result);
    parent.add(result);
    register(result, id, interactive);
    return result;
  }

  function box(parent: THREE.Object3D, id: HardwareId, material: THREE.Material, position: XYZ, scale: XYZ, name: string, interactive = true): THREE.Mesh {
    const result = mesh(parent, id, unitBox, material, position, name, [0, 0, 0], interactive);
    result.scale.set(...scale);
    return result;
  }

  function plate(
    parent: THREE.Object3D,
    id: HardwareId,
    material: THREE.Material,
    position: XYZ,
    size: XYZ,
    name: string,
    corner = 0.08,
    bevel = 0.02,
    holes: readonly THREE.Path[] = [],
  ): THREE.Mesh {
    return mesh(parent, id, ownGeometry(plateGeometry(size[0], size[2], size[1], corner, bevel, holes)), material, position, name);
  }

  function label(
    parent: THREE.Object3D,
    id: HardwareId,
    config: Omit<HardwareLabelConfig, 'renderer' | 'aspect'>,
    width: number,
    height: number,
    position: XYZ,
    rotation: XYZ = [-HALF_PI, 0, 0],
    existingTexture?: THREE.CanvasTexture,
  ): THREE.CanvasTexture {
    const texture = existingTexture ?? createHardwareLabelTexture({ ...config, renderer, aspect: width / height });
    textures.add(texture);
    const silkscreen = config.variant === 'pcb';
    const material = ownMaterial(new THREE.MeshStandardMaterial({
      name: `${id} / engraved ${config.variant ?? 'label'}`,
      map: texture,
      color: '#ffffff',
      roughness: config.variant === 'processor' ? 0.4 : 0.54,
      metalness: config.variant === 'processor' ? 0.62 : 0.35,
      transparent: silkscreen,
      alphaTest: silkscreen ? 0.025 : 0,
      depthWrite: !silkscreen,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      emissive: LIME,
      emissiveMap: texture,
      emissiveIntensity: 0,
      envMapIntensity: 0.7,
    }));
    if (silkscreen) pcbSilkscreen = material;
    highlightTargets.push({ id, material, idle: silkscreen ? 0.008 : 0.012, boost: silkscreen ? 0.13 : 0.1 });
    const surface = mesh(parent, id, unitPlane, material, position, `${id} / ${config.title} engraving`, rotation, !silkscreen, false);
    surface.scale.set(width, height, 1);
    surface.renderOrder = silkscreen ? 1 : 0;
    return texture;
  }

  function track(hardware: HardwarePart, start: number, end: number, offset: XYZ, tilt: XYZ = [0, 0, 0]): void {
    assembly.push({ part: hardware, rest: hardware.group.position.clone(), start, end, offset: new THREE.Vector3(...offset), tilt });
    hardware.group.userData.assemblyRange = [start, end];
    hardware.group.userData.restPosition = hardware.group.position.toArray();
  }

  const obsidian = metal('obsidian / ceramic aluminum', '#10171c', 0.68, 0.33);
  const graphite = metal('graphite / bead-blasted alloy', '#252f35', 0.72, 0.42);
  const darkMetal = metal('anodized heatspreaders', '#3d494f', 0.87, 0.29);
  const silver = metal('satin nickel', '#b7c2c3', 0.92, 0.27);
  const brushed = metal('heatsink / brushed aluminum', '#78888e', 0.9, 0.32);
  const copper = metal('heatpipes / oxidized copper', '#b27b4d', 0.84, 0.26);
  const gold = metal('hard gold / contacts', '#c0a366', 0.83, 0.31);
  const plastic = metal('connector / charcoal polymer', '#151d20', 0.12, 0.6);
  const cavity = metal('port and slot cavities', '#05090c', 0.05, 0.73);
  const boardMaterial = metal('PCB / graphite solder mask', '#0a0e17', 0.33, 0.56);
  const substrate = metal('laminated PCB edge', '#303c35', 0.24, 0.66);
  const chipMaterial = metal('IC / black ceramic', '#1d262b', 0.25, 0.49);
  const smdMaterial = metal('SMD / ceramic array', '#abb7b8', 0.35, 0.53);
  const boardAccent = accent('pcb', LIME, 0.25, 0.7);

  const pcb = part('pcb', group, [0, 0, 0], [0, 0.13, 0]);
  const island = new THREE.Group();
  island.name = 'architectural / floating island';
  pcb.group.add(island);
  const carrier = new THREE.Group();
  carrier.name = 'assembled board / shared local coordinate frame';
  pcb.group.add(carrier);
  carrier.add(pcb.anchor);

  // A stepped, machined diorama, not a flat presentation plane.
  plate(island, 'pcb', graphite, [0, -0.23, 0], [8.4, 0.2, 6.8], 'island / chamfered upper deck', 0.34, 0.045);
  plate(island, 'pcb', obsidian, [0, -0.535, 0], [8.2, 0.41, 6.6], 'island / undercut monolith', 0.34, 0.065);
  plate(island, 'pcb', silver, [0, -0.345, 0], [8.24, 0.022, 6.64], 'island / fine nickel seam', 0.32, 0.005);
  plate(island, 'pcb', darkMetal, [0, -0.77, 0], [7.94, 0.06, 6.34], 'island / recessed floating sole', 0.32, 0.014);
  const deckInlays: Instance[] = [];
  const baseVents: Instance[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) deckInlays.push({ position: [side * (2.75 + i * 0.23), -0.365, 3.31], scale: [0.16, 0.018, 0.012] });
    for (let i = 0; i < 18; i += 1) baseVents.push({ position: [side * 4.105, -0.535, -2.1 + i * 0.23], scale: [0.009, 0.105, 0.055], rotation: [0.25, 0, 0] });
  }
  instances(island, 'pcb', unitBox, boardAccent, deckInlays, 'island / recessed status inlays');
  instances(island, 'pcb', unitBox, cavity, baseVents, 'island / sidewall machining');
  label(island, 'pcb', {
    variant: 'identity', title: identity.alias.toUpperCase(), subtitle: identity.domain,
    tech: [identity.role, identity.location], serial: identity.domain,
  }, 2.6, 0.235, [0, -0.525, 3.306], [0, 0, 0]);

  substrate.transparent = boardMaterial.transparent = true;
  const boardCore = plate(carrier, 'pcb', substrate, [0, -0.014, 0], [8.04, 0.092, 6.42], 'PCB / exposed laminated core', 0.19, 0.014);
  const boardMask = plate(carrier, 'pcb', boardMaterial, [0, 0.04, 0], [8.04, 0.04, 6.42], 'PCB / precision solder mask', 0.19, 0.008);
  // Transparent surface arrival must still render below copper and silkscreen.
  boardCore.renderOrder = -2;
  boardMask.renderOrder = -1;
  const boardDetails = new THREE.Group();
  boardDetails.name = 'PCB / seated surface components';
  carrier.add(boardDetails);
  const screwLocations: readonly (readonly [number, number])[] = [
    [-3.78, -2.96], [3.78, -2.96], [-3.78, 2.96], [3.78, 2.96],
    [-3.81, 0.31], [3.81, 0.72], [0.10, -3.02], [1.99, 3.02],
  ];
  instances(boardDetails, 'pcb', unitCylinder, silver, screwLocations.map(([x, z]) => ({ position: [x, -0.092, z], scale: [0.085, 0.082, 0.085] })), 'PCB / isolation standoffs');
  instances(boardDetails, 'pcb', unitCylinder, gold, screwLocations.map(([x, z]) => ({ position: [x, 0.063, z], scale: [0.086, 0.008, 0.086] })), 'PCB / plated mounting annuli');
  instances(boardDetails, 'pcb', unitCylinder, silver, screwLocations.map(([x, z]) => ({ position: [x, 0.081, z], scale: [0.048, 0.03, 0.048] })), 'PCB / captive nickel screws');
  instances(boardDetails, 'pcb', unitBox, cavity, screwLocations.map(([x, z]) => ({ position: [x, 0.097, z], scale: [0.06, 0.003, 0.009], rotation: [0, Math.PI / 4, 0] })), 'PCB / screw driver slots');

  const silkMarks: SilkscreenMark[] = [
    { text: 'LGA / HUMAN AT THE CORE', x: 0.224, y: 0.171, width: 0.274, height: 0.325 },
    { text: 'DIMM_A1', x: 0.689, y: 0.108, width: 0.036, height: 0.49 },
    { text: 'DIMM_A2', x: 0.751, y: 0.108, width: 0.036, height: 0.49 },
    { text: 'DIMM_B1', x: 0.813, y: 0.108, width: 0.036, height: 0.49 },
    { text: 'DIMM_B2', x: 0.875, y: 0.108, width: 0.036, height: 0.49 },
    { text: 'PCIE / NEURAL ENGINE', x: 0.135, y: 0.622, width: 0.55, height: 0.041 },
    { text: 'M.2_01 / KNOWLEDGE', x: 0.064, y: 0.882, width: 0.29, height: 0.096 },
    { text: 'M.2_02 / TOOLS', x: 0.409, y: 0.882, width: 0.29, height: 0.096 },
    { text: 'PCH / SYSTEMS', x: 0.785, y: 0.721, width: 0.174, height: 0.20 },
    { text: '24P / POWER', x: 0.927, y: 0.235, rotation: HALF_PI },
  ];
  label(carrier, 'pcb', {
    variant: 'pcb', title: `${identity.alias.toUpperCase()} / SYSTEM ARCHITECTURE`,
    subtitle: identity.role, spec: `${identity.domain}  //  ${identity.coordinates}`,
    serial: 'REV. 01 / PPLO', markings: silkMarks,
  }, 8.0, 6.38, [0, 0.066, 0]);

  for (const [name, x, z] of [
    ['corner-nw', -3.82, -3.02], ['corner-ne', 3.82, -3.02],
    ['corner-sw', -3.82, 3.02], ['corner-se', 3.82, 3.02],
  ] as const) {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.set(x, 0.1, z);
    carrier.add(anchor);
    anchors.set(name, anchor);
  }

  const circuits = createCircuitry();
  carrier.add(circuits.group);
  circuits.group.traverse((object) => {
    if (object instanceof THREE.Mesh) register(object, 'pcb', false);
  });

  const keepouts: readonly (readonly [number, number, number, number])[] = [
    [-2.16, 0.18, -2.12, 0.12], [-4.00, -3.25, -3.00, 0.14],
    [1.40, 3.42, -2.51, 0.70], [-3.56, 2.18, 0.50, 2.36],
    [-3.51, -1.08, 2.43, 3.17], [-0.72, 1.72, 2.43, 3.17],
    [2.24, 3.77, 1.39, 2.86], [3.43, 3.96, -1.57, 0.39],
    [-2.76, 0.45, -2.98, -2.16], [-3.13, -2.28, -2.44, 0.12],
  ];
  const clear = (x: number, z: number, padding = 0): boolean => !keepouts.some(([x0, x1, z0, z1]) => x > x0 - padding && x < x1 + padding && z > z0 - padding && z < z1 + padding);
  const smds: Instance[] = [];
  const terminations: Instance[] = [];
  for (let row = 0; row < 42; row += 1) {
    for (let column = 0; column < 54; column += 1) {
      const x = -3.76 + column * 0.141;
      const z = -2.95 + row * 0.142;
      if (!clear(x, z) || random() < 0.38) continue;
      const alongZ = random() > 0.55;
      const length = 0.065 + random() * 0.04;
      const height = 0.025 + random() * 0.026;
      const rotation: XYZ = [0, alongZ ? HALF_PI : 0, 0];
      smds.push({ position: [x, 0.071 + height / 2, z], scale: [length, height, 0.043], rotation, color: ['#20292b', '#3b4745', '#6e7468'][Math.floor(random() * 3)] });
      for (const end of [-1, 1]) terminations.push({
        position: [x + (alongZ ? 0 : end * length * 0.48), 0.073 + height / 2, z + (alongZ ? end * length * 0.48 : 0)],
        scale: [0.018, height + 0.003, 0.049], rotation,
      });
    }
  }
  instances(boardDetails, 'pcb', unitBox, smdMaterial, smds, `PCB / ${smds.length} ceramic SMD packages`);
  instances(boardDetails, 'pcb', unitBox, brushed, terminations, 'PCB / soldered SMD end caps');

  const capacitorPositions: { x: number; z: number; radius: number; height: number }[] = [];
  for (let attempt = 0; attempt < 2400 && capacitorPositions.length < 68; attempt += 1) {
    const x = Math.round((-3.7 + random() * 7.4) / 0.23) * 0.23;
    const z = Math.round((-2.9 + random() * 5.8) / 0.23) * 0.23;
    if (!clear(x, z, 0.03) || capacitorPositions.some((p) => Math.hypot(p.x - x, p.z - z) < 0.22)) continue;
    capacitorPositions.push({ x, z, radius: 0.048 + random() * 0.024, height: 0.09 + random() * 0.10 });
  }
  instances(boardDetails, 'pcb', unitCylinder, darkMetal, capacitorPositions.map(({ x, z, radius, height }) => ({ position: [x, 0.065 + height / 2, z], scale: [radius, height, radius] })), 'PCB / low-ESR capacitor cans');
  instances(boardDetails, 'pcb', unitCylinder, silver, capacitorPositions.map(({ x, z, radius, height }) => ({ position: [x, 0.067 + height, z], scale: [radius * 0.86, 0.012, radius * 0.86] })), 'PCB / scored capacitor tops');
  const capScores: Instance[] = [];
  capacitorPositions.forEach(({ x, z, radius, height }) => {
    capScores.push({ position: [x, 0.074 + height, z], scale: [radius * 1.2, 0.002, 0.006] });
    capScores.push({ position: [x, 0.074 + height, z], scale: [0.006, 0.002, radius * 1.2] });
  });
  instances(boardDetails, 'pcb', unitBox, graphite, capScores, 'PCB / capacitor pressure scores');

  const inductors: Instance[] = [];
  for (let i = 0; i < 10; i += 1) inductors.push({ position: [-2.20 + i * 0.258, 0.16, -2.31], scale: [0.21, 0.18, 0.22] });
  for (let i = 0; i < 8; i += 1) inductors.push({ position: [-2.43, 0.16, -1.91 + i * 0.257], scale: [0.22, 0.18, 0.21] });
  instances(boardDetails, 'pcb', ownGeometry(plateGeometry(1, 1, 1, 0.09, 0.045)), darkMetal, inductors, 'VRM / sealed ferrite chokes', false, true);
  plate(boardDetails, 'pcb', obsidian, [-1.15, 0.21, -2.77], [2.98, 0.18, 0.48], 'VRM / north heatsink', 0.12, 0.025);
  plate(boardDetails, 'pcb', obsidian, [-2.90, 0.21, -1.18], [0.40, 0.18, 2.48], 'VRM / west heatsink', 0.09, 0.025);
  const vrmFins: Instance[] = [];
  for (let i = 0; i < 36; i += 1) vrmFins.push({ position: [-2.54 + i * 0.079, 0.355, -2.77], scale: [0.028, 0.20, 0.43] });
  for (let i = 0; i < 29; i += 1) vrmFins.push({ position: [-2.90, 0.355, -2.33 + i * 0.082], scale: [0.35, 0.20, 0.027] });
  instances(boardDetails, 'pcb', unitBox, brushed, vrmFins, 'VRM / 65 individual cooling fins', false, true);
  instances(boardDetails, 'pcb', unitBox, boardAccent, [
    { position: [-1.15, 0.303, -2.987], scale: [2.55, 0.012, 0.009] },
    { position: [-3.082, 0.303, -1.18], scale: [0.009, 0.012, 2.1] },
  ], 'VRM / status edge inlays');

  // Sockets exist before their removable parts, and remain attached to the PCB.
  const sockets = new THREE.Group();
  sockets.name = 'PCB / unpopulated sockets';
  boardDetails.add(sockets);
  plate(sockets, 'pcb', plastic, [-1.0, 0.132, -1.0], [2.20, 0.13, 2.13], 'LGA / keyed socket carrier', 0.09, 0.018);
  plate(sockets, 'pcb', cavity, [-1.0, 0.205, -1.0], [1.79, 0.04, 1.73], 'LGA / contact bed', 0.04, 0.008);
  const lgaPins: Instance[] = [];
  for (let x = 0; x < 20; x += 1) for (let z = 0; z < 20; z += 1) {
    lgaPins.push({ position: [-1.76 + x * 0.08, 0.238, -1.76 + z * 0.08], scale: [0.009, 0.027, 0.009], rotation: [0, 0, 0.22] });
  }
  instances(sockets, 'pcb', pinCylinder, gold, lgaPins, 'LGA / 400 spring contacts');
  const socketScrews: Instance[] = [];
  for (const x of [-2.035, 0.035]) for (const z of [-1.99, -0.01]) socketScrews.push({ position: [x, 0.216, z], scale: [0.048, 0.035, 0.048] });
  instances(sockets, 'pcb', unitCylinder, silver, socketScrews, 'LGA / four socket fasteners');
  const retention = new THREE.Group();
  retention.name = 'LGA / rear retention hinge';
  retention.position.set(...LOAD_PLATE.hinge);
  sockets.add(retention);
  const retentionMetal = metal('LGA / machined retention plate', '#aab8b8', 0.94, 0.24);
  highlightTargets.push({ id: 'cpu', material: retentionMetal, idle: 0, boost: 0.13 });
  retentionMetal.emissive.set(LIME);
  plate(retention, 'pcb', retentionMetal, [0, 0, LOAD_PLATE.size[2] / 2], [...LOAD_PLATE.size], 'LGA / hinged open-center load plate', 0.095, 0.011, [chamferShape(LOAD_PLATE.window[0], LOAD_PLATE.window[1], 0.05)]);
  mesh(sockets, 'pcb', ownGeometry(new THREE.CylinderGeometry(0.06, 0.06, 2.23, 16)), silver, [...LOAD_PLATE.hinge], 'LGA / retention hinge axle', [0, 0, HALF_PI]);
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.12, 0.015, 0), new THREE.Vector3(1.18, 0.025, 0.25),
    new THREE.Vector3(1.18, 0.025, 1.92), new THREE.Vector3(1.10, 0.045, 2.13),
    new THREE.Vector3(0.92, 0.045, 2.16),
  ]);
  mesh(retention, 'pcb', ownGeometry(new THREE.TubeGeometry(leverCurve, 30, 0.026, 8, false)), silver, [0, 0, 0], 'LGA / spring-loaded locking arm');

  const socketRails: Instance[] = [];
  const socketContacts: Instance[] = [];
  const latchSpecs: Instance[] = [];
  const ramX = [1.65, 2.15, 2.65, 3.15] as const;
  ramX.forEach((x) => {
    socketRails.push({ position: [x, 0.115, -0.9], scale: [0.31, 0.10, 3.08] });
    for (const side of [-1, 1]) {
      socketRails.push({ position: [x + side * 0.115, 0.185, -0.9], scale: [0.065, 0.17, 2.88] });
      latchSpecs.push({ position: [x, 0.20, -0.9 + side * 1.55], scale: [0.32, 0.24, 0.15], rotation: [side * 0.32, 0, 0] });
      for (let i = 0; i < 42; i += 1) socketContacts.push({ position: [x + side * 0.053, 0.17, -2.23 + i * 0.064], scale: [0.014, 0.105, 0.022] });
    }
  });
  instances(sockets, 'pcb', unitBox, plastic, socketRails, 'DDR / four keyed DIMM channels', true);
  instances(sockets, 'pcb', unitBox, gold, socketContacts, 'DDR / 336 socket contacts');
  const ramLatches = instances(sockets, 'pcb', unitBox, darkMetal, latchSpecs, 'DDR / eight moving retention clips', true);
  ramLatches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (ramLatches.boundingSphere) ramLatches.boundingSphere.radius += 0.08;

  const pcieRails: Instance[] = [
    { position: [-0.7, 0.12, 0.90], scale: [4.44, 0.11, 0.29] },
    { position: [-0.7, 0.205, 0.79], scale: [4.44, 0.17, 0.065] },
    { position: [-0.7, 0.205, 1.01], scale: [4.44, 0.17, 0.065] },
    { position: [1.59, 0.19, 0.90], scale: [0.18, 0.24, 0.36] },
  ];
  instances(sockets, 'pcb', unitBox, plastic, pcieRails, 'PCIe / reinforced horizontal x16 riser socket', true);
  const pcieContacts: Instance[] = [];
  for (let i = 0; i < 76; i += 1) for (const side of [-1, 1]) pcieContacts.push({ position: [-2.78 + i * 0.055, 0.18, 0.90 + side * 0.044], scale: [0.025, 0.13, 0.014] });
  instances(sockets, 'pcb', unitBox, gold, pcieContacts, 'PCIe / 152 contact springs');

  plate(sockets, 'pcb', plastic, [3.69, 0.255, -0.60], [0.45, 0.34, 1.73], 'power / keyed 24-pin ATX connector', 0.035, 0.012);
  const powerCells: Instance[] = [];
  const powerPins: Instance[] = [];
  for (let column = 0; column < 2; column += 1) for (let row = 0; row < 12; row += 1) {
    powerCells.push({ position: [3.59 + column * 0.20, 0.428, -1.33 + row * 0.133], scale: [0.137, 0.008, 0.098] });
    powerPins.push({ position: [3.59 + column * 0.20, 0.434, -1.33 + row * 0.133], scale: [0.022, 0.045, 0.024] });
  }
  instances(sockets, 'pcb', unitBox, cavity, powerCells, 'power / 24 recessed connector cells');
  instances(sockets, 'pcb', unitBox, gold, powerPins, 'power / 24 square gold pins');
  box(sockets, 'pcb', graphite, [3.435, 0.27, -0.6], [0.055, 0.16, 0.41], 'power / locking tab');
  const powerAnchor = new THREE.Object3D();
  powerAnchor.name = 'power';
  powerAnchor.position.set(3.69, 0.51, -0.6);
  sockets.add(powerAnchor);
  anchors.set('power', powerAnchor);

  // Open-throat M.2 sockets: a lower jaw, an upper jaw and a back wall, so the drive can slide in at an angle.
  const m2Jaws: Instance[] = NVME_DRIVES.flatMap((drive) => socketBoxes(drive.x).map((box) => ({
    position: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2] as XYZ,
    scale: [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]] as XYZ,
  })));
  instances(sockets, 'pcb', unitBox, plastic, m2Jaws, 'M.2 / open-throat keyed sockets', true);
  // The standoff ends exactly at the seated drive's underside.
  instances(sockets, 'pcb', unitCylinder, silver, NVME_DRIVES.map((drive) => ({ position: [drive.x + NVME_POST.offsetX, (NVME_POST.base + NVME_POST.top) / 2, NVME_REST_Z], scale: [NVME_POST.radius, NVME_POST.top - NVME_POST.base, NVME_POST.radius] })), 'M.2 / mounting posts');
  const boardLedSpecs: Instance[] = [];
  for (let i = 0; i < 6; i += 1) boardLedSpecs.push({ position: [0.52 + i * 0.09, 0.085, -2.76], scale: [0.035, 0.018, 0.063] });
  instances(boardDetails, 'pcb', unitBox, boardAccent, boardLedSpecs, 'PCB / boot diagnostic LEDs');

  const detailReveal = { value: 0 };
  function growSurfaceMaterial<T extends THREE.Material>(material: T): T {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPcbDetailReveal = detailReveal;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uPcbDetailReveal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= uPcbDetailReveal;');
    };
    material.customProgramCacheKey = () => 'pcb-surface-growth-v1';
    return ownMaterial(material);
  }
  // Growth is uniform in each part's local frame, so Three's normal lighting stays intact.
  // Shadow passes use the same geometry deformation, not the fully assembled silhouette.
  const detailDepth = growSurfaceMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const detailDistance = growSurfaceMaterial(new THREE.MeshDistanceMaterial());
  const detailMaterials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
  boardDetails.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const source = object.material;
    let material = detailMaterials.get(source);
    if (!material) {
      material = growSurfaceMaterial(source.clone());
      detailMaterials.set(source, material);
      const highlight = highlightTargets.find((target) => target.material === source);
      if (highlight) highlightTargets.push({ ...highlight, material });
    }
    object.material = material;
    object.customDepthMaterial = detailDepth;
    object.customDistanceMaterial = detailDistance;
  });

  // CPU: ceramic substrate, plated land grid, machined IHS, and etched biography.
  const cpu = part('cpu', carrier, [...CPU_REST], [0, 0.24, 0]);
  const cpuAccent = accent('cpu', LIME, 0.20, 1.1);
  plate(cpu.group, 'cpu', substrate, [0, -0.01, 0], [1.78, 0.08, 1.73], 'CPU / keyed organic package', 0.05, 0.01);
  plate(cpu.group, 'cpu', graphite, [0, 0.033, 0], [1.57, 0.023, 1.52], 'CPU / IHS gasket', 0.08, 0.005);
  plate(cpu.group, 'cpu', silver, [0, 0.083, 0], [1.54, 0.114, 1.49], 'CPU / beveled nickel heatspreader', 0.10, 0.025);
  const cpuLands: Instance[] = [];
  for (let x = 0; x < 18; x += 1) for (let z = 0; z < 18; z += 1) {
    if (x > 5 && x < 12 && z > 5 && z < 12) continue;
    cpuLands.push({ position: [-0.73 + x * 0.086, -0.054, -0.73 + z * 0.086], scale: [0.039, 0.012, 0.039] });
  }
  instances(cpu.group, 'cpu', unitBox, gold, cpuLands, 'CPU / underside LGA lands');
  instances(cpu.group, 'cpu', unitBox, cpuAccent, [
    { position: [-0.68, 0.143, -0.65], scale: [0.19, 0.009, 0.018] },
    { position: [-0.766, 0.143, -0.565], scale: [0.018, 0.009, 0.19] },
  ], 'CPU / pin-one luminous index');
  label(cpu.group, 'cpu', {
    variant: 'processor', title: `${identity.name.toUpperCase()} // PPLO`, subtitle: 'PPLO-CORE i9 // AI ARCHITECT',
    description: identity.role.toUpperCase(), tech: ['CODING SINCE AGE 8', '30+ LANGUAGES'],
    spec: `${identity.location} / ${identity.coordinates}`, serial: identity.domain, index: 'CORE / 01',
  }, 1.38, 1.33, [0, 0.142, 0]);
  track(cpu, CPU_ASSEMBLY.start, CPU_ASSEMBLY.end, [...CPU_ASSEMBLY.offset], [...CPU_ASSEMBLY.tilt]);

  // GPU: true fan apertures, swept rotors, a fin stack, and three copper heatpipes.
  const gpu = part('gpu', carrier, [-0.7, 1.0, 1.45], [0, 0.45, 0]);
  const gpuAccent = accent('gpu', LIME, 0.34, 1.1);
  const aiProjects = projects.filter((project) => project.hardware === 'gpu');
  const gpuTitle = aiProjects.map((project) => project.shortTitle).join(' + ');
  const gpuTech = [...new Set(aiProjects.flatMap((project) => [...project.tech]))];
  plate(gpu.group, 'gpu', boardMaterial, [0, -0.298, 0], [5.43, 0.06, 1.59], 'GPU / graphite accelerator PCB', 0.10, 0.012);
  plate(gpu.group, 'gpu', graphite, [0, -0.357, 0], [5.55, 0.055, 1.66], 'GPU / machined backplate', 0.13, 0.012);
  box(gpu.group, 'gpu', plastic, [0, -0.54, -0.55], [4.21, 0.40, 0.082], 'GPU / rigid PCIe riser');
  const gpuFingers: Instance[] = [];
  for (let i = 0; i < 72; i += 1) {
    if (i === 13 || i === 14) continue;
    for (const side of [-1, 1]) gpuFingers.push({ position: [-2.02 + i * 0.0568, -0.765, -0.55 + side * 0.046], scale: [0.032, 0.20, 0.009] });
  }
  instances(gpu.group, 'gpu', unitBox, gold, gpuFingers, 'GPU / notched gold PCIe fingers');
  const gpuFinSpecs: Instance[] = [];
  for (let i = 0; i < 76; i += 1) gpuFinSpecs.push({ position: [-2.58 + i * 0.0688, -0.055, 0], scale: [0.027, 0.43, 1.47] });
  instances(gpu.group, 'gpu', unitBox, brushed, gpuFinSpecs, 'GPU / 76 exposed axial heatsink fins', false, true);
  const heatpipePieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const z = -0.48 + i * 0.47;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.51, -0.18, z), new THREE.Vector3(-2.64, -0.10, z + 0.12),
      new THREE.Vector3(-2.34, 0.015, z + 0.19), new THREE.Vector3(-0.8, 0.035, z + 0.19),
      new THREE.Vector3(0.8, 0.035, z + 0.19), new THREE.Vector3(2.34, 0.015, z + 0.19),
      new THREE.Vector3(2.64, -0.10, z + 0.12), new THREE.Vector3(2.51, -0.18, z),
    ]);
    heatpipePieces.push(new THREE.TubeGeometry(curve, 60, 0.037, 8, false));
  }
  mesh(gpu.group, 'gpu', ownGeometry(mergedGeometry(heatpipePieces)), copper, [0, 0, 0], 'GPU / continuous copper heatpipes');
  const fanHoles: THREE.Path[] = [];
  for (const x of [-1.8, 0, 1.8]) {
    const hole = new THREE.Path();
    hole.absarc(x, 0, 0.691, 0, Math.PI * 2, true);
    fanHoles.push(hole);
  }
  plate(gpu.group, 'gpu', obsidian, [0, 0.195, 0], [5.6, 0.16, 1.7], 'GPU / triple-aperture beveled axial shroud', 0.16, 0.025, fanHoles);
  const gpuRails: Instance[] = [
    { position: [0, -0.045, 0.817], scale: [5.28, 0.39, 0.065] },
    { position: [0, 0.11, -0.817], scale: [5.13, 0.10, 0.055] },
  ];
  instances(gpu.group, 'gpu', unitBox, darkMetal, gpuRails, 'GPU / shroud edge armor');
  instances(gpu.group, 'gpu', unitBox, gpuAccent, [
    { position: [-1.66, 0.279, 0.765], scale: [1.75, 0.012, 0.018] },
    { position: [1.66, 0.279, 0.765], scale: [1.75, 0.012, 0.018] },
    { position: [0, 0.279, -0.765], scale: [4.97, 0.012, 0.014] },
  ], 'GPU / restrained edge light guides');

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.16, -0.043);
  bladeShape.bezierCurveTo(0.31, -0.13, 0.49, -0.18, 0.625, -0.055);
  bladeShape.quadraticCurveTo(0.66, -0.007, 0.612, 0.095);
  bladeShape.bezierCurveTo(0.46, 0.035, 0.33, 0.09, 0.18, 0.105);
  bladeShape.closePath();
  const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.026, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 7, steps: 1 });
  blade.rotateX(-HALF_PI);
  const rotorPieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i += 1) rotorPieces.push(blade.clone().rotateY(i * Math.PI * 2 / 9));
  blade.dispose();
  const rotorGeometry = ownGeometry(mergedGeometry(rotorPieces));
  const fanRotors: THREE.Mesh[] = [];
  const fanRingPieces: THREE.BufferGeometry[] = [];
  for (const x of [-1.8, 0, 1.8]) {
    fanRotors.push(mesh(gpu.group, 'gpu', rotorGeometry, graphite, [x, 0.235, 0], 'GPU / nine swept axial fan blades'));
    const ring = new THREE.TorusGeometry(0.667, 0.018, 6, 56);
    ring.rotateX(-HALF_PI);
    ring.translate(x, 0.273, 0);
    fanRingPieces.push(ring);
  }
  mesh(gpu.group, 'gpu', ownGeometry(mergedGeometry(fanRingPieces)), brushed, [0, 0, 0], 'GPU / three concentric fan bezels');
  instances(gpu.group, 'gpu', unitCylinder, obsidian, [-1.8, 0, 1.8].map((x) => ({ position: [x, 0.235, 0], scale: [0.192, 0.095, 0.192] })), 'GPU / fan motor hubs');
  instances(gpu.group, 'gpu', unitCylinder, silver, [-1.8, 0, 1.8].map((x) => ({ position: [x, 0.287, 0], scale: [0.128, 0.014, 0.128] })), 'GPU / machined hub caps');
  instances(gpu.group, 'gpu', unitBox, gpuAccent, [-1.8, 0, 1.8].map((x) => ({ position: [x, 0.296, 0], scale: [0.077, 0.006, 0.019], rotation: [0, -Math.PI / 4, 0] })), 'GPU / motor cap inlays');
  const gpuScrews: Instance[] = [];
  for (const x of [-2.64, -0.90, 0.90, 2.64]) for (const z of [-0.716, 0.716]) gpuScrews.push({ position: [x, 0.279, z], scale: [0.033, 0.017, 0.033] });
  instances(gpu.group, 'gpu', unitCylinder, silver, gpuScrews, 'GPU / eight shroud fasteners');
  const gpuLabelConfig: Omit<HardwareLabelConfig, 'renderer' | 'aspect'> = {
    variant: 'graphics', title: gpuTitle, subtitle: 'ARTIFICIAL INTELLIGENCE / NEURAL ENGINE',
    description: aiProjects.map((project) => project.description).join(' '), tech: gpuTech,
    spec: aiProjects.map((project) => project.spec).join(' / '), serial: aiProjects.map((project) => project.url).join(' / '), index: 'AI / 01—02',
  };
  label(gpu.group, 'gpu', gpuLabelConfig, 4.95, 0.22, [0, -0.047, 0.851], [0, 0, 0]);
  label(gpu.group, 'gpu', gpuLabelConfig, 4.43, 1.25, [0, -0.386, 0], [HALF_PI, 0, 0]);
  label(gpu.group, 'gpu', { ...gpuLabelConfig, tech: aiProjects.map((project) => project.shortTitle), title: 'PPLO / NEURAL ENGINE' }, 2.75, 0.085, [0, 0.279, 0.751]);
  track(gpu, 0.46, 0.57, [-0.42, 4.15, 0.52], [-0.1, -0.08, 0.045]);

  // Four physically separate, individually labeled portfolio DIMMs.
  const ramParts: HardwarePart[] = [];
  const memorySpreaderGeometry = ownGeometry(plateGeometry(2.8, 0.69, 0.048, 0.06, 0.01));
  memorySpreaderGeometry.rotateX(HALF_PI);
  memorySpreaderGeometry.rotateY(HALF_PI);
  ramX.forEach((x, index) => {
    const id = `ram-${index}` as HardwareId;
    const project = projects.find((candidate) => candidate.hardware === id);
    if (!project) throw new Error(`Missing portfolio project for ${id}.`);
    const ram = part(id, carrier, [x, 0.18, -0.9], [0, 1.18, 0]);
    ramParts.push(ram);
    const light = accent(id, index % 2 === 0 ? LIME : CYAN, 0.55, 1.05);
    plate(ram.group, id, boardMaterial, [0, 0.48, 0], [0.075, 0.89, 2.80], 'DIMM / dark multilayer PCB', 0.02, 0.007);
    instances(ram.group, id, memorySpreaderGeometry, darkMetal, [
      { position: [-0.073, 0.634, 0], scale: [1, 1, 1] },
      { position: [0.073, 0.634, 0], scale: [1, 1, 1] },
    ], 'DIMM / two beveled aluminum heatspreaders', true, true);
    const ramChips: Instance[] = [];
    const memoryFingers: Instance[] = [];
    const spreaderGrooves: Instance[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i += 1) ramChips.push({ position: [side * 0.055, 0.29, -1.16 + i * 0.33], scale: [0.06, 0.29, 0.23] });
      for (let i = 0; i < 44; i += 1) {
        if (i === 17 || i === 18) continue;
        memoryFingers.push({ position: [side * 0.042, 0.105, -1.30 + i * 0.0605], scale: [0.009, 0.18, 0.033] });
      }
      for (let i = 0; i < 20; i += 1) spreaderGrooves.push({ position: [side * 0.099, 0.932, -1.25 + i * 0.132], scale: [0.006, 0.075, 0.026], rotation: [0.22, 0, 0] });
    }
    instances(ram.group, id, unitBox, chipMaterial, ramChips, 'DIMM / sixteen memory ICs');
    instances(ram.group, id, unitBox, gold, memoryFingers, 'DIMM / double-sided notched gold fingers');
    instances(ram.group, id, unitBox, cavity, spreaderGrooves, 'DIMM / machined spreader channels');
    plate(ram.group, id, light, [0, 1.035, 0], [0.205, 0.10, 2.78], 'DIMM / continuous diffused lightbar', 0.055, 0.022);
    const memoryLabel: Omit<HardwareLabelConfig, 'renderer' | 'aspect'> = {
      variant: 'memory', title: project.shortTitle, subtitle: project.category, description: project.description,
      tech: project.tech, spec: project.spec, serial: project.url.replace('https://', ''), index: project.index,
      accent: index % 2 === 0 ? LIME : CYAN,
    };
    const texture = label(ram.group, id, memoryLabel, 2.47, 0.49, [0.100, 0.638, 0], [0, HALF_PI, 0]);
    label(ram.group, id, memoryLabel, 2.47, 0.49, [-0.100, 0.638, 0], [0, -HALF_PI, 0], texture);
    track(ram, 0.63 + index * 0.035, 0.685 + index * 0.035, [0.06 * (index - 1.5), 2.9 + index * 0.16, -0.12], [0.025, 0, -0.035]);
  });

  // The knowledge bank uses actual technologies from the shared portfolio data.
  const skills = (id: string): readonly string[] => arsenal.find((category) => category.id === id)?.items ?? [];
  const storageData = [
    { x: -2.3, title: 'LANGUAGES / AI', subtitle: 'KNOWLEDGE BANK / 01', tech: [...skills('languages'), ...skills('ai')], description: skills('focus').join(' '), spec: 'LANGUAGES + MACHINE LEARNING', color: CYAN },
    { x: 0.5, title: 'FULL STACK / DEVOPS', subtitle: 'KNOWLEDGE BANK / 02', tech: [...skills('fullstack'), ...skills('devops')], description: [...skills('mobile'), ...skills('creative')].join(' / '), spec: 'APPLICATIONS + INFRASTRUCTURE', color: LIME },
  ];
  const nvmeParts: HardwarePart[] = [];
  storageData.forEach((data, index) => {
    const id = `nvme-${index}` as HardwareId;
    const drive = part(id, carrier, [data.x, 0.12, 2.8], [0, 0.24, 0]);
    const driveAccent = accent(id, data.color, 0.38, 0.9);
    plate(drive.group, id, boardMaterial, [0, 0, 0], [2.25, 0.055, 0.62], 'NVMe / M.2 graphite PCB', 0.055, 0.008);
    const driveChips: Instance[] = [];
    for (let i = 0; i < 3; i += 1) driveChips.push({ position: [-0.65 + i * 0.6, 0.055, 0], scale: [0.43, 0.07, 0.42] });
    instances(drive.group, id, unitBox, chipMaterial, driveChips, 'NVMe / NAND and controller packages');
    plate(drive.group, id, darkMetal, [0.04, 0.086, 0], [2.03, 0.084, 0.565], 'NVMe / beveled passive heatspreader', 0.075, 0.018);
    const driveFingers: Instance[] = [];
    for (let i = 0; i < 12; i += 1) {
      if (i === 3 || i === 4) continue;
      driveFingers.push({ position: [-1.075, 0.032, -0.25 + i * 0.045], scale: [0.14, 0.008, 0.025] });
    }
    instances(drive.group, id, unitBox, gold, driveFingers, 'NVMe / keyed edge contacts');
    const storageGrooves: Instance[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 16; i += 1) storageGrooves.push({ position: [-0.84 + i * 0.117, 0.132, side * 0.255], scale: [0.035, 0.012, 0.035] });
    instances(drive.group, id, unitBox, cavity, storageGrooves, 'NVMe / perimeter cooling grooves');
    instances(drive.group, id, unitBox, driveAccent, [{ position: [0.91, 0.134, 0], scale: [0.018, 0.012, 0.38] }], 'NVMe / activity inlay');
    mesh(drive.group, id, ownGeometry(new THREE.TorusGeometry(0.048, 0.012, 5, 12)), silver, [1.035, 0.034, 0], 'NVMe / mounting eyelet', [-HALF_PI, 0, 0]);
    label(drive.group, id, {
      variant: 'storage', title: data.title, subtitle: data.subtitle, description: data.description,
      tech: data.tech, spec: data.spec, serial: identity.domain, index: `M.2 / 0${index + 1}`, accent: data.color,
    }, 1.79, 0.43, [-0.035, 0.130, 0]);
    drive.group.userData.assemblyRange = [NVME_DRIVES[index].start, NVME_DRIVES[index].end];
    drive.group.userData.restPosition = [data.x, NVME_REST_Y, NVME_REST_Z];
    nvmeParts.push(drive);
  });

  const pch = part('pch', carrier, [3.0, 0.12, 2.1], [0, 0.36, 0]);
  const pchAccent = accent('pch', LIME, 0.33, 0.95);
  plate(pch.group, 'pch', chipMaterial, [0, 0.025, 0], [1.26, 0.09, 1.23], 'PCH / system controller package', 0.09, 0.018);
  plate(pch.group, 'pch', graphite, [0, 0.122, 0], [1.37, 0.14, 1.31], 'PCH / architectural heatsink', 0.16, 0.027);
  const pchFins: Instance[] = [];
  const pchPins: Instance[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i += 1) pchFins.push({ position: [side * 0.598, 0.205, -0.50 + i * 0.1], scale: [0.10, 0.12, 0.036] });
    for (let i = 0; i < 18; i += 1) {
      pchPins.push({ position: [side * 0.65, 0.004, -0.51 + i * 0.06], scale: [0.075, 0.018, 0.024] });
      pchPins.push({ position: [-0.51 + i * 0.06, 0.004, side * 0.633], scale: [0.024, 0.018, 0.075] });
    }
  }
  instances(pch.group, 'pch', unitBox, brushed, pchFins, 'PCH / twin finned shoulders');
  instances(pch.group, 'pch', unitBox, gold, pchPins, 'PCH / perimeter interconnect pins');
  instances(pch.group, 'pch', unitBox, pchAccent, [{ position: [0, 0.195, 0.584], scale: [0.82, 0.009, 0.02] }], 'PCH / controller status inlay');
  label(pch.group, 'pch', {
    variant: 'chipset', title: 'SYSTEM DESIGN', subtitle: 'PROBLEM SOLVING / SYSTEMS',
    description: identity.role, tech: skills('systems'), spec: identity.domain, serial: identity.coordinates, index: 'PCH',
  }, 1.01, 1.03, [0, 0.194, 0]);
  track(pch, 0.83, 0.90, [0.18, 1.8, 0.2], [0.06, 0.14, 0]);

  // Rear I/O: shield cans, stacked USB/DisplayPort, RJ45, audio, and USB-C.
  const io = part('io', carrier, [-3.65, 0.09, -1.45], [-0.13, 0.87, 0]);
  const ioAccent = accent('io', CYAN, 0.48, 0.95);
  plate(io.group, 'io', graphite, [0, 0.02, 0], [0.72, 0.12, 3.01], 'I/O / rear connector foundation', 0.06, 0.015);
  const ioCans: Instance[] = [];
  const ioFaces: Instance[] = [];
  const ioTongues: Instance[] = [];
  for (const z of [-1.14, -0.57, 0, 0.57, 1.14]) ioCans.push({ position: [0, 0.365, z], scale: [0.64, 0.64, 0.51] });
  for (const z of [-1.14, -0.57]) for (const y of [0.23, 0.48]) {
    ioFaces.push({ position: [-0.323, y, z], scale: [0.012, 0.148, 0.35] });
    ioTongues.push({ position: [-0.332, y - 0.025, z], scale: [0.013, 0.035, 0.265] });
  }
  ioFaces.push({ position: [-0.323, 0.34, 0], scale: [0.012, 0.35, 0.37] });
  ioFaces.push({ position: [-0.323, 0.34, 1.14], scale: [0.012, 0.16, 0.32] });
  ioTongues.push({ position: [-0.332, 0.34, 1.14], scale: [0.013, 0.029, 0.25] });
  instances(io.group, 'io', unitBox, brushed, ioCans, 'I/O / five shielded steel port stacks', true, true);
  instances(io.group, 'io', unitBox, cavity, ioFaces, 'I/O / inset USB, DisplayPort and RJ45 openings');
  instances(io.group, 'io', unitBox, ioAccent, ioTongues, 'I/O / cyan USB contact tongues');
  const ioPins: Instance[] = [];
  for (let i = 0; i < 8; i += 1) ioPins.push({ position: [-0.335, 0.22, -0.14 + i * 0.04], scale: [0.008, 0.085, 0.012] });
  for (const z of [-1.14, -0.57]) for (const y of [0.23, 0.48]) for (let i = 0; i < 4; i += 1) ioPins.push({ position: [-0.341, y + 0.016, z - 0.11 + i * 0.073], scale: [0.006, 0.025, 0.026] });
  instances(io.group, 'io', unitBox, gold, ioPins, 'I/O / exposed signal contacts');
  const jackGeometry = ownGeometry(new THREE.TorusGeometry(0.066, 0.018, 6, 18));
  const audioRings: Instance[] = [];
  const audioHoles: Instance[] = [];
  for (const y of [0.17, 0.35, 0.53]) {
    audioRings.push({ position: [-0.331, y, 0.57], scale: [1, 1, 1], rotation: [0, -HALF_PI, 0] });
    audioHoles.push({ position: [-0.327, y, 0.57], scale: [0.052, 0.009, 0.052], rotation: [0, 0, HALF_PI] });
  }
  instances(io.group, 'io', jackGeometry, silver, audioRings, 'I/O / triple audio jack collars');
  instances(io.group, 'io', unitCylinder, cavity, audioHoles, 'I/O / recessed audio sockets');
  plate(io.group, 'io', silver, [0, 0.707, 0], [0.70, 0.045, 2.98], 'I/O / continuous brushed shield cap', 0.055, 0.01);
  const ioSignalLeds = accent('io', LIME, 0.7, 0.7);
  instances(io.group, 'io', unitBox, ioSignalLeds, [
    { position: [-0.335, 0.57, -0.15], scale: [0.012, 0.045, 0.055] },
    { position: [-0.335, 0.57, 0.15], scale: [0.012, 0.045, 0.055] },
  ], 'I/O / Ethernet link LEDs');
  label(io.group, 'io', {
    variant: 'io', title: identity.domain.toUpperCase(), subtitle: identity.availability,
    description: contacts.map((contact) => `${contact.name}: ${contact.value}`).join(' / '),
    tech: contacts.map((contact) => contact.name), spec: identity.location, serial: identity.domain, index: 'I/O', accent: CYAN,
  }, 2.68, 0.49, [0, 0.731, 0], [-HALF_PI, 0, HALF_PI]);
  track(io, 0.17, 0.245, [-0.12, 0.65, -0.1], [0, 0.035, -0.025]);

  const fiberPieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i += 1) {
    const z = -1.14 + i * 0.57;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 0.34, z), new THREE.Vector3(-0.75, 0.36, z),
      new THREE.Vector3(-1.45, 0.52 + i * 0.045, z + (i - 2) * 0.12),
      new THREE.Vector3(-2.25 - (i % 2) * 0.25, 0.82 + i * 0.09, z + (i - 2) * 0.28),
    ], false, 'centripetal');
    fiberPieces.push(withColor(new THREE.TubeGeometry(curve, 36, 0.009, 5, false), [CYAN, LIME, GOLD, CYAN, GOLD][i]));
  }
  const fiberMaterial = ownMaterial(createPulseMaterial());
  fiberMaterial.name = 'I/O / contact fiber optic signal';
  const fibers = mesh(io.group, 'io', ownGeometry(mergedGeometry(fiberPieces)), fiberMaterial, [0, 0, 0], 'I/O / five outbound contact fibers', [0, 0, 0], false, false);
  fibers.renderOrder = 3;
  fibers.visible = false;

  group.userData.hardware = {
    footprint: [8.4, 6.8], pcbTop: 0.06, islandBottom: -0.8,
    powerRange: [0.22, 0.30], contactRange: [0.93, 1],
  };

  function update(progress: number, time: number, _delta: number, highlighted: HardwareId | null, reducedMotion: boolean): void {
    if (disposed) return;
    const p = Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 0;
    const clock = Number.isFinite(time) ? Math.max(0, time) : 0;
    const foundation = smooth(0.10, 0.20, p);
    island.position.set(0.78 * (1 - foundation), -0.32 * (1 - foundation), 0.58 * (1 - foundation));
    island.rotation.y = 0.032 * (1 - foundation);
    const surface = smooth(0.14, 0.185, p);
    carrier.visible = surface > 0;
    boardMaterial.opacity = substrate.opacity = surface;
    boardMaterial.depthWrite = substrate.depthWrite = surface === 1;
    if (pcbSilkscreen) pcbSilkscreen.opacity = smooth(0.15, 0.22, p);
    const details = smooth(0.16, 0.235, p);
    detailReveal.value = details;
    boardDetails.visible = details > 0;
    boardDetails.position.y = 0.06 * (1 - details);
    boardDetails.scale.y = Math.max(0.0001, details);
    carrier.position.set(island.position.x, island.position.y + 0.58 * (1 - foundation), island.position.z);
    carrier.rotation.y = island.rotation.y;
    const socketProgress = smooth(0.16, 0.23, p);
    sockets.visible = p >= 0.16;
    sockets.position.y = 0.22 * (1 - socketProgress);

    for (const animation of assembly) {
      const t = smooth(animation.start, animation.end, p);
      animation.part.group.visible = p >= animation.start;
      animation.part.group.position.copy(animation.rest).addScaledVector(animation.offset, 1 - t);
      animation.part.group.rotation.set(animation.tilt[0] * (1 - t), animation.tilt[1] * (1 - t), animation.tilt[2] * (1 - t));
    }
    // Drives drop in, slide into the open-throat slot at an angle, then pivot flat onto their standoff.
    nvmeParts.forEach((drive, index) => {
      const pose = nvmeInstallPose(index, p);
      drive.group.visible = p >= NVME_DRIVES[index].start;
      drive.group.position.copy(pose.position);
      drive.group.quaternion.copy(pose.quaternion);
    });
    // Open wide before the processor descends; close only once it is fully seated.
    retention.rotation.x = loadPlateRotation(p);

    latchSpecs.forEach((spec, index) => {
      const module = Math.floor(index / 2);
      const side = index % 2 === 0 ? -1 : 1;
      const latch = 1 - smooth(0.665 + module * 0.035, 0.685 + module * 0.035, p);
      dummy.position.set(...spec.position);
      dummy.scale.set(...spec.scale);
      dummy.rotation.set(side * 0.36 * latch, 0, 0);
      dummy.updateMatrix();
      ramLatches.setMatrixAt(index, dummy.matrix);
    });
    ramLatches.instanceMatrix.needsUpdate = true;

    const power = smooth(0.22, 0.30, p);
    circuits.update(p, power, clock, reducedMotion, highlighted === 'pcb');
    for (const target of highlightTargets) {
      let seated = 1;
      if (target.id === 'cpu') seated = smooth(0.397, 0.435, p);
      else if (target.id === 'gpu') seated = smooth(0.55, 0.585, p);
      else if (target.id.startsWith('ram-')) {
        const moduleIndex = Number(target.id.slice(-1));
        seated = smooth(0.665 + moduleIndex * 0.035, 0.685 + moduleIndex * 0.035, p);
      } else if (target.id.startsWith('nvme-') || target.id === 'pch') seated = smooth(0.84, 0.90, p);
      target.material.emissiveIntensity = target.idle * power * seated + (highlighted === target.id ? target.boost : 0);
    }
    const fanPower = smooth(0.55, 0.585, p) * power;
    fanRotors.forEach((rotor, index) => {
      rotor.rotation.y = reducedMotion ? index * 0.37 : clock * (2.0 + index * 0.13) * fanPower + index * 0.37;
    });
    const contact = smooth(0.93, 1.0, p);
    fibers.visible = p > 0.93;
    fiberMaterial.uniforms.uTime.value = reducedMotion ? 0 : clock;
    fiberMaterial.uniforms.uPowerProgress.value = smooth(0.93, 0.97, p);
    fiberMaterial.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
    fiberMaterial.uniforms.uHighlight.value = highlighted === 'io' ? 1 : 0;
    fiberMaterial.uniforms.uReveal.value = contact;
    group.updateMatrixWorld(true);
  }

  update(0, 0, 0, null, true);

  return {
    group,
    components,
    anchors,
    pickables,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      circuits.dispose();
      instanceMeshes.forEach((instance) => instance.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => {
        texture.dispose();
        const canvas = texture.image as HTMLCanvasElement;
        if (canvas && typeof canvas.getContext === 'function') {
          canvas.width = 1;
          canvas.height = 1;
        }
      });
      group.removeFromParent();
      group.clear();
      components.forEach((component) => { component.meshes.length = 0; });
      components.clear();
      anchors.clear();
      pickables.length = 0;
      geometries.clear();
      materials.clear();
      textures.clear();
      highlightTargets.length = 0;
      assembly.length = 0;
      instanceMeshes.length = 0;
      ramParts.length = 0;
    },
  };
}
