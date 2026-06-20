#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { orient } from '../src/index.js';

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

async function main(): Promise<void> {
  const [, , inputPath, outputPath, ...flags] = process.argv;

  if (!inputPath || !outputPath) {
    console.error(`Usage: docu-orient <input.png> <output.png> [--debug] [--min-confidence=0.55]`);
    process.exit(1);
  }

  const returnDebug = flags.includes('--debug');
  const minConfidenceFlag = flags.find((flag) => flag.startsWith('--min-confidence='));
  const minConfidence = minConfidenceFlag ? Number(minConfidenceFlag.split('=')[1]) : undefined;

  if (
    minConfidenceFlag &&
    (!Number.isFinite(minConfidence) || minConfidence === undefined || minConfidence < 0 || minConfidence > 1)
  ) {
    console.error('--min-confidence must be a number between 0 and 1.');
    process.exit(1);
  }

  const input = await readFile(inputPath);
  const result = await orient(input, {
    minConfidence,
    returnDebug
  });

  await writeFile(outputPath, result.orientedImage);

  console.log(JSON.stringify({
    input: basename(inputPath),
    output: basename(outputPath),
    rotationStep: result.rotationStep,
    decision: result.decision,
    confidence: Number(result.confidence.toFixed(4)),
    debug: result.debug
  }, null, 2));
}
