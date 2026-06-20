# DocuOrient

Определение правильной ориентации текста на выровненном документе. Часть проекта **DocuMind** — интеллектуальной обработки юридических документов.

DocuOrient принимает PNG-изображение документа, оценивает ориентацию строк без OCR/нейросетей и возвращает финальное grayscale PNG. Если уверенности недостаточно — документ не поворачивается и возвращается `decision: "low_confidence"`.

## Текущий статус

```text
MVP foundation / demo-ready, не production-complete
```

Реализован минимальный Node.js/TypeScript API для определения доворота 0° / 90° / 180° / 270° после `DocuDeskew`.

Пройдены базовые проверки:

```bash
npm run check
npm test
npm run typecheck
npm run build
npm run benchmark
```

Остаются:

- golden set на реальных юридических документах;
- калибровка `confidence` на реальных сканах;
- проверка точности для вертикальной ориентации текста;
- production quality gates / CI;
- benchmark на разных размерах и качествах сканов.

---

## Текущий активный режим

```text
PNG imageBuffer
  → validate PNG signature
  → sharp metadata
  → grayscale raw PNG
  → Otsu or fixed threshold
  → projection score for 0° / 90° / 180° / 270°
  → choose horizontal or vertical axis
  → brightness asymmetry top/bottom or left/right
  → confidence check
  → rotate with sharp if decision != low_confidence
  → grayscale PNG output
```

Публичный API:

```ts
import { orient } from 'docu-orient';

const result = await orient(imageBuffer, options?);
```

---

## Что делает

- Вход: `Buffer | Uint8Array` с PNG-изображением.
- Конвертация RGB/RGBA/других цветовых режимов в 8-bit grayscale PNG.
- Оценка ориентации 0° / 90° / 180° / 270° через текстурный профиль строк.
- Определение верха/низа или лево/право через асимметрию яркости.
- Поворот через `sharp`.
- `confidence`, `decision`, `rotationStep` и опциональный `debug`.

Важно: DocuOrient не исправляет skew, перспективу, crop или низкое качество скана. Он ожидает уже выровненный документ после `DocuDeskew`.

---

## Ограничения MVP

Это без-OCR эвристика. Она подходит для выровненных документов с читаемыми строками, но не заменяет OCR/ML-классификатор. На пустых, сильно шумных, сильно перекошенных или нестандартно вёрстнутых страницах результат может быть `low_confidence`.

---

## Установка

```bash
npm install
```

Для разработки:

```bash
npm install
npm run check
npm test
npm run typecheck
npm run build
npm run fixtures
npm run benchmark
```

---

## API

### ESM

```js
import { readFile, writeFile } from 'node:fs/promises';
import { orient } from 'docu-orient';

const input = await readFile('input.png');
const result = await orient(input, {
  minConfidence: 0.55,
  returnDebug: true
});

await writeFile('output.png', result.orientedImage);
console.log(result);
```

### Ответ

```ts
{
  rotationStep: 0 | 90 | 180 | 270,
  orientedImage: Buffer,
  confidence: number,
  decision: 'rotated' | 'unchanged' | 'low_confidence',
  debug?: {
    scores: {
      rotation0: number;
      rotation90: number;
      rotation180: number;
      rotation270: number;
    };
    axis: 'horizontal' | 'vertical' | 'unknown';
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
}
```

---

## Options

| Параметр | Тип | По умолчанию | Описание |
|---|---:|---:|---|
| `otsuThreshold` | `boolean` | `true` | Использовать Otsu для бинаризации |
| `fixedThreshold` | `number` | `128` | Порог бинаризации, если `otsuThreshold: false` |
| `minTextureScore` | `number` | `0.015` | Минимальный текстурный score |
| `minConfidence` | `number` | `0.55` | Минимальная уверенность для поворота |
| `axisScoreRatio` | `number` | `1.05` | Коэффициент преимущества лучшей оси |
| `brightnessMargin` | `number` | `3` | Минимальная разница яркости для выбора верха/лево |
| `ignoreBorderRatio` | `number` | `0.05` | Доля рамки, исключаемой из расчёта яркости |
| `returnDebug` | `boolean` | `false` | Вернуть внутренние score/debug |

---

## Defaults

```ts
const DEFAULT_OPTIONS = {
  otsuThreshold: true,
  fixedThreshold: 128,
  minTextureScore: 0.015,
  minConfidence: 0.55,
  axisScoreRatio: 1.05,
  brightnessMargin: 3,
  ignoreBorderRatio: 0.05,
  returnDebug: false
};
```

---

## Ошибки

API бросает `Error` с полем `code`:

| Код | Когда |
|---|---|
| `INVALID_INPUT` | Передан не `Buffer` и не `Uint8Array` |
| `INVALID_OPTIONS` | Некорректные `options` |
| `UNSUPPORTED_FORMAT` | Вход не PNG |
| `UNSUPPORTED_IMAGE` | PNG повреждён или его метаданные нечитаемы |
| `EMPTY_IMAGE` | Изображение имеет нулевую ширину или высоту |
| `PROCESSING_ERROR` | Внутренняя ошибка обработки |

---

## CLI

После сборки:

```bash
node dist/cli/orient.js fixtures/orientation-180.png output.png --debug
```

Полезные флаги:

```bash
--debug
--min-confidence=0.4
```

---

## Fixtures и benchmark

Сгенерировать тестовые PNG:

```bash
npm run fixtures
```

Запустить benchmark на `fixtures/orientation-180.png`:

```bash
npm run benchmark
```

Последний benchmark:

```text
p50: 6.98 ms
p95: 9.41 ms
p99: 11.89 ms
max: 24.90 ms
```

---

## Алгоритм

1. PNG валидируется и приводится к 8-bit grayscale.
2. Порог бинаризации считается через Otsu или берётся фиксированным.
3. Для 0°/90°/180°/270° считается текстурный score по проекции строк.
4. Выбирается горизонтальная или вертикальная ось.
5. Для горизонтального текста сравнивается яркость верхней и нижней трети.
6. Для вертикального текста сравнивается яркость левой и правой трети после кандидатов 90°/270°.
7. Если score/confidence ниже порога — `low_confidence`, поворот не применяется.

---

## Проверки

```bash
npm run check
npm test
npm run typecheck
npm run build
npm run benchmark
git diff --check
npm audit --omit=dev
npm pack --dry-run --json
```

---

## Связь с DocuMind

DocuOrient — второй этап конвейера DocuMind после `DocuDeskew` и перед OCR/распознаванием.

Активный pipeline:

```text
input scan
  → DocuDeskew
  → DocuOrient
  → OCR / extraction
  → output JSON/PDF
```

Обработка реальных юридических документов с персональными данными должна выполняться локально/on-prem. Не отправлять такие изображения во внешние LLM/облачные сервисы без явной политики обработки и обезличивания.

---

## License

MIT.
