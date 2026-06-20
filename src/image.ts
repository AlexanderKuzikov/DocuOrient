import * as sharpModule from 'sharp';
import { EmptyImageError, ProcessingError, UnsupportedFormatError, UnsupportedImageError } from './errors.js';

type SharpFactory = (
  input?: sharpModule.SharpInput | sharpModule.SharpInput[],
  options?: sharpModule.SharpOptions
) => sharpModule.Sharp;

const sharp = (sharpModule as unknown as { default: SharpFactory }).default;

export interface GrayscaleImage {
  raw: Buffer;
  width: number;
  height: number;
  png: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function assertSupportedInput(input: unknown): asserts input is Buffer | Uint8Array {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    throw new TypeError('Input must be a Buffer or Uint8Array.');
  }
}

export function assertPngSignature(input: Buffer | Uint8Array): void {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new UnsupportedFormatError();
  }
}

export async function toGrayscalePng(input: Buffer | Uint8Array): Promise<GrayscaleImage> {
  try {
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
    assertPngSignature(bytes);
    const metadata = await sharp(bytes).metadata();

    if (!metadata.format || metadata.format !== 'png') {
      throw new UnsupportedFormatError();
    }

    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      throw new EmptyImageError();
    }

    const png = await sharp(bytes).toColourspace('b-w').png().toBuffer();
    const { info, data } = await sharp(png).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height || info.channels !== 1) {
      throw new UnsupportedImageError();
    }

    return {
      raw: data,
      width: info.width,
      height: info.height,
      png
    };
  } catch (error) {
    if (
      error instanceof UnsupportedFormatError ||
      error instanceof EmptyImageError ||
      error instanceof UnsupportedImageError
    ) {
      throw error;
    }

    if (isSharpInputError(error)) {
      throw new UnsupportedImageError();
    }

    throw new ProcessingError();
  }
}

export function rotateRaw(raw: Buffer, width: number, height: number, angle: 0 | 90 | 180 | 270): { raw: Buffer; width: number; height: number } {
  if (angle === 0) {
    return { raw, width, height };
  }

  const source = raw instanceof Buffer ? raw : Buffer.from(raw);
  const output = Buffer.alloc(width * height);

  if (angle === 90) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = y * width + x;
        const targetX = height - 1 - y;
        const targetY = x;
        output[targetY * height + targetX] = source[sourceIndex];
      }
    }

    return { raw: output, width: height, height: width };
  }

  if (angle === 180) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = y * width + x;
        const targetX = width - 1 - x;
        const targetY = height - 1 - y;
        output[targetY * width + targetX] = source[sourceIndex];
      }
    }

    return { raw: output, width, height };
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = y * width + x;
      const targetX = y;
      const targetY = width - 1 - x;
      output[targetY * height + targetX] = source[sourceIndex];
    }
  }

  return { raw: output, width: height, height: width };
}

export function rotateMask(mask: Uint8Array, width: number, height: number, angle: 0 | 90 | 180 | 270): { mask: Uint8Array; width: number; height: number } {
  const rotated = rotateRaw(Buffer.from(mask), width, height, angle);

  return {
    mask: new Uint8Array(rotated.raw),
    width: rotated.width,
    height: rotated.height
  };
}

export function thresholdToMask(raw: Buffer, width: number, height: number, threshold: number): Uint8Array {
  const mask = new Uint8Array(width * height);

  for (let index = 0; index < raw.length; index += 1) {
    mask[index] = raw[index] < threshold ? 1 : 0;
  }

  return mask;
}

export function projectionScore(mask: Uint8Array, width: number, height: number): number {
  const rowCount = height;
  const densities = new Float64Array(rowCount);
  let total = 0;

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    const rowStart = y * width;

    for (let x = 0; x < width; x += 1) {
      rowSum += mask[rowStart + x];
    }

    const density = rowSum / width;
    densities[y] = density;
    total += density;
  }

  const mean = total / rowCount;
  let variance = 0;

  for (let y = 0; y < rowCount; y += 1) {
    const delta = densities[y] - mean;
    variance += delta * delta;
  }

  return Math.sqrt(variance / rowCount);
}

export function brightnessByAxis(
  raw: Buffer,
  width: number,
  height: number,
  axis: 'horizontal' | 'vertical',
  ignoreBorderRatio: number
): { top?: number; bottom?: number; left?: number; right?: number; margin: number } {
  const safeIgnoreBorderRatio = clamp(ignoreBorderRatio, 0, 0.25);
  const borderX = Math.floor(width * safeIgnoreBorderRatio);
  const borderY = Math.floor(height * safeIgnoreBorderRatio);
  const cropX = borderX;
  const cropY = borderY;
  const cropWidth = Math.max(1, width - borderX * 2);
  const cropHeight = Math.max(1, height - borderY * 2);
  const thirdHeight = Math.floor(cropHeight / 3);
  const thirdWidth = Math.floor(cropWidth / 3);

  if (thirdHeight <= 0 || thirdWidth <= 0) {
    return { margin: 0 };
  }

  if (axis === 'horizontal') {
    const top = averageRegion(raw, width, cropX, cropY, cropWidth, thirdHeight);
    const bottom = averageRegion(raw, width, cropX, cropY + thirdHeight * 2, cropWidth, thirdHeight);
    return { top, bottom, margin: top - bottom };
  }

  const left = averageRegion(raw, width, cropX, cropY, thirdWidth, cropHeight);
  const right = averageRegion(raw, width, cropX + thirdWidth * 2, cropY, thirdWidth, cropHeight);
  return { left, right, margin: left - right };
}

function averageRegion(raw: Buffer, width: number, x: number, y: number, regionWidth: number, regionHeight: number): number {
  let sum = 0;
  let count = 0;

  for (let row = 0; row < regionHeight; row += 1) {
    const rowStart = (y + row) * width + x;

    for (let column = 0; column < regionWidth; column += 1) {
      sum += raw[rowStart + column];
      count += 1;
    }
  }

  return count === 0 ? 0 : sum / count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isSharpInputError(error: unknown): boolean {
  return error instanceof Error && /Input file is missing|Unsupported input|unsupported image format|bad seek|Vips|unexpected end|corrupt|invalid/i.test(error.message);
}
