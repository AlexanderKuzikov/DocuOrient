import { describe, expect, it } from 'vitest';
import * as sharpModule from 'sharp';

type SharpFactory = (
  input?: sharpModule.SharpInput | sharpModule.SharpInput[],
  options?: sharpModule.SharpOptions
) => sharpModule.Sharp;

const sharp = (sharpModule as unknown as { default: SharpFactory }).default;

import {
  InvalidInputError,
  InvalidOptionsError,
  UnsupportedFormatError,
  UnsupportedImageError,
  orient
} from '../src/index.js';

type RotationStep = 0 | 90 | 180 | 270;

async function syntheticDocument(rotation: RotationStep, mode: 'normal' | 'blank' = 'normal'): Promise<Buffer> {
  const width = 240;
  const height = 160;
  const raw = Buffer.alloc(width * height, 248);

  if (mode === 'blank') {
    return sharp(raw, { raw: { width, height, channels: 1 } }).toColourspace('b-w').png().toBuffer();
  }

  for (let y = 0; y < height; y += 1) {
    const rowInBlock = y % 14;
    const isTextRow = rowInBlock >= 3 && rowInBlock <= 8;
    if (!isTextRow) continue;

    for (let x = 0; x < width; x += 1) {
      const inGlyph = x % 5 >= 1 && x % 5 <= 3;
      raw[y * width + x] = inGlyph ? 38 : 232;
    }
  }

  for (let y = Math.floor(height * 0.66); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[y * width + x] < 200) {
        raw[y * width + x] = Math.max(20, raw[y * width + x] - 18);
      } else {
        raw[y * width + x] = Math.max(190, raw[y * width + x] - 16);
      }
    }
  }

  const base = await sharp(raw, { raw: { width, height, channels: 1 } }).toColourspace('b-w').png().toBuffer();
  return sharp(base).rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
}

async function syntheticRgb(rotation: RotationStep): Promise<Buffer> {
  const width = 120;
  const height = 80;
  const rgb = Buffer.alloc(width * height * 3, 248);

  for (let y = 0; y < height; y += 1) {
    const isTextRow = y % 12 >= 3 && y % 12 <= 7;
    if (!isTextRow) continue;

    for (let x = 0; x < width; x += 1) {
      const inGlyph = x % 6 >= 1 && x % 6 <= 4;
      const offset = (y * width + x) * 3;
      rgb[offset] = inGlyph ? 30 : 232;
      rgb[offset + 1] = inGlyph ? 30 : 232;
      rgb[offset + 2] = inGlyph ? 30 : 232;
    }
  }

  for (let y = Math.floor(height * 0.66); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      if (rgb[offset] < 200) {
        rgb[offset] = Math.max(20, rgb[offset] - 18);
        rgb[offset + 1] = Math.max(20, rgb[offset + 1] - 18);
        rgb[offset + 2] = Math.max(20, rgb[offset + 2] - 18);
      } else {
        rgb[offset] = Math.max(190, rgb[offset] - 16);
        rgb[offset + 1] = Math.max(190, rgb[offset + 1] - 16);
        rgb[offset + 2] = Math.max(190, rgb[offset + 2] - 16);
      }
    }
  }

  const base = await sharp(rgb, { raw: { width, height, channels: 3 } }).toColourspace('b-w').png().toBuffer();
  return sharp(base).rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
}

describe('orient()', () => {
  it('leaves an already readable synthetic document unchanged', async () => {
    const input = await syntheticDocument(0);

    const result = await orient(input, { minConfidence: 0 });

    expect(result.rotationStep).toBe(0);
    expect(result.decision).toBe('unchanged');
    expect(result.orientedImage).toBeInstanceOf(Buffer);
  });

  it('rotates a 180-degree synthetic document back to readable orientation', async () => {
    const input = await syntheticDocument(180);

    const result = await orient(input, { minConfidence: 0 });

    expect(result.rotationStep).toBe(180);
    expect(result.decision).toBe('rotated');
  });

  it('returns low_confidence for a blank page instead of rotating it', async () => {
    const input = await syntheticDocument(0, 'blank');

    const result = await orient(input);

    expect(result.rotationStep).toBe(0);
    expect(result.decision).toBe('low_confidence');
  });

  it('converts RGB input to a grayscale PNG output', async () => {
    const input = await syntheticRgb(180);

    const result = await orient(input, { minConfidence: 0 });
    const metadata = await sharp(result.orientedImage).metadata();

    expect(result.rotationStep).toBe(180);
    expect(metadata.format).toBe('png');
    expect(metadata.channels).toBe(1);
  });

  it('returns debug data when requested', async () => {
    const input = await syntheticDocument(180);

    const result = await orient(input, {
      minConfidence: 0,
      returnDebug: true
    });

    expect(result.debug?.axis).toBe('horizontal');
    expect(result.debug?.scores.rotation180).toBeGreaterThan(0);
  });

  it('throws UnsupportedFormatError for non-PNG input', async () => {
    await expect(orient(Buffer.from('not a png'))).rejects.toThrow(UnsupportedFormatError);
  });

  it('throws InvalidInputError for non-buffer input', async () => {
    await expect(orient('not a buffer' as unknown as Buffer)).rejects.toThrow(InvalidInputError);
  });

  it('throws InvalidOptionsError for invalid options', async () => {
    await expect(orient(Buffer.from('not a png'), { minConfidence: 2 })).rejects.toThrow(InvalidOptionsError);
  });

  it('throws UnsupportedImageError for truncated PNG input', async () => {
    const invalidPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);

    await expect(orient(invalidPng)).rejects.toThrow(UnsupportedImageError);
  });
});
