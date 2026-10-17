import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CircuitRig {
  group: THREE.Group;
  update: (power: number, time: number, reducedMotion: boolean, highlighted: boolean) => void;
  dispose: () => void;
}

type Point = readonly [number, number];

const COPPER = new THREE.Color('#a28b55');
const CYAN = new THREE.Color('#00f0ff');
const BLUE = new THREE.Color('#3b82f6');
const GOLD = new THREE.Color('#f59e0b');

/** Axis-aligned runs with chamfered 45-degree turns; no freehand spline routing. */
function route(points: readonly Point[], y: number): THREE.CurvePath<THREE.Vector3> {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  let previous = new THREE.Vector3(points[0][0], y, points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const target = new THREE.Vector3(points[i][0], y, points[i][1]);
    const dx = target.x - previous.x;
    const dz = target.z - previous.z;
    const diagonal = Math.min(Math.abs(dx), Math.abs(dz));
    if (diagonal > 0.0001 && Math.abs(Math.abs(dx) - Math.abs(dz)) > 0.0001) {
      const bend = previous.clone().add(new THREE.Vector3(Math.sign(dx) * diagonal, 0, Math.sign(dz) * diagonal));
      curve.add(new THREE.LineCurve3(previous.clone(), bend));
      previous = bend;
    }
    if (previous.distanceToSquared(target) > 0.000001) curve.add(new THREE.LineCurve3(previous.clone(), target));
    previous = target;
  }
  return curve;
}

function coloredTube(points: readonly Point[], radius: number, y: number, color: THREE.Color): THREE.TubeGeometry {
  const curve = route(points, y);
  const segments = Math.max(12, Math.ceil(curve.getLength() * 7));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 4, false);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function combine(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('Could not batch procedural circuit traces.');
  return merged;
}

/** Shared by the motherboard data streams and the late-chapter contact fibers. */
export function createPulseMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'copper / traveling signal',
    uniforms: {
      uTime: { value: 0 },
      uPowerProgress: { value: 0 },
      uReducedMotion: { value: 0 },
      uHighlight: { value: 0 },
      uReveal: { value: 1 },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vSignalColor;
      void main() {
        vUv = uv;
        vSignalColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPowerProgress;
      uniform float uReducedMotion;
      uniform float uHighlight;
      uniform float uReveal;
      varying vec2 vUv;
      varying vec3 vSignalColor;
      void main() {
        if (vUv.x > uReveal) discard;
        float phase = fract(vUv.x * 2.7 - uTime * 0.78 * (1.0 - uReducedMotion) + vSignalColor.b * 0.23);
        float packet = smoothstep(0.56, 0.90, phase) * (1.0 - smoothstep(0.94, 1.0, phase));
        float front = smoothstep(vUv.x - 0.13, vUv.x + 0.04, uPowerProgress * 1.05);
        float rim = 0.62 + 0.38 * sin(vUv.y * 3.14159265);
        float strength = (0.18 + packet * 1.7) * front * uPowerProgress;
        vec3 signal = vSignalColor * (0.7 + packet * 1.4 + uHighlight * 0.45);
        gl_FragColor = vec4(signal, strength * rim);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Three draw calls for all copper, signal routes, and via rings on the board. */
export function createCircuitry(): CircuitRig {
  const group = new THREE.Group();
  group.name = 'PCB / etched copper + live data';
  const copperTubes: THREE.BufferGeometry[] = [];
  const signalTubes: THREE.BufferGeometry[] = [];
  const vias: THREE.Vector3[] = [];

  const trunks: readonly (readonly Point[])[] = [
    [[3.74, -0.56], [3.74, -2.63], [3.35, -3.02], [-0.56, -3.02], [-1.0, -2.58], [-1.0, -2.02]],
    [[-1.92, -1.0], [-2.67, -1.0], [-3.02, -1.35], [-3.40, -1.35]],
    [[-1.42, 0.02], [-2.66, 0.02], [-3.04, 0.40], [-3.04, 2.35], [-2.58, 2.81]],
    [[-0.46, 0.03], [-0.46, 0.30], [0.11, 0.87], [0.11, 1.06]],
    [[0.20, -1.51], [0.66, -1.51], [1.12, -1.97], [1.51, -1.97]],
    [[0.28, -0.32], [0.91, -0.32], [1.38, 0.15], [1.52, 0.15]],
    [[3.72, 0.25], [3.72, 0.71], [3.18, 1.25], [3.18, 1.52]],
    [[2.43, 2.13], [2.06, 2.13], [1.53, 2.66], [0.73, 2.66]],
    [[2.90, 2.78], [2.90, 2.94], [2.72, 3.12], [-0.36, 3.12]],
    [[-3.50, -2.86], [-3.15, -2.86], [-2.82, -2.53], [-2.82, -1.98]],
    [[-3.51, -0.02], [-3.68, 0.15], [-3.68, 2.41], [-3.31, 2.78]],
    [[1.67, -2.48], [1.67, -2.68], [1.42, -2.93], [0.31, -2.93]],
    [[2.17, -2.48], [2.17, -2.69], [1.94, -2.92], [1.74, -2.92]],
    [[2.67, -2.48], [2.67, -2.72], [2.47, -2.92], [2.28, -2.92]],
    [[3.17, -2.48], [3.17, -2.67], [3.40, -2.90], [3.54, -2.90]],
  ];

  trunks.forEach((points, index) => {
    for (let lane = 0; lane < 3; lane += 1) {
      const offset = (lane - 1) * 0.031;
      const parallel = points.map(([x, z]): Point => [x + offset, z + offset]);
      copperTubes.push(coloredTube(parallel, 0.0052, 0.069, index % 4 === 0 ? CYAN : COPPER));
    }
    signalTubes.push(coloredTube(points, 0.0105, 0.082, index % 3 === 0 ? GOLD : index % 3 === 1 ? CYAN : BLUE));
    for (const point of [points[0], points[points.length - 1]]) vias.push(new THREE.Vector3(point[0], 0.072, point[1]));
  });

  // Short, packed bus lanes supply the sense of density without dozens of materials.
  for (let i = 0; i < 40; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const lane = Math.floor(i / 2);
    const x = -2.49 + lane * 0.115;
    const z = side < 0 ? -2.34 : 0.28;
    const points: Point[] = [[x, z], [x + 0.12, z + side * 0.12], [x + 0.12, z + side * 0.30]];
    copperTubes.push(coloredTube(points, 0.0037, 0.068, COPPER));
    vias.push(new THREE.Vector3(x, 0.072, z));
  }

  const copperGeometry = combine(copperTubes);
  const signalGeometry = combine(signalTubes);
  const copperMaterial = new THREE.MeshStandardMaterial({
    name: 'etched copper / muted gold and cyan',
    vertexColors: true,
    metalness: 0.72,
    roughness: 0.44,
    envMapIntensity: 0.75,
  });
  const signalMaterial = createPulseMaterial();
  const copper = new THREE.Mesh(copperGeometry, copperMaterial);
  copper.name = '45-degree copper buses';
  const signal = new THREE.Mesh(signalGeometry, signalMaterial);
  signal.name = 'powered signal packets';
  signal.visible = false;
  signal.renderOrder = 2;
  group.add(copper, signal);

  const viaGeometry = new THREE.TorusGeometry(0.022, 0.0055, 4, 8);
  viaGeometry.rotateX(-Math.PI / 2);
  const viaMaterial = new THREE.MeshStandardMaterial({ color: '#aa9258', metalness: 0.78, roughness: 0.38 });
  const rings = new THREE.InstancedMesh(viaGeometry, viaMaterial, vias.length);
  rings.name = 'plated through-hole vias';
  const matrix = new THREE.Matrix4();
  vias.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z);
    rings.setMatrixAt(index, matrix);
  });
  rings.instanceMatrix.needsUpdate = true;
  rings.computeBoundingSphere();
  group.add(rings);
  group.traverse((object) => { object.userData.hardwareId = 'pcb'; });

  let disposed = false;
  return {
    group,
    update(power, time, reducedMotion, highlighted) {
      signal.visible = power > 0.001;
      signalMaterial.uniforms.uTime.value = reducedMotion ? 0 : time;
      signalMaterial.uniforms.uPowerProgress.value = power;
      signalMaterial.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
      signalMaterial.uniforms.uHighlight.value = highlighted ? 1 : 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      copperGeometry.dispose();
      signalGeometry.dispose();
      viaGeometry.dispose();
      copperMaterial.dispose();
      signalMaterial.dispose();
      viaMaterial.dispose();
      rings.dispose();
      group.clear();
    },
  };
}
