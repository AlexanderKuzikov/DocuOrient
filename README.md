# DocuOrient

Определение правильной ориентации текста на выровненном документе. Часть проекта **DocuMind** — интеллектуальной обработки юридических документов.

DocuOrient принимает PNG-изображение документа, оценивает ориентацию строк без OCR/нейросетей и возвращает финальное grayscale PNG. Если уверенности недостаточно — документ не поворачивается и возвращается `decision: "low_confidence"`.

## Что делает

- Вход: `Buffer | Uint8Array` с PNG-изображением.
- Конвертация RGB/RGBA/других цветовых режимов в 8-bit grayscale PNG.
- Оценка ориентации 0° / 90° / 180° / 270° через текстурный профиль строк.
- Определение верха/низа или лево/право через асимметрию яркости.
- Поворот через `sharp`.
- `confidence`, `decision`, `rotationStep` и опциональный `debug`.

## Ограничения MVP

Это без-OCR эвристика. Она подходит для выровненных документов с читаемыми строками, но не заменяет OCR/ML-классификатор. На пустых, сильно шумных, сильно перекошенных или нестандартно вёрстнутых страницах результат может быть `low_confidence`.

## Установка

```bash
npm install
```

Для разработки:

```bash
npm test
npm run typecheck
npm run build
```

## API

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

Ответ:

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
    brightness: Record<string, number>;
    thresholds: {
      minTextureScore: number;
      minConfidence: number;
      brightnessMargin: number;
    };
  }
}
```

### Options

| Параметр | Тип | По умолчанию | Описание |
|---|---:|---:|---|
| `otsuThreshold` | `boolean` | `true` | Использовать Otsu для бинаризации |
| `fixedThreshold` | `number` | `180` | Порог бинаризации, если `otsuThreshold: false` |
| `minTextureScore` | `number` | `0.015` | Минимальный текстурный score |
| `axisScoreRatio` | `number` | `1.15` | Коэффициент преимущества лучшей оси |
| `brightnessMargin` | `number` | `3` | Минимальная разница яркости для выбора верха/лево |
| `ignoreBorderRatio` | `number` | `0.05` | Доля рамки, исключаемой из расчёта яркости |
| `minConfidence` | `number` | `0.55` | Минимальная уверенность для поворота |
| `returnDebug` | `boolean` | `false` | Вернуть внутренние score/debug |

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

## Fixtures и benchmark

Сгенерировать тестовые PNG:

```bash
npm run fixtures
```

Запустить benchmark на `fixtures/orientation-180.png`:

```bash
npm run benchmark
```

## Алгоритм

1. PNG валидируется и приводится к 8-bit grayscale.
2. Порог бинаризации считается через Otsu или берётся фиксированным.
3. Для 0°/90°/180°/270° считается текстурный score по проекции строк.
4. Выбирается горизонтальная или вертикальная ось.
5. Для горизонтального текста сравнивается яркость верхней и нижней трети.
6. Для вертикального текста сравнивается яркость левой и правой трети после кандидатов 90°/270°.
7. Если score/confidence ниже порога — `low_confidence`, поворот не применяется.

## Связь с DocuMind

DocuOrient — этап после `DocuDeskew` и перед OCR/распознаванием. Он не исправляет перспективу, skew, crop или низкое качество скана.

## Лицензия

MIT.
