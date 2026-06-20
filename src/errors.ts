export class DocuOrientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DocuOrientError';
    this.code = code;
  }
}

export class InvalidInputError extends DocuOrientError {
  constructor(message = 'Input must be a Buffer or Uint8Array.') {
    super('INVALID_INPUT', message);
    this.name = 'InvalidInputError';
  }
}

export class InvalidOptionsError extends DocuOrientError {
  constructor(message = 'Invalid orientation options.') {
    super('INVALID_OPTIONS', message);
    this.name = 'InvalidOptionsError';
  }
}

export class UnsupportedFormatError extends DocuOrientError {
  constructor(message = 'Input must be a PNG image.') {
    super('UNSUPPORTED_FORMAT', message);
    this.name = 'UnsupportedFormatError';
  }
}

export class UnsupportedImageError extends DocuOrientError {
  constructor(message = 'Image metadata could not be read or is unsupported.') {
    super('UNSUPPORTED_IMAGE', message);
    this.name = 'UnsupportedImageError';
  }
}

export class EmptyImageError extends DocuOrientError {
  constructor(message = 'Image has zero width or height.') {
    super('EMPTY_IMAGE', message);
    this.name = 'EmptyImageError';
  }
}

export class ProcessingError extends DocuOrientError {
  constructor(message = 'Image processing failed.') {
    super('PROCESSING_ERROR', message);
    this.name = 'ProcessingError';
  }
}
