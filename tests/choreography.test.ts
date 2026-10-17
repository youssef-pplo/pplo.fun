import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { chapters } from '../src/data';
import {
  CameraChoreography,
  clamp01,
  createCameraPose,
  getChapterIndex,
  getRamIndex,
  powerAt,
  smoothstep,
} from '../src/scene/choreography';
import type { CameraPose } from '../src/scene/choreography';
import { expectedChapters, ramProgress } from './fixtures/portfolio';

const epsilon = 1e-8;
const boundaries = [0, 0.14, 0.30, 0.45, 0.62, 0.80, 0.92, 1] as const;
const progressSamples = [...new Set([
  ...Array.from({ length: 201 }, (_, index) => index / 200),
  ...boundaries.flatMap((boundary) => [boundary - epsilon, boundary, boundary + epsilon]),
])].sort((left, right) => left - right);

function snapshot(pose: CameraPose) {
  return { position: pose.position.toArray(), target: pose.target.toArray(), focalLength: pose.focalLength };
}

function expectFinitePose(pose: CameraPose, portrait: boolean): void {
  expect(pose.position).toBeInstanceOf(Vector3);
  expect(pose.target).toBeInstanceOf(Vector3);
  expect([...pose.position.toArray(), ...pose.target.toArray(), pose.focalLength].every(Number.isFinite)).toBe(true);
  expect(pose.position.distanceTo(pose.target)).toBeGreaterThan(1);
  expect(pose.focalLength).toBeGreaterThanOrEqual(35 * (portrait ? 0.78 : 1) - epsilon);
  expect(pose.focalLength).toBeLessThanOrEqual(85 * (portrait ? 0.78 : 1) + epsilon);

  const camera = new PerspectiveCamera(50, portrait ? 390 / 844 : 1440 / 900, 0.1, 200);
  camera.setFocalLength(pose.focalLength);
  expect(Number.isFinite(camera.fov)).toBe(true);
  expect(camera.fov).toBeGreaterThan(0);
  expect(camera.fov).toBeLessThan(120);
  expect(camera.getFocalLength()).toBeCloseTo(pose.focalLength, 10);
  expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
}

describe('chapter mapping', () => {
  it('covers the complete story with the seven specified contiguous ranges', () => {
    expect(chapters.map(({ id, range, hardware }) => ({ id, range, hardware }))).toEqual(expectedChapters);
    expect(chapters[0].range[0]).toBe(0);
    expect(chapters.at(-1)?.range[1]).toBe(1);
    chapters.forEach((chapter, index) => {
      expect(chapter.range[1]).toBeGreaterThan(chapter.range[0]);
      if (index > 0) expect(chapter.range[0]).toBe(chapters[index - 1].range[1]);
    });
  });

  it.each(boundaries.map((progress, index) => ({ progress, chapter: Math.min(index, 6) })))(
    'maps the exact boundary $progress to chapter $chapter',
    ({ progress, chapter }) => {
      expect(getChapterIndex(progress)).toBe(chapter);
    },
  );

  it.each(expectedChapters.slice(1).map((chapter, index) => ({ start: chapter.range[0], index: index + 1 })))(
    'uses left-closed, right-open intervals around $start',
    ({ start, index }) => {
      expect(getChapterIndex(start - epsilon)).toBe(index - 1);
      expect(getChapterIndex(start)).toBe(index);
      expect(getChapterIndex(start + epsilon)).toBe(index);
    },
  );

  it.each([
    { progress: -100, chapter: 0 },
    { progress: 100, chapter: 6 },
    { progress: Number.NaN, chapter: 0 },
    { progress: Number.POSITIVE_INFINITY, chapter: 0 },
    { progress: Number.NEGATIVE_INFINITY, chapter: 0 },
  ])('safely normalizes progress $progress', ({ progress, chapter }) => {
    expect(getChapterIndex(progress)).toBe(chapter);
  });
});

describe('clamping and power-up', () => {
  it.each([
    [-Number.MAX_VALUE, 0], [-1, 0], [-0, 0], [0, 0], [0.14, 0.14], [0.5, 0.5],
    [1, 1], [1 + epsilon, 1], [Number.MAX_VALUE, 1],
    [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], [Number.NEGATIVE_INFINITY, 0],
  ])('clamp01(%s) returns %s', (input, expected) => {
    expect(clamp01(input)).toBe(expected);
  });

  it('always returns an idempotent finite unit value', () => {
    for (const input of progressSamples) {
      const output = clamp01(input);
      expect(Number.isFinite(output)).toBe(true);
      expect(output).toBeGreaterThanOrEqual(0);
      expect(output).toBeLessThanOrEqual(1);
      expect(clamp01(output)).toBe(output);
    }
  });

  it('smoothstep saturates at its endpoints and eases symmetrically', () => {
    expect(smoothstep(0.22, 0.30, -10)).toBe(0);
    expect(smoothstep(0.22, 0.30, 0.22)).toBe(0);
    expect(smoothstep(0.22, 0.30, 0.26)).toBeCloseTo(0.5, 12);
    expect(smoothstep(0.22, 0.30, 0.30)).toBe(1);
    expect(smoothstep(0.22, 0.30, 10)).toBe(1);
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(1 - smoothstep(0, 1, 0.75), 12);
    for (const input of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(smoothstep(0.22, 0.30, input)).toBe(0);
    }
  });

  it('powers up monotonically only over 0.22–0.30 without history dependence', () => {
    expect(powerAt(0.22)).toBe(0);
    expect(powerAt(0.26)).toBeCloseTo(0.5, 12);
    expect(powerAt(0.30)).toBe(1);
    const values = progressSamples.map(powerAt);
    values.forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      if (index > 0) expect(value).toBeGreaterThanOrEqual(values[index - 1]);
    });
    expect([...progressSamples].reverse().map(powerAt)).toEqual([...values].reverse());
  });
});

describe('four RAM modules', () => {
  it.each(ramProgress.map((progress, index) => ({ progress, index })))(
    'maps the midpoint $progress to module $index',
    ({ progress, index }) => {
      expect(getRamIndex(progress)).toBe(index);
    },
  );

  it.each([
    { progress: 0.62, index: 0 },
    { progress: 0.665, index: 1 },
    { progress: 0.71, index: 2 },
    { progress: 0.755, index: 3 },
    { progress: 0.80, index: 3 },
  ])('assigns exact RAM boundary $progress to module $index', ({ progress, index }) => {
    expect(getRamIndex(progress)).toBe(index);
    if (index > 0 && progress < 0.80) expect(getRamIndex(progress - epsilon)).toBe(index - 1);
    expect(getRamIndex(progress + epsilon)).toBe(index);
  });

  it('saturates outside the RAM chapter and never returns an invalid module', () => {
    expect(getRamIndex(-10)).toBe(0);
    expect(getRamIndex(0)).toBe(0);
    expect(getRamIndex(1)).toBe(3);
    expect(getRamIndex(10)).toBe(3);
    for (const progress of [...progressSamples, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const index = getRamIndex(progress);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(3);
    }
    expect(getRamIndex(Number.NaN)).toBe(0);
    expect(getRamIndex(Number.POSITIVE_INFINITY)).toBe(0);
    expect(getRamIndex(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('CameraChoreography', () => {
  it('creates independent real Vector3 outputs and samples without replacing them', () => {
    const choreography = new CameraChoreography();
    const out = createCameraPose();
    const other = createCameraPose();
    const position = out.position;
    const target = out.target;
    expect(position).not.toBe(target);
    expect(position).not.toBe(other.position);
    expect(target).not.toBe(other.target);
    expect(choreography.sample(0.53, false, false, out)).toBe(out);
    expect(out.position).toBe(position);
    expect(out.target).toBe(target);
    expect(other.position.toArray()).toEqual([0, 0, 0]);
    expect(other.target.toArray()).toEqual([0, 0, 0]);
  });

  it.each([
    { portrait: false, reducedMotion: false },
    { portrait: true, reducedMotion: false },
    { portrait: false, reducedMotion: true },
    { portrait: true, reducedMotion: true },
  ])('is finite and reversible (portrait=$portrait, reducedMotion=$reducedMotion)', ({ portrait, reducedMotion }) => {
    const choreography = new CameraChoreography();
    const out = createCameraPose();
    const forward = progressSamples.map((progress) => {
      choreography.sample(progress, portrait, reducedMotion, out);
      expectFinitePose(out, portrait);
      return snapshot(out);
    });
    [...progressSamples].reverse().forEach((progress, index) => {
      choreography.sample(progress, portrait, reducedMotion, out);
      expect(snapshot(out)).toEqual(forward[forward.length - 1 - index]);
    });
    for (const index of [87, 2, 120, 1, progressSamples.length - 1, 0, 87]) {
      expect(snapshot(choreography.sample(progressSamples[index], portrait, reducedMotion, out))).toEqual(forward[index]);
    }
  });

  it.each([
    { progress: 0, position: [12.5, 10.8, 15.5], target: [0, 1, 0], focal: 35 },
    { progress: 0.30, position: [6, 7.6, 8], target: [-0.9, 0.6, -1], focal: 52 },
    { progress: 0.43, position: [3.7, 6.7, 6], target: [-1, 0.4, -1], focal: 85 },
    { progress: 0.62, position: [9, 8.3, 8.8], target: [2.1, 0.7, -0.8], focal: 58 },
    { progress: 1, position: [12, 13, 15], target: [0, 0.45, 0], focal: 35 },
  ])('preserves camera rest $progress and its physical focal length', ({ progress, position, target, focal }) => {
    const pose = new CameraChoreography().sample(progress, false, false, createCameraPose());
    pose.position.toArray().forEach((value, index) => expect(value).toBeCloseTo(position[index], 10));
    pose.target.toArray().forEach((value, index) => expect(value).toBeCloseTo(target[index], 10));
    expect(pose.focalLength).toBeCloseTo(focal, 10);
  });

  it('widens portrait framing without moving the look-at target or accumulating offsets', () => {
    const choreography = new CameraChoreography();
    const landscape = createCameraPose();
    const portrait = createCameraPose();
    for (const progress of progressSamples) {
      choreography.sample(progress, false, false, landscape);
      choreography.sample(progress, true, false, portrait);
      expect(portrait.target.toArray()).toEqual(landscape.target.toArray());
      const expected = landscape.position.clone().sub(landscape.target).multiplyScalar(1.20).add(landscape.target);
      expect(portrait.position.distanceTo(expected)).toBeLessThan(epsilon);
      expect(portrait.focalLength).toBeCloseTo(landscape.focalLength * 0.78, 10);
      const before = snapshot(portrait);
      expect(snapshot(choreography.sample(progress, true, false, portrait))).toEqual(before);
    }
  });

  it.each(expectedChapters.map((chapter, index) => ({ range: chapter.range, index })))(
    'uses a stable chapter-midpoint camera for reduced-motion chapter $index',
    ({ range, index }) => {
      const choreography = new CameraChoreography();
      const midpoint = (range[0] + range[1]) / 2;
      const expected = snapshot(choreography.sample(midpoint, false, false, createCameraPose()));
      for (const progress of [range[0], midpoint, index === 6 ? 1 : range[1] - epsilon]) {
        expect(snapshot(choreography.sample(progress, false, true, createCameraPose()))).toEqual(expected);
      }
    },
  );

  it('does not jump at chapter boundaries when motion is enabled', () => {
    const choreography = new CameraChoreography();
    for (const boundary of boundaries.slice(1, -1)) {
      const before = choreography.sample(boundary - epsilon, false, false, createCameraPose());
      const after = choreography.sample(boundary + epsilon, false, false, createCameraPose());
      expect(before.position.distanceTo(after.position)).toBeLessThan(0.0001);
      expect(before.target.distanceTo(after.target)).toBeLessThan(0.0001);
      expect(Math.abs(before.focalLength - after.focalLength)).toBeLessThan(0.0001);
    }
  });

  it.each([
    { input: -100, normalized: 0 }, { input: 100, normalized: 1 },
    { input: Number.NaN, normalized: 0 },
    { input: Number.POSITIVE_INFINITY, normalized: 0 },
    { input: Number.NEGATIVE_INFINITY, normalized: 0 },
  ])('normalizes unsafe camera progress $input', ({ input, normalized }) => {
    const choreography = new CameraChoreography();
    for (const portrait of [false, true]) for (const reducedMotion of [false, true]) {
      const actual = choreography.sample(input, portrait, reducedMotion, createCameraPose());
      const expected = choreography.sample(normalized, portrait, reducedMotion, createCameraPose());
      expectFinitePose(actual, portrait);
      expect(snapshot(actual)).toEqual(snapshot(expected));
    }
  });
});
