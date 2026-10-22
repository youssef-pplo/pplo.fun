import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import type { LoadPlate } from '../src/scene/cpu-install';
import { CPU_ASSEMBLY, LOAD_PLATE, cpuInstallPose, loadPlateOpening, loadPlateRotation } from '../src/scene/cpu-install';

// Processor volumes in the processor's own frame (see createHardware): organic substrate and heat spreader.
const substrate = { min: new Vector3(-0.89, -0.05, -0.865), max: new Vector3(0.89, 0.03, 0.865) };
const spreader = { min: new Vector3(-0.77, 0.026, -0.745), max: new Vector3(0.77, 0.14, 0.745) };
const TOUCH = 0.004; // surfaces may touch; they may not interpenetrate.

const inside = (box: typeof substrate, point: Vector3): boolean => point.x > box.min.x + TOUCH && point.x < box.max.x - TOUCH
  && point.y > box.min.y + TOUCH && point.y < box.max.y - TOUCH && point.z > box.min.z + TOUCH && point.z < box.max.z - TOUCH;

/** Points on the plate frame (the window is open), expressed in the plate's own hinge frame. */
function plateFramePoints(plate: LoadPlate): Vector3[] {
  const points: Vector3[] = [];
  const [width, thickness, depth] = plate.size;
  const [windowX, windowZ] = plate.window;
  for (let x = -width / 2; x <= width / 2 + 1e-9; x += 0.04) {
    for (let d = 0; d <= depth + 1e-9; d += 0.04) {
      const z = d - depth / 2;
      if (Math.abs(x) < windowX / 2 && Math.abs(z) < windowZ / 2) continue;
      for (const y of [-thickness / 2, 0, thickness / 2]) points.push(new Vector3(x, y, d));
    }
  }
  return points;
}

function worstOverlap(plate: LoadPlate, assembly: typeof CPU_ASSEMBLY, progressSteps = 1000): { progress: number; hits: number } {
  const frame = plateFramePoints(plate);
  const world = new Vector3();
  const local = new Vector3();
  const matrix = new Matrix4();
  const hingeRotation = new Matrix4();
  let worst = { progress: 0, hits: 0 };
  for (let step = 0; step <= progressSteps; step += 1) {
    const progress = step / progressSteps;
    const pose = cpuInstallPose(progress, assembly);
    // Processor world -> local.
    matrix.compose(pose.position, pose.quaternion, new Vector3(1, 1, 1)).invert();
    hingeRotation.makeRotationX(loadPlateRotation(progress, plate));
    let hits = 0;
    for (const point of frame) {
      world.copy(point).applyMatrix4(hingeRotation).add(new Vector3(...plate.hinge));
      local.copy(world).applyMatrix4(matrix);
      if (inside(substrate, local) || inside(spreader, local)) hits += 1;
    }
    if (hits > worst.hits) worst = { progress, hits };
  }
  return worst;
}

describe('CPU install vs hinged load plate', () => {
  // The configuration shipped before the fix: open to ~69°, rim level with the substrate, closing at 0.40.
  const legacy: LoadPlate = { ...LOAD_PLATE, hinge: [-1.0, 0.283, -2.035], openAngle: 1.2, closeStart: 0.40, closeEnd: 0.45 };

  it('detects the original bug: the processor drops through the plate', () => {
    expect(worstOverlap(legacy, CPU_ASSEMBLY).hits).toBeGreaterThan(0);
  });

  it('never lets the processor and the plate occupy the same space at any scroll position', () => {
    const worst = worstOverlap(LOAD_PLATE, CPU_ASSEMBLY);
    expect(worst, `interpenetration near progress ${worst.progress}`).toEqual({ progress: 0, hits: 0 });
  });

  it('is fully reversible: the pose is a pure function of progress', () => {
    for (const p of [0.31, 0.35, 0.40, 0.43, 0.44, 0.46]) {
      expect(loadPlateRotation(p)).toBe(loadPlateRotation(p));
      expect(cpuInstallPose(p).position.toArray()).toEqual(cpuInstallPose(p).position.toArray());
    }
  });

  it('opens before the processor arrives and only closes after it has finished seating', () => {
    expect(loadPlateOpening(LOAD_PLATE.openEnd)).toBeCloseTo(1, 6);
    expect(loadPlateOpening(LOAD_PLATE.closeStart)).toBeCloseTo(1, 6);
    expect(LOAD_PLATE.closeStart).toBeGreaterThanOrEqual(CPU_ASSEMBLY.end - 0.005);
    expect(LOAD_PLATE.openEnd).toBeLessThan(CPU_ASSEMBLY.start + 0.05);
    expect(loadPlateOpening(LOAD_PLATE.closeEnd)).toBe(0);
    expect(loadPlateOpening(0)).toBe(0);
    expect(loadPlateOpening(1)).toBe(0);
  });

  it('seats the processor exactly at rest with no residual tilt when the plate begins to close', () => {
    const pose = cpuInstallPose(LOAD_PLATE.closeStart);
    expect(pose.position.distanceTo(new Vector3(-1.0, 0.3, -1.0))).toBeLessThan(0.005);
    expect(Math.abs(pose.quaternion.w) - 1).toBeLessThan(1e-4);
  });

  it('clamps the closed plate on top of the substrate rim, not through it', () => {
    const closedBottom = LOAD_PLATE.hinge[1] - LOAD_PLATE.size[1] / 2;
    const substrateTop = 0.3 + substrate.max.y;
    expect(closedBottom).toBeGreaterThanOrEqual(substrateTop - 1e-9);
    // The heat spreader fits through the window with clearance on every side.
    expect(LOAD_PLATE.window[0] / 2).toBeGreaterThan(spreader.max.x);
    expect(LOAD_PLATE.window[1] / 2).toBeGreaterThan(spreader.max.z);
  });
});
