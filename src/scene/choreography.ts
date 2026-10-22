import { CatmullRomCurve3, Vector3 } from 'three';
import { chapters } from '../data';

type Point = readonly [number, number, number];
interface CameraKey {
  at: number;
  position: Point;
  target: Point;
  focal: number;
}

/**
 * Phones and portrait tablets stack the chapter text above the board; landscape screens put it beside it.
 * Keep in sync with the `(max-width: 760px), (max-width: 1100px) and (orientation: portrait)` CSS queries.
 */
export const isPortraitLayout = (width: number, height: number): boolean => width <= 760 || (width <= 1100 && height > width);

export const clamp01 = (value: number): number => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
export function smoothstep(start: number, end: number, value: number): number {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}

export function getChapterIndex(progress: number): number {
  const p = clamp01(progress);
  const index = chapters.findIndex((chapter, i) => p >= chapter.range[0] && (p < chapter.range[1] || i === chapters.length - 1));
  return Math.max(0, index);
}

export function getRamIndex(progress: number): number {
  // Decimal chapter boundaries such as .71 must not fall one ULP into the previous module.
  return Math.min(3, Math.floor(clamp01((progress - 0.62) / 0.18) * 4 + Number.EPSILON * 16));
}

export const powerAt = (progress: number): number => smoothstep(0.22, 0.30, progress);

// Timed spline knots create rests for reading, rather than making every chapter a fly-through.
const keys: readonly CameraKey[] = [
  { at: 0, position: [12.5, 10.8, 15.5], target: [0, 1.0, 0], focal: 35 },
  { at: 0.075, position: [10.5, 8.8, 13.0], target: [0, 1.25, 0], focal: 35 },
  { at: 0.14, position: [12.0, 13.8, 14.0], target: [0, 0.2, 0], focal: 35 },
  { at: 0.25, position: [10.8, 12.5, 12.8], target: [0, 0.15, 0], focal: 38 },
  { at: 0.30, position: [6.0, 7.6, 8.0], target: [-0.9, 0.6, -1], focal: 52 },
  { at: 0.36, position: [5.0, 8.0, 7.4], target: [-1, 1.7, -1], focal: 78 },
  { at: 0.43, position: [3.7, 6.7, 6.0], target: [-1, 0.4, -1], focal: 85 },
  { at: 0.45, position: [7.8, 8.5, 10.5], target: [-0.6, 0.7, 0.7], focal: 51 },
  { at: 0.53, position: [9.1, 10.3, 12.3], target: [-0.7, 1.2, 1.45], focal: 48 },
  { at: 0.60, position: [8.4, 10.9, 11.7], target: [-0.7, 1.05, 1.45], focal: 51 },
  { at: 0.62, position: [9.0, 8.3, 8.8], target: [2.1, 0.7, -0.8], focal: 58 },
  { at: 0.67, position: [8.1, 7.8, 8.2], target: [1.8, 1.0, -0.9], focal: 63 },
  { at: 0.72, position: [8.6, 8.0, 8.3], target: [2.25, 0.9, -0.9], focal: 65 },
  { at: 0.77, position: [9.0, 8.2, 8.4], target: [2.8, 0.9, -0.9], focal: 65 },
  { at: 0.80, position: [8.4, 9.0, 13.4], target: [0.4, 0.2, 2.1], focal: 52 },
  { at: 0.86, position: [6.4, 8.5, 12.1], target: [-0.8, 0.4, 2.75], focal: 63 },
  { at: 0.91, position: [8.5, 9.0, 12.1], target: [1.3, 0.3, 2.6], focal: 56 },
  { at: 0.94, position: [12.7, 13.4, 15.5], target: [0, 0.4, 0], focal: 35 },
  { at: 1, position: [12.0, 13.0, 15.0], target: [0, 0.45, 0], focal: 35 },
];

export interface CameraPose {
  position: Vector3;
  target: Vector3;
  focalLength: number;
}

export const createCameraPose = (): CameraPose => ({ position: new Vector3(), target: new Vector3(), focalLength: 35 });

/** Allocation-free, reversible scroll-to-camera mapping through two coordinated splines. */
export class CameraChoreography {
  private readonly position = new CatmullRomCurve3(keys.map((key) => new Vector3(...key.position)), false, 'catmullrom', 0.18);
  private readonly target = new CatmullRomCurve3(keys.map((key) => new Vector3(...key.target)), false, 'catmullrom', 0.18);
  private readonly offset = new Vector3();

  sample(progress: number, portrait: boolean, reducedMotion: boolean, out: CameraPose): CameraPose {
    let p = clamp01(progress);
    if (reducedMotion) {
      const chapter = chapters[getChapterIndex(p)];
      p = (chapter.range[0] + chapter.range[1]) * 0.5;
    }
    let index = keys.findIndex((key, i) => i < keys.length - 1 && p >= key.at && p < keys[i + 1].at);
    if (index < 0) index = p >= 1 ? keys.length - 2 : 0;
    const from = keys[index];
    const to = keys[index + 1];
    const amount = smoothstep(from.at, to.at, p);
    const t = (index + amount) / (keys.length - 1);
    this.position.getPoint(t, out.position);
    this.target.getPoint(t, out.target);
    out.focalLength = from.focal + (to.focal - from.focal) * amount;

    if (portrait) {
      // A wider portrait lens keeps the island within the lower, unobstructed stage.
      this.offset.copy(out.position).sub(out.target).multiplyScalar(1.20);
      out.position.copy(out.target).add(this.offset);
      out.focalLength *= 0.78;
    }
    return out;
  }
}
