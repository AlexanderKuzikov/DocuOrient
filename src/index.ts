import { computeOrientation } from './algorithm.js';
import { InvalidInputError } from './errors.js';
import type { OrientationOptions, OrientationResult } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

export * from './types.js';
export {
  DocuOrientError,
  EmptyImageError,
  InvalidInputError,
  ProcessingError,
  UnsupportedFormatError,
  UnsupportedImageError
} from './errors.js';

export async function orient(input: Buffer | Uint8Array, options: OrientationOptions = {}): Promise<OrientationResult> {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array)) {
    throw new InvalidInputError();
  }

  return computeOrientation(input, { ...DEFAULT_OPTIONS, ...options });
}
