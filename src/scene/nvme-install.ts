import { Quaternion, Vector3 } from 'three';
import { smoothstep } from './choreography';

type Triple = readonly [number, number, number];

export interface Box {
  min: Triple;
  max: Triple;
}

/** Carrier-space rest of the two M.2 drives (the PCB's centre line). */
export const NVME_DRIVES = [
  { x: -2.3, start: 0.81, end: 0.88 },
  { x: 0.5, start: 0.825, end: 0.895 },
] as const;
export const NVME_REST_Y = 0.12;
export const NVME_REST_Z = 2.8;

/** Drive dimensions in the drive's own frame (see createHardware). */
export const NVME_BODY = {
  pcb: { min: [-1.125, -0.0275, -0.31], max: [1.125, 0.0275, 0.31] } as Box,
  spreader: { min: [-0.975, 0.044, -0.2825], max: [1.055, 0.128, 0.2825] } as Box,
  /** The edge connector tip: the pivot of the insertion. */
  tip: [-1.125, 0, 0] as Triple,
};

/**
 * A real M.2 slot: two jaws and a back wall around a slot that is a little taller than the board,
 * so the drive can be pushed in at an angle and then pivoted down onto its standoff.
 */
export const NVME_SOCKET = {
  /** Distance from the drive centre to the socket centre (negative = toward -x). */
  offsetX: -1.15,
  width: 0.2,
  depth: 0.68,
  baseY: 0.06,
  lowerTop: 0.0925,
  upperBottom: 0.2,
  top: 0.26,
  wall: 0.07,
};

export const NVME_POST = { offsetX: 1.02, radius: 0.048, base: 0.06, top: 0.0925 };

/** Staging pose: outside the slot mouth, raised end up. */
export const NVME_STAGE = { angle: 0.4, standoff: 0.36 };
export const NVME_DROP: Triple = [-0.16, 1.9, 0.26];

export function socketBoxes(driveX: number, socket = NVME_SOCKET): Box[] {
  const cx = driveX + socket.offsetX;
  const z = socket.depth / 2;
  const x0 = cx - socket.width / 2;
  const x1 = cx + socket.width / 2;
  return [
    { min: [x0, socket.baseY, -z + NVME_REST_Z], max: [x1, socket.lowerTop, z + NVME_REST_Z] },
    { min: [x0, socket.upperBottom, -z + NVME_REST_Z], max: [x1, socket.top, z + NVME_REST_Z] },
    { min: [x0, socket.lowerTop, -z + NVME_REST_Z], max: [x0 + socket.wall, socket.upperBottom, z + NVME_REST_Z] },
  ];
}

export interface NvmePose {
  position: Vector3;
  quaternion: Quaternion;
}

const axis = new Vector3(0, 0, 1);

/** Carrier-space pose of an M.2 drive: drop from above, slide in at an angle, then pivot flat. */
export function nvmeInstallPose(index: number, progress: number, out: NvmePose = { position: new Vector3(), quaternion: new Quaternion() }): NvmePose {
  const drive = NVME_DRIVES[index];
  const u = Math.min(1, Math.max(0, (progress - drive.start) / (drive.end - drive.start)));
  const descend = smoothstep(0, 0.45, u);
  const slide = smoothstep(0.45, 0.7, u);
  const pivot = smoothstep(0.7, 1, u);
  const angle = NVME_STAGE.angle * (1 - pivot);
  const standoff = NVME_STAGE.standoff * (1 - slide);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tip = new Vector3(...NVME_BODY.tip);
  const rotated = tip.clone().applyAxisAngle(axis, angle);
  // The tip stays on the board's own axis while sliding, then holds still while the far end swings down.
  out.position.set(drive.x + NVME_BODY.tip[0] + standoff * c, NVME_REST_Y + standoff * s, NVME_REST_Z)
    .sub(rotated)
    .addScaledVector(new Vector3(NVME_DROP[0], NVME_DROP[1] + 0.2 * index, NVME_DROP[2]), 1 - descend);
  out.quaternion.setFromAxisAngle(axis, angle);
  return out;
}
