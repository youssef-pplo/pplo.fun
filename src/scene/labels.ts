import * as THREE from 'three';

export type HardwareLabelVariant = 'processor' | 'graphics' | 'memory' | 'storage' | 'chipset' | 'pcb' | 'identity' | 'io';

export interface SilkscreenMark {
  text: string;
  /** Normalized board coordinates; y runs from the rear (-z) to the front (+z). */
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface HardwareLabelConfig {
  renderer: THREE.WebGLRenderer;
  title: string;
  subtitle?: string;
  description?: string;
  tech?: readonly string[];
  spec?: string;
  serial?: string;
  index?: string;
  variant?: HardwareLabelVariant;
  /** Physical width / height of the receiving surface, not the canvas. */
  aspect?: number;
  accent?: string;
  markings?: readonly SilkscreenMark[];
}

const DISPLAY = '"Space Grotesk Variable", "Space Grotesk", Arial, sans-serif';
const MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
}

function font(context: CanvasRenderingContext2D, size: number, weight = 500, mono = false): void {
  context.font = `${weight} ${size}px ${mono ? MONO : DISPLAY}`;
}

function fittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = 600,
  mono = false,
): void {
  font(context, size, weight, mono);
  const measured = context.measureText(text).width;
  if (measured > maxWidth) font(context, Math.max(8, size * maxWidth / measured), weight, mono);
  let fitted = text;
  if (context.measureText(fitted).width > maxWidth) {
    while (fitted.length > 0 && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
    fitted += '…';
  }
  context.fillText(fitted, x, y);
}

function wrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.trim().split(/\s+/);
  let line = '';
  let row = 0;
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (context.measureText(next).width > width && line) {
      if (row === maxLines - 1) {
        while (line.length > 0 && context.measureText(`${line}…`).width > width) line = line.slice(0, -1);
        context.fillText(`${line}…`, x, y + row * lineHeight);
        return row + 1;
      }
      context.fillText(line, x, y + row * lineHeight);
      row += 1;
      line = words[i];
    } else {
      line = next;
    }
  }
  if (line && row < maxLines) context.fillText(line, x, y + row * lineHeight);
  return row + 1;
}

function barcode(context: CanvasRenderingContext2D, random: () => number, x: number, y: number, width: number, height: number): void {
  let cursor = x;
  while (cursor < x + width) {
    const bar = 1.5 + Math.floor(random() * 3) * 1.5;
    context.fillRect(cursor, y, Math.min(bar, x + width - cursor), height * (random() > 0.09 ? 1 : 0.78));
    cursor += bar + 1.5 + Math.floor(random() * 3);
  }
}

function circuitMotif(
  context: CanvasRenderingContext2D,
  random: () => number,
  width: number,
  height: number,
  color: string,
): void {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.globalAlpha = 0.18;
  for (let i = 0; i < 18; i += 1) {
    const x = 28 + random() * width * 0.8;
    const y = 24 + random() * Math.max(10, height - 48);
    const length = 24 + random() * 95;
    const diagonal = Math.min(24 + random() * 32, height * 0.13);
    const sign = random() > 0.5 ? 1 : -1;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y);
    context.lineTo(x + length + diagonal, y + diagonal * sign);
    context.lineTo(x + length + diagonal + 20, y + diagonal * sign);
    context.stroke();
    context.beginPath();
    context.arc(x, y, 2.4, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function metallicBackground(
  context: CanvasRenderingContext2D,
  random: () => number,
  width: number,
  height: number,
  silver: boolean,
): void {
  const gradient = context.createLinearGradient(0, 0, width, height);
  if (silver) {
    gradient.addColorStop(0, '#a6aeb0');
    gradient.addColorStop(0.32, '#e1e4df');
    gradient.addColorStop(0.62, '#bdc5c4');
    gradient.addColorStop(1, '#8e999b');
  } else {
    gradient.addColorStop(0, '#222b2f');
    gradient.addColorStop(0.42, '#11191d');
    gradient.addColorStop(1, '#202a2c');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // Fine, deterministic brushing stays below the lettering's contrast threshold.
  context.save();
  context.lineWidth = 0.55;
  for (let y = 0; y < height; y += 1.7) {
    context.strokeStyle = random() > 0.5 ? '#ffffff' : '#000000';
    context.globalAlpha = silver ? 0.025 + random() * 0.04 : 0.012 + random() * 0.022;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y + random() * 0.3);
    context.stroke();
  }
  for (let i = 0; i < 1300; i += 1) {
    context.globalAlpha = 0.025 + random() * 0.03;
    context.fillStyle = random() > 0.5 ? '#ffffff' : '#000000';
    context.fillRect(random() * width, random() * height, 0.6 + random() * 1.1, 0.6);
  }
  context.restore();
}

function pinStrip(context: CanvasRenderingContext2D, width: number, height: number, silver: boolean): void {
  context.save();
  context.fillStyle = silver ? '#626c6c' : '#9d8861';
  context.globalAlpha = silver ? 0.35 : 0.52;
  const count = 42;
  const gap = (width - 104) / count;
  for (let i = 0; i < count; i += 1) {
    if (i === 12 || i === 13) continue;
    context.fillRect(52 + i * gap, height - 12, gap * 0.52, 12);
  }
  context.restore();
}

function silkscreen(
  context: CanvasRenderingContext2D,
  config: HardwareLabelConfig,
  random: () => number,
  width: number,
  height: number,
): void {
  const ink = '#c4d6d0';
  context.strokeStyle = ink;
  context.fillStyle = ink;
  context.globalAlpha = 0.72;
  context.lineWidth = 1.8;
  const inset = 22;
  const cut = 22;
  context.beginPath();
  context.moveTo(inset + cut, inset);
  context.lineTo(width - inset - cut, inset);
  context.lineTo(width - inset, inset + cut);
  context.lineTo(width - inset, height - inset - cut);
  context.lineTo(width - inset - cut, height - inset);
  context.lineTo(inset + cut, height - inset);
  context.lineTo(inset, height - inset - cut);
  context.lineTo(inset, inset + cut);
  context.closePath();
  context.stroke();

  for (let i = 0; i < 44; i += 1) {
    const x = 52 + i * (width - 104) / 43;
    const tick = i % 5 === 0 ? 9 : 4;
    context.fillRect(x, 25, 1, tick);
    context.fillRect(x, height - 25 - tick, 1, tick);
  }

  context.globalAlpha = 0.95;
  fittedText(context, config.title, width * 0.365, 72, width * 0.52, 38, 700);
  context.globalAlpha = 0.75;
  fittedText(context, config.subtitle ?? '', width * 0.365, 94, width * 0.52, 14, 600, true);
  fittedText(context, config.spec ?? '', 48, height - 43, width * 0.70, 13, 600, true);
  fittedText(context, config.serial ?? '', width - 218, height - 43, 170, 14, 600, true);

  for (const mark of config.markings ?? []) {
    context.save();
    context.translate(mark.x * width, mark.y * height);
    context.rotate(mark.rotation ?? 0);
    context.globalAlpha = 0.80;
    font(context, 13, 600, true);
    context.fillText(mark.text, 0, -6);
    if (mark.width && mark.height) {
      context.lineWidth = 1.5;
      context.setLineDash([5, 4]);
      context.strokeRect(0, 0, mark.width * width, mark.height * height);
      context.setLineDash([]);
      context.fillRect(0, 0, 6, 6);
    }
    context.restore();
  }

  context.globalAlpha = 0.42;
  for (const [x, y] of [[0.05, 0.08], [0.95, 0.08], [0.05, 0.92], [0.95, 0.92], [0.51, 0.50]]) {
    context.beginPath();
    context.arc(x * width, y * height, 10, 0, Math.PI * 2);
    context.moveTo(x * width - 15, y * height);
    context.lineTo(x * width + 15, y * height);
    context.moveTo(x * width, y * height - 15);
    context.lineTo(x * width, y * height + 15);
    context.stroke();
  }
  barcode(context, random, width * 0.83, height * 0.52, width * 0.10, height * 0.025);
  context.globalAlpha = 1;
}

function compactLabel(
  context: CanvasRenderingContext2D,
  config: HardwareLabelConfig,
  random: () => number,
  width: number,
  height: number,
  foreground: string,
  secondary: string,
): void {
  const padding = Math.max(18, height * 0.13);
  const textWidth = width * 0.78 - padding;
  context.fillStyle = config.accent ?? '#d3ff65';
  context.fillRect(0, 0, 7, height);
  context.fillStyle = foreground;
  fittedText(context, config.title, padding, height * 0.43, textWidth, height * 0.34, 700);
  context.fillStyle = secondary;
  fittedText(context, config.tech?.join('  /  ') || config.subtitle || '', padding, height * 0.73, textWidth, height * 0.14, 500, true);
  context.fillStyle = foreground;
  barcode(context, random, width * 0.85, height * 0.21, width * 0.10, height * 0.40);
  fittedText(context, config.index ?? 'PPLO', width * 0.85, height * 0.82, width * 0.10, height * 0.15, 600, true);
}

function fullLabel(
  context: CanvasRenderingContext2D,
  config: HardwareLabelConfig,
  random: () => number,
  width: number,
  height: number,
  silver: boolean,
): void {
  const foreground = silver ? '#202d32' : '#e3ebe5';
  const secondary = silver ? '#47565b' : '#91a3a2';
  const accent = silver ? '#42594d' : config.accent ?? '#d3ff65';
  if (height < 160) {
    compactLabel(context, config, random, width, height, foreground, secondary);
    return;
  }

  const pad = 52;
  const wide = height < 430;
  const titleSize = Math.min(86, height * (wide ? 0.18 : 0.093));
  const headerY = wide ? height * 0.18 : height * 0.13;
  context.strokeStyle = silver ? '#667578' : '#52645e';
  context.lineWidth = 1.5;
  context.strokeRect(23, 23, width - 46, height - 46);
  context.fillStyle = accent;
  context.fillRect(23, 23, 90, 4);
  context.fillRect(width - 113, height - 27, 90, 4);

  context.fillStyle = secondary;
  fittedText(context, config.subtitle ?? config.variant?.toUpperCase() ?? '', pad, headerY, width - pad * 2 - 80, Math.max(12, Math.min(19, height * 0.045)), 500, true);
  context.fillStyle = accent;
  fittedText(context, config.index ?? '', width - 130, headerY, 78, Math.max(16, height * 0.045), 600, true);

  const titleY = wide ? height * 0.41 : height * 0.30;
  context.fillStyle = foreground;
  fittedText(context, config.title, pad, titleY, width - pad * 2, titleSize, 700);

  const dividerY = titleY + (wide ? 20 : 36);
  context.strokeStyle = secondary;
  context.globalAlpha = 0.5;
  context.beginPath();
  context.moveTo(pad, dividerY);
  context.lineTo(width - pad, dividerY);
  context.stroke();
  context.globalAlpha = 1;

  if (config.description) {
    context.fillStyle = secondary;
    const bodySize = Math.max(12, Math.min(27, height * 0.034));
    font(context, bodySize, 400);
    wrappedText(context, config.description, pad, dividerY + bodySize * 1.8, width - pad * 2 - (wide ? 152 : 0), bodySize * 1.5, wide ? (height < 260 ? 1 : 2) : 4);
  }

  const techY = wide ? height * 0.73 : height * 0.66;
  if (config.tech?.length) {
    context.fillStyle = accent;
    if (config.variant === 'storage' && wide) {
      const techSize = Math.max(10, Math.min(13, height * 0.045));
      font(context, techSize, 500, true);
      wrappedText(context, config.tech.join(' / '), pad, height * 0.64, width - pad * 2, techSize * 1.35, 3);
    } else {
      fittedText(context, config.tech.join('  /  '), pad, techY, width - pad * 2, Math.max(12, Math.min(24, height * 0.035)), 600, true);
    }
  }
  context.fillStyle = secondary;
  fittedText(context, config.spec ?? '', pad, wide ? height * 0.84 : height * 0.75, width - pad * 2, Math.max(10, Math.min(18, height * 0.026)), 500, true);

  context.fillStyle = foreground;
  const barcodeY = wide ? height * 0.50 : height * 0.83;
  barcode(context, random, wide ? width - 179 : pad, barcodeY, wide ? 123 : 250, wide ? height * 0.12 : height * 0.055);
  if (!wide) {
    context.fillStyle = secondary;
    fittedText(context, config.serial ?? '', 340, height * 0.87, width - 392, Math.min(20, height * 0.023), 500, true);
  }
  pinStrip(context, width, height, silver);
}

/** A self-contained, high-definition asset-free engraved hardware decal. The caller owns disposal. */
export function createHardwareLabelTexture(config: HardwareLabelConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const aspect = THREE.MathUtils.clamp(config.aspect ?? 1, 0.5, 32);

  let width: number;
  let height: number;
  if (config.variant === 'pcb') {
    width = 2048;
    height = 2048;
  } else if (aspect >= 1) {
    if (aspect > 8) {
      width = 4096;
      height = Math.max(256, Math.round(width / aspect));
    } else {
      width = 2048;
      height = Math.max(256, Math.round(2048 / aspect));
    }
  } else {
    height = 2048;
    width = Math.max(256, Math.round(2048 * aspect));
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Hardware labels require a Canvas 2D rendering context.');

  const scale = width / 1024;
  context.save();
  context.scale(scale, scale);
  const w = 1024;
  const h = height / scale;

  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  const random = seededRandom(`${config.title}/${config.serial ?? ''}/${config.index ?? ''}`);
  if (config.variant === 'pcb') {
    silkscreen(context, config, random, w, h);
  } else {
    const silver = config.variant === 'processor';
    metallicBackground(context, random, w, h, silver);
    circuitMotif(context, random, w, h, silver ? '#354b50' : '#a5c4b6');
    fullLabel(context, config, random, w, h, silver);
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `engraving:${config.variant ?? 'hardware'}:${config.title}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.max(4, config.renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
