import * as sharpModule from 'sharp';
import {
  brightnessByAxis,
  projectionScore,
  rotateRaw,
  thresholdToMask,
  toGrayscalePng
} from './image.js';
import type { OrientationDebug, OrientationOptions, OrientationResult, RotationStep } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

type SharpFactory = (
  input?: sharpModule.SharpInput | sharpModule.SharpInput[],
  options?: sharpModule.SharpOptions
) => sharpModule.Sharp;

const sharp = (sharpModule as unknown as { default: SharpFactory }).default;

const ROTATIONS: RotationStep[] = [0, 90, 180, 270];

export async function computeOrientation(input: Buffer | Uint8Array, options: OrientationOptions = {}): Promise<OrientationResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const image = await toGrayscalePng(input);
  const threshold = mergedOptions.otsuThreshold ? otsuThreshold(image.raw) : clamp(mergedOptions.fixedThreshold, 0, 255);
  const scores = scoreRotations(image.raw, image.width, image.height, threshold);
  const horizontalScore = Math.max(scores.rotation0, scores.rotation180);
  const verticalScore = Math.max(scores.rotation90, scores.rotation270);
  const bestTextureScore = Math.max(horizontalScore, verticalScore);

  if (bestTextureScore < mergedOptions.minTextureScore) {
    return lowConfidenceResult(image.png, scores, 0, mergedOptions);
  }

  const axis = horizontalScore >= verticalScore * mergedOptions.axisScoreRatio ? 'horizontal' : 'vertical';

  if (axis === 'horizontal') {
    const raw0 = rotateRaw(image.raw, image.width, image.height, 0);
    const brightness = brightnessByAxis(raw0.raw, raw0.width, raw0.height, 'horizontal', mergedOptions.ignoreBorderRatio);
    const rotationStep: RotationStep = brightness.margin >= mergedOptions.brightnessMargin ? 0 : 180;
    const brightnessConfidence = Math.abs(brightness.margin ?? 0) / 255;
    const confidence = computeConfidence(bestTextureScore, horizontalScore, verticalScore, brightnessConfidence, mergedOptions);
    const decision: OrientationResult['decision'] = rotationStep === 0 ? 'unchanged' : 'rotated';

    if (confidence < mergedOptions.minConfidence) {
      return lowConfidenceResult(image.png, scores, rotationStep, mergedOptions, axis, brightness);
    }

    return await finishResult(image, rotationStep, confidence, decision, scores, axis, brightness, mergedOptions);
  }

  const candidates = [90, 270] as const;
  const candidateResults = candidates.map((rotationStep) => {
    const rotated = rotateRaw(image.raw, image.width, image.height, rotationStep);
    const brightness = brightnessByAxis(rotated.raw, rotated.width, rotated.height, 'vertical', mergedOptions.ignoreBorderRatio);

    return {
      rotationStep,
      brightness,
      confidence: computeConfidence(
        bestTextureScore,
        horizontalScore,
        verticalScore,
        Math.abs(brightness.margin ?? 0) / 255,
        mergedOptions
      )
    };
  });

  const readable = candidateResults
    .filter((candidate) => (candidate.brightness.margin ?? 0) >= mergedOptions.brightnessMargin)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!readable) {
    const bestCandidate = candidateResults.sort((a, b) => b.confidence - a.confidence)[0];

    return lowConfidenceResult(
      image.png,
      scores,
      bestCandidate.rotationStep,
      mergedOptions,
      axis,
      bestCandidate.brightness
    );
  }

  return await finishResult(
    image,
    readable.rotationStep,
    readable.confidence,
    'rotated',
    scores,
    axis,
    readable.brightness,
    mergedOptions
  );
}

function scoreRotations(raw: Buffer, width: number, height: number, threshold: number): OrientationDebug['scores'] {
  const scores: Partial<OrientationDebug['scores']> = {};

  for (const rotation of ROTATIONS) {
    const rotated = rotateRaw(raw, width, height, rotation);
    const mask = thresholdToMask(rotated.raw, rotated.width, rotated.height, threshold);
    const score = projectionScore(mask, rotated.width, rotated.height);

    if (rotation === 0) scores.rotation0 = score;
    if (rotation === 90) scores.rotation90 = score;
    if (rotation === 180) scores.rotation180 = score;
    if (rotation === 270) scores.rotation270 = score;
  }

  return scores as OrientationDebug['scores'];
}

function otsuThreshold(raw: Buffer): number {
  const histogram = new Array<number>(256).fill(0);

  for (let index = 0; index < raw.length; index += 1) {
    histogram[raw[index]] += 1;
  }

  const total = raw.length;
  let sum = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    sum += index * histogram[index];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let weightForeground = total;
  let sumForeground = sum;
  let maxVariance = -1;
  let threshold = 128;

  for (let index = 0; index < histogram.length; index += 1) {
    weightBackground += histogram[index];

    if (weightBackground === 0) {
      continue;
    }

    weightForeground -= histogram[index];

    if (weightForeground === 0) {
      break;
    }

    sumBackground += index * histogram[index];
    sumForeground -= index * histogram[index];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = sumForeground / weightForeground;
    const varianceBetween = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = index;
    }
  }

  return threshold;
}

function computeConfidence(
  bestTextureScore: number,
  horizontalScore: number,
  verticalScore: number,
  brightnessConfidence: number,
  options: Required<OrientationOptions>
): number {
  const epsilon = 0.0001;
  const textureConfidence = clamp(bestTextureScore / Math.max(options.minTextureScore, epsilon), 0, 1);
  const axisConfidence = clamp(
    Math.max(horizontalScore, verticalScore) / Math.max(Math.min(horizontalScore, verticalScore) + epsilon, epsilon),
    0,
    1
  );

  return clamp(0.45 * textureConfidence + 0.35 * axisConfidence + 0.20 * brightnessConfidence, 0, 1);
}

function lowConfidenceResult(
  orientedImage: Buffer,
  scores: OrientationDebug['scores'],
  rotationStep: RotationStep,
  options: Required<OrientationOptions>,
  axis: OrientationDebug['axis'] = 'unknown',
  brightness: OrientationDebug['brightness'] = {}
): OrientationResult {
  const result: OrientationResult = {
    rotationStep,
    orientedImage,
    confidence: 0,
    decision: 'low_confidence'
  };

  if (options.returnDebug) {
    result.debug = {
      scores,
      axis,
      brightness,
      thresholds: {
        minTextureScore: options.minTextureScore,
        minConfidence: options.minConfidence,
        brightnessMargin: options.brightnessMargin
      }
    };
  }

  return result;
}

async function finishResult(
  image: Awaited<ReturnType<typeof toGrayscalePng>>,
  rotationStep: RotationStep,
  confidence: number,
  decision: OrientationResult['decision'],
  scores: OrientationDebug['scores'],
  axis: OrientationDebug['axis'],
  brightness: OrientationDebug['brightness'],
  options: Required<OrientationOptions>
): Promise<OrientationResult> {
  const result: OrientationResult = {
    rotationStep,
    orientedImage: rotationStep === 0 ? image.png : await rotatePng(image.png, rotationStep),
    confidence,
    decision
  };

  if (options.returnDebug) {
    result.debug = {
      scores,
      axis,
      brightness,
      thresholds: {
        minTextureScore: options.minTextureScore,
        minConfidence: options.minConfidence,
        brightnessMargin: options.brightnessMargin
      }
    };
  }

  return result;
}

async function rotatePng(input: Buffer, rotationStep: RotationStep): Promise<Buffer> {
  return sharp(input)
    .rotate(rotationStep, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toColourspace('b-w')
    .png()
    .toBuffer();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
