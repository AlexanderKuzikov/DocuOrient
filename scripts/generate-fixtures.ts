import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as sharpModule from 'sharp';

type SharpFactory = (
  input?: sharpModule.SharpInput | sharpModule.SharpInput[],
  options?: sharpModule.SharpOptions
) => sharpModule.Sharp;

const sharp = (sharpModule as unknown as { default: SharpFactory }).default;

const FIXTURES_DIR = join(process.cwd(), 'fixtures');

type Rotation = 0 | 90 | 180 | 270;

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });

  await writeFile(join(FIXTURES_DIR, 'orientation-000.png'), await createDocument(0));
  await writeFile(join(FIXTURES_DIR, 'orientation-090.png'), await createDocument(90));
  await writeFile(join(FIXTURES_DIR, 'orientation-180.png'), await createDocument(180));
  await writeFile(join(FIXTURES_DIR, 'orientation-270.png'), await createDocument(270));
  await writeFile(join(FIXTURES_DIR, 'blank.png'), await createBlank());
  await writeFile(join(FIXTURES_DIR, 'low-text.png'), await createLowText());
}

async function createDocument(rotation: Rotation): Promise<Buffer> {
  const width = 320;
  const height = 220;
  const raw = Buffer.alloc(width * height, 248);

  for (let y = 0; y < height; y += 1) {
    const rowInBlock = y % 14;
    const isTextRow = rowInBlock >= 3 && rowInBlock <= 8;
    if (!isTextRow) continue;

    for (let x = 0; x < width; x += 1) {
      const inGlyph = x % 5 >= 1 && x % 5 <= 3;
      raw[y * width + x] = inGlyph ? 38 : 232;
    }
  }

  darkenBottom(raw, width, height);

  const base = await sharp(raw, { raw: { width, height, channels: 1 } })
    .toColourspace('b-w')
    .png()
    .toBuffer();

  return sharp(base).rotate(rotation, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
}

async function createBlank(): Promise<Buffer> {
  return sharp(Buffer.alloc(320 * 220, 255), { raw: { width: 320, height: 220, channels: 1 } })
    .toColourspace('b-w')
    .png()
    .toBuffer();
}

async function createLowText(): Promise<Buffer> {
  const width = 320;
  const height = 220;
  const raw = Buffer.alloc(width * height, 248);

  for (let y = 80; y < 96; y += 1) {
    for (let x = 90; x < 230; x += 1) {
      raw[y * width + x] = 180;
    }
  }

  const base = await sharp(raw, { raw: { width, height, channels: 1 } })
    .toColourspace('b-w')
    .png()
    .toBuffer();

  return sharp(base).rotate(180, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
}

function darkenBottom(raw: Buffer, width: number, height: number): void {
  for (let y = Math.floor(height * 0.66); y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      raw[index] = raw[index] < 200 ? Math.max(20, raw[index] - 18) : Math.max(190, raw[index] - 16);
    }
  }
}
