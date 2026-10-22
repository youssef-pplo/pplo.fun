import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Box } from '../src/scene/nvme-install';
import { NVME_BODY, NVME_DRIVES, NVME_POST, NVME_REST_Y, NVME_REST_Z, NVME_SOCKET, nvmeInstallPose, socketBoxes } from '../src/scene/nvme-install';

const TOUCH = 0.004; // surfaces may touch; they may not interpenetrate.

const strictlyInside = (box: Box, p: Vector3): boolean => p.x > box.min[0] + TOUCH && p.x < box.max[0] - TOUCH
  && p.y > box.min[1] + TOUCH && p.y < box.max[1] - TOUCH && p.z > box.min[2] + TOUCH && p.z < box.max[2] - TOUCH;

function sampleBox(box: Box, step = 0.05): Vector3[] {
  const points: Vector3[] = [];
  const axes = [0, 1, 2].map((i) => {
    const values: number[] = [];
    for (let v = box.min[i]; v < box.max[i]; v += step) values.push(v);
    values.push(box.max[i]);
    return values;
  });
  for (const x of axes[0]) for (const y of axes[1]) for (const z of axes[2]) points.push(new Vector3(x, y, z));
  return points;
}

interface Scene {
  /** World-space pose of drive `index` at `progress`. */
  pose: (index: number, progress: number) => Matrix4;
  /** Static obstacles for drive `index` (socket jaws, standoff). */
  obstacles: (index: number) => Box[];
}

const bodyPoints = [...sampleBox(NVME_BODY.pcb), ...sampleBox(NVME_BODY.spreader)];

function sweep(scene: Scene, steps = 800): { index: number; progress: number; hits: number; what: string } {
  const world = new Vector3();
  let worst = { index: -1, progress: 0, hits: 0, what: 'none' };
  for (let index = 0; index < NVME_DRIVES.length; index += 1) {
    const obstacles = scene.obstacles(index);
    for (let step = 0; step <= steps; step += 1) {
      const progress = 0.78 + (step / steps) * 0.2;
      const matrix = scene.pose(index, progress);
      const other = scene.pose(1 - index, progress);
      const otherHidden = progress < NVME_DRIVES[1 - index].start;
      let hits = 0;
      let what = '';
      for (const point of bodyPoints) {
        world.copy(point).applyMatrix4(matrix);
        if (obstacles.some((box) => strictlyInside(box, world))) { hits += 1; what = 'socket/standoff'; }
        if (!otherHidden) {
          // The neighbouring drive, tested in its own frame.
          const local = world.clone().applyMatrix4(other.clone().invert());
          if ([NVME_BODY.pcb, NVME_BODY.spreader].some((box) => strictlyInside(box, local))) { hits += 1; what = 'neighbouring drive'; }
        }
      }
      if (hits > worst.hits) worst = { index, progress, hits, what };
    }
  }
  return worst;
}

const post = (driveX: number): Box => ({
  min: [driveX + NVME_POST.offsetX - NVME_POST.radius, NVME_POST.base, NVME_REST_Z - NVME_POST.radius],
  max: [driveX + NVME_POST.offsetX + NVME_POST.radius, NVME_POST.top, NVME_REST_Z + NVME_POST.radius],
});

const current: Scene = {
  pose: (index, progress) => {
    const p = nvmeInstallPose(index, progress);
    return new Matrix4().compose(p.position, p.quaternion, new Vector3(1, 1, 1));
  },
  obstacles: (index) => [...socketBoxes(NVME_DRIVES[index].x), post(NVME_DRIVES[index].x)],
};

// What shipped before: a straight drop with a small tilt through a solid socket block and a tall standoff.
const legacy: Scene = {
  pose: (index, progress) => {
    const drive = NVME_DRIVES[index];
    const legacyStart = [0.81, 0.825][index];
    const legacyEnd = [0.88, 0.895][index];
    const t = Math.min(1, Math.max(0, (progress - legacyStart) / (legacyEnd - legacyStart)));
    const eased = t * t * (3 - 2 * t);
    const remaining = 1 - eased;
    const position = new Vector3(drive.x, NVME_REST_Y, NVME_REST_Z).add(new Vector3(-0.16, 1.9 + index * 0.2, 0.26).multiplyScalar(remaining));
    const quaternion = new Quaternion().setFromEuler(new Euler(0.09 * remaining, -0.05 * remaining, 0));
    return new Matrix4().compose(position, quaternion, new Vector3(1, 1, 1));
  },
  obstacles: (index) => {
    const x = NVME_DRIVES[index].x - 1.15;
    return [
      { min: [x - 0.1, 0.06, NVME_REST_Z - 0.34], max: [x + 0.1, 0.2, NVME_REST_Z + 0.34] },
      { ...post(NVME_DRIVES[index].x), max: [NVME_DRIVES[index].x + NVME_POST.offsetX + NVME_POST.radius, 0.1425, NVME_REST_Z + NVME_POST.radius] },
    ];
  },
};

describe('M.2 install vs socket and standoff', () => {
  it('detects the original bug: the drive drops straight through the socket and standoff', () => {
    expect(sweep(legacy).hits).toBeGreaterThan(0);
  });

  it('never lets either drive interpenetrate its socket, standoff or neighbour at any scroll position', () => {
    const worst = sweep(current);
    expect(worst, `${worst.what} at progress ${worst.progress}`).toMatchObject({ hits: 0 });
  });

  it('rests exactly at the original seated pose', () => {
    for (let index = 0; index < NVME_DRIVES.length; index += 1) {
      const pose = nvmeInstallPose(index, NVME_DRIVES[index].end);
      expect(pose.position.distanceTo(new Vector3(NVME_DRIVES[index].x, NVME_REST_Y, NVME_REST_Z))).toBeLessThan(1e-6);
      expect(Math.abs(pose.quaternion.w)).toBeCloseTo(1, 6);
      expect(nvmeInstallPose(index, 1).position.toArray()).toEqual(nvmeInstallPose(index, NVME_DRIVES[index].end).position.toArray());
    }
  });

  it('is a pure function of progress, so scrolling backward reverses the install', () => {
    for (const p of [0.8, 0.83, 0.85, 0.87, 0.89]) {
      expect(nvmeInstallPose(0, p).position.toArray()).toEqual(nvmeInstallPose(0, p).position.toArray());
    }
  });

  it('keeps the slot taller than the board so it can enter at an angle', () => {
    const gap = NVME_SOCKET.upperBottom - NVME_SOCKET.lowerTop;
    expect(gap).toBeGreaterThan(NVME_BODY.pcb.max[1] - NVME_BODY.pcb.min[1]);
    // The standoff supports the board's underside when it is flat.
    expect(NVME_POST.top).toBeCloseTo(NVME_REST_Y + NVME_BODY.pcb.min[1], 6);
  });
});
