import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { orient } from '../src/index.js';

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const fixturePath = join(process.cwd(), 'fixtures', 'orientation-180.png');
  const input = await readFile(fixturePath);
  const iterations = 100;
  const samples: number[] = [];

  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await orient(input, { minConfidence: 0 });
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);

  const percentile = (p: number): number => {
    const sampleIndex = Math.min(samples.length - 1, Math.floor((samples.length - 1) * p));
    return samples[sampleIndex];
  };

  console.log(JSON.stringify({
    fixture: fixturePath,
    iterations,
    p50Ms: round(percentile(0.50)),
    p95Ms: round(percentile(0.95)),
    p99Ms: round(percentile(0.99)),
    maxMs: round(samples[samples.length - 1])
  }, null, 2));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
