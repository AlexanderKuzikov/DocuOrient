export type RotationStep = 0 | 90 | 180 | 270;
export type OrientationDecision = 'rotated' | 'unchanged' | 'low_confidence';
export type OrientationAxis = 'horizontal' | 'vertical' | 'unknown';

export interface OrientationOptions {
  otsuThreshold?: boolean;
  fixedThreshold?: number;
  minTextureScore?: number;
  minConfidence?: number;
  axisScoreRatio?: number;
  brightnessMargin?: number;
  ignoreBorderRatio?: number;
  returnDebug?: boolean;
}

export interface OrientationDebug {
  scores: {
    rotation0: number;
    rotation90: number;
    rotation180: number;
    rotation270: number;
  };
  axis: OrientationAxis;
  brightness: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  thresholds: {
    minTextureScore: number;
    minConfidence: number;
    brightnessMargin: number;
  };
}

export interface OrientationResult {
  rotationStep: RotationStep;
  orientedImage: Buffer;
  confidence: number;
  decision: OrientationDecision;
  debug?: OrientationDebug;
}

export const DEFAULT_OPTIONS: Required<OrientationOptions> = {
  otsuThreshold: true,
  fixedThreshold: 128,
  minTextureScore: 0.015,
  minConfidence: 0.55,
  axisScoreRatio: 1.05,
  brightnessMargin: 3,
  ignoreBorderRatio: 0.05,
  returnDebug: false
};
