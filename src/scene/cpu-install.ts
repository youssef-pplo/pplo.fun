import { Euler, Quaternion, Vector3 } from 'three';
import { smoothstep } from './choreography';

type Triple = readonly [number, number, number];

/** Carrier-space rest position of the processor once it is seated in the socket. */
export const CPU_REST: Triple = [-1.0, 0.3, -1.0];

/** The processor lowers from above and levels out as it seats. */
export const CPU_ASSEMBLY = {
  start: 0.32,
  end: 0.43,
  offset: [0.18, 3.5, -0.16] as Triple,
  tilt: [-0.1, 0.12, -0.05] as Triple,
} as const;

/**
 * The hinged load plate is a flat frame with an open centre for the heat spreader.
 * Closed, it clamps *on top of* the substrate rim (bottom face above the substrate top)
 * and the heat spreader passes through its window.
 */
export interface LoadPlate {
  hinge: Triple;
  size: Triple;
  window: readonly [number, number];
  openAngle: number;
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
}

export const LOAD_PLATE: LoadPlate = {
  /** Hinge axis in carrier space (the plate hangs off it toward +z). */
  hinge: [-1.0, 0.36, -2.035],
  size: [2.14, 0.05, 2.07],
  window: [1.61, 1.56],
  /** Fully open the plate leans back past vertical, clear of the processor's drop path. */
  openAngle: 2.0,
  openStart: 0.31,
  openEnd: 0.36,
  /** It only begins to close once the processor has finished seating. */
  closeStart: 0.428,
  closeEnd: 0.462,
};

/** 0 = closed on the processor, 1 = fully open. */
export function loadPlateOpening(progress: number, plate: LoadPlate = LOAD_PLATE): number {
  return smoothstep(plate.openStart, plate.openEnd, progress) * (1 - smoothstep(plate.closeStart, plate.closeEnd, progress));
}

/** Rotation about the hinge's X axis; negative lifts the free edge. */
export const loadPlateRotation = (progress: number, plate: LoadPlate = LOAD_PLATE): number => -plate.openAngle * loadPlateOpening(progress, plate);

export interface CpuInstallPose {
  position: Vector3;
  quaternion: Quaternion;
}

/** Carrier-space pose of the processor at a scroll progress. */
export function cpuInstallPose(progress: number, assembly = CPU_ASSEMBLY, out: CpuInstallPose = { position: new Vector3(), quaternion: new Quaternion() }): CpuInstallPose {
  const remaining = 1 - smoothstep(assembly.start, assembly.end, progress);
  out.position.set(...CPU_REST).addScaledVector(new Vector3(...assembly.offset), remaining);
  out.quaternion.setFromEuler(new Euler(assembly.tilt[0] * remaining, assembly.tilt[1] * remaining, assembly.tilt[2] * remaining));
  return out;
}
