import { computeOrientation } from './algorithm.js';
import { InvalidInputError, InvalidOptionsError } from './errors.js';
import type { OrientationOptions, OrientationResult } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

export * from './types.js';
export {
  DocuOrientError,
  EmptyImageError,
  InvalidInputError,
  InvalidOptionsError,
  ProcessingError,
  UnsupportedFormatError,
  UnsupportedImageError
} from './errors.js';

export async function orient(input: Buffer | Uint8Array, options: OrientationOptions = {}): Promise<OrientationResult> {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    throw new InvalidInputError();
  }

  validateOptions(options);

  return computeOrientation(input, { ...DEFAULT_OPTIONS, ...options });
}

function validateOptions(options: OrientationOptions): void {
  if (options.fixedThreshold !== undefined && (options.fixedThreshold < 0 || options.fixedThreshold > 255)) {
    throw new InvalidOptionsError('fixedThreshold must be in range 0–255.');
  }

  if (options.minTextureScore !== undefined && options.minTextureScore < 0) {
    throw new InvalidOptionsError('minTextureScore must be >= 0.');
  }

  if (options.minConfidence !== undefined && (options.minConfidence < 0 || options.minConfidence > 1)) {
    throw new InvalidOptionsError('minConfidence must be in range 0–1.');
  }

  if (options.axisScoreRatio !== undefined && options.axisScoreRatio <= 0) {
    throw new InvalidOptionsError('axisScoreRatio must be > 0.');
  }

  if (options.brightnessMargin !== undefined && options.brightnessMargin < 0) {
    throw new InvalidOptionsError('brightnessMargin must be >= 0.');
  }

  if (options.ignoreBorderRatio !== undefined && (options.ignoreBorderRatio < 0 || options.ignoreBorderRatio > 0.25)) {
    throw new InvalidOptionsError('ignoreBorderRatio must be in range 0–0.25.');
  }
}
