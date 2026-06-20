# CONTEXT

Этот файл предназначен для быстрого погружения новой LLM/агента в проект.

## Проект

DocuOrient — Node.js/TypeScript библиотека для определения читаемой ориентации выровненного сканированного документа.

GitHub:

```text
https://github.com/AlexanderKuzikov/DocuOrient
```

Текущий статус:

```text
MVP foundation / demo-ready, не production-complete
```

Это рабочая предварительная версия, но ещё не production-complete система.

---

## Текущий активный режим

Активный режим:

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

`rotationStep` — применяемый доворот по часовой стрелке: `0 | 90 | 180 | 270`.  
`decision` — итоговое решение: `rotated | unchanged | low_confidence`.

---

## Что уже сделано

На текущем этапе в репозитории есть:

- Node.js проект с `package.json` и `package-lock.json`;
- TypeScript source в `src/`;
- ESM build через `tsc`;
- типизированный API `orient(imageBuffer, options?)`;
- статусы результата:
  - `rotated`;
  - `unchanged`;
  - `low_confidence`;
- ошибки с кодами:
  - `INVALID_INPUT`;
  - `INVALID_OPTIONS`;
  - `UNSUPPORTED_FORMAT`;
  - `UNSUPPORTED_IMAGE`;
  - `EMPTY_IMAGE`;
  - `PROCESSING_ERROR`;
- CLI `docu-orient`;
- unit-тесты на синтетических документах;
- fixtures;
- benchmark;
- README;
- CONTEXT;
- BUG_REPORT.

---

## API contract

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

### Ошибки

```ts
Error & {
  code:
    | 'INVALID_INPUT'
    | 'INVALID_OPTIONS'
    | 'UNSUPPORTED_FORMAT'
    | 'UNSUPPORTED_IMAGE'
    | 'EMPTY_IMAGE'
    | 'PROCESSING_ERROR'
}
```

---

## Алгоритм

1. Проверка, что вход — `Buffer` или `Uint8Array`.
2. Проверка PNG signature.
3. Чтение метаданных через `sharp`.
4. Конвертация в 8-bit grayscale PNG.
5. Получение raw grayscale-буфера.
6. Бинаризация через Otsu или fixed threshold.
7. Расчёт projection score для 0°/90°/180°/270°.
8. Выбор оси:
   - горизонтальная: `max(rotation0, rotation180)`;
   - вертикальная: `max(rotation90, rotation270)`.
9. Выбор направления:
   - горизонтально: сравнение яркости верхней и нижней трети;
   - вертикально: сравнение яркости левой и правой трети после кандидатов 90°/270°.
10. Расчёт `confidence`.
11. Если `confidence < minConfidence`, вернуть `low_confidence` без поворота.
12. Иначе повернуть PNG через `sharp.rotate(rotationStep)` и вернуть результат.

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

## Ограничения MVP

- Поддерживается только PNG на входе.
- Выход — grayscale PNG.
- Алгоритм рассчитан на выровненный документ после `DocuDeskew`.
- Нет OCR/ML-классификации.
- Нет golden set на реальных юридических документах.
- `confidence` — эвристическая оценка, требует калибровки.
- Вертикальная ориентация текста редкая и менее проверенная.
- Симметричные документы могут давать одинаковые score для разных осей.
- Производительность зависит от площади изображения и количества копий raw/mask.
- Обработка персональных данных должна быть локальной/on-prem.

---

## Полезные команды

```bash
npm install
npm run check
npm test
npm run typecheck
npm run build
npm run fixtures
npm run benchmark
```

Для локальной проверки ESM после сборки:

```bash
node --input-type=module -e "import { orient } from './dist/src/index.js'; console.log(typeof orient)"
```

Для CLI после сборки:

```bash
node dist/cli/orient.js fixtures/orientation-180.png output.png --debug
```

---

## Связь с DocuMind

DocuOrient — второй этап конвейера DocuMind после `DocuDeskew` и перед OCR/распознаванием.

Pipeline:

```text
input scan
  → DocuDeskew
  → DocuOrient
  → OCR / extraction
  → output JSON/PDF
```

Обработка реальных юридических документов с персональными данными должна выполняться локально/on-prem. Не отправлять такие изображения во внешние LLM/облачные сервисы без явной политики обработки и обезличивания.
