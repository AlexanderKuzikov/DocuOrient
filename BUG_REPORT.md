# BUG_REPORT — DocuOrient

Дата ревью: **2026-06-20**

Ревью охватывало:

- `src/index.ts`;
- `src/algorithm.ts`;
- `src/image.ts`;
- `src/types.ts`;
- `src/errors.ts`;
- `cli/orient.ts`;
- `scripts/generate-fixtures.ts`;
- `bench/benchmark.ts`;
- `test/orient.test.ts`;
- `package.json`;
- `tsconfig.json`;
- `README.md`;
- `CONTEXT.md`;
- `SRS2.md`.

---

## Сводная таблица

| ID | Файл | Статус | Суть |
|---|---|---|---|
| Б-1 | `package.json` / `tsconfig.json` | ✅ Исправлен | Build оставлял старый `dist/`; теперь сборка очищает `dist` перед `tsc`. |
| Б-2 | `package.json` | ✅ Исправлен | `main`/`types`/`exports` указывали на `dist/index.js`, хотя `tsc` собирал `dist/src/index.js`. Теперь пути соответствуют реальному build. |
| Б-3 | `tsconfig.json` | ✅ Исправлен | В package dry-run попадали `test/`, `bench/`, `scripts/`, `vitest.config.ts`. Теперь `tsconfig` собирает только `src/` и `cli/`. |
| Б-4 | `src/index.ts` / `src/errors.ts` | ✅ Добавлен | Добавлена валидация `options` и ошибка `INVALID_OPTIONS`. |
| Б-5 | `README.md` | ✅ Исправлен | README приведён к структуре DocuMind/DocuDeskew: статус, pipeline, API, defaults, ограничения, проверки, связь с DocuMind. |
| Б-6 | `CONTEXT.md` | ✅ Создан | Создан файл быстрого погружения для новой LLM/агента. |
| П-1 | `src/algorithm.ts` | 🔵 Остался риск | `confidence` остаётся эвристической и требует калибровки на реальных документах. |
| П-2 | `test/orient.test.ts` | 🔵 Остался риск | Нет golden set на реальных юридических сканах; тесты только на синтетических документах. |
| П-3 | `src/algorithm.ts` | 🔵 Остался риск | Вертикальная ориентация текста менее проверена и может быть edge case. |
| П-4 | `src/image.ts` | 🔵 Остался риск | Поддерживается только PNG на входе. Для JPEG/WebP нужен отдельный scope. |
| П-5 | `src/algorithm.ts` | 🔵 Остался риск | Симметричные документы могут давать близкие score для разных осей. |
| И-1 | `npm audit --omit=dev --json` | ℹ️ Info | Уязвимостей в production-зависимостях не найдено: `total: 0`. |
| И-2 | `npm outdated --json` | ℹ️ Info | Есть более новые версии `@types/node`, `sharp`, `typescript`; это не security-блокер для MVP. |

---

## Что исправлено в ходе ревью

### 1. Исправлен package/build contract

**Файлы:** `package.json`, `tsconfig.json`

Раньше `npm pack --dry-run --json` включал dev-артефакты:

- `dist/test/`;
- `dist/bench/`;
- `dist/scripts/`;
- `dist/vitest.config.js`.

Также `build` не очищал `dist`, поэтому в package могли попадать устаревшие файлы.

Исправление:

- `tsconfig.json` собирает только `src/**/*.ts` и `cli/**/*.ts`;
- `build` теперь вызывает `clean`;
- `package.json` содержит `clean` script.

---

### 2. Исправлены package exports

**Файл:** `package.json`

Ранее:

```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

Но `tsc` с текущим `rootDir` собирает:

```text
dist/src/index.js
dist/src/index.d.ts
```

Исправлено на:

```json
"main": "./dist/src/index.js",
"types": "./dist/src/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/src/index.d.ts",
    "import": "./dist/src/index.js"
  }
}
```

Проверка после сборки:

```text
node --input-type=module -e "import { orient } from './dist/src/index.js'; console.log(typeof orient)"
function
```

---

### 3. Добавлена валидация options

**Файлы:** `src/index.ts`, `src/errors.ts`, `test/orient.test.ts`

Добавлен новый код ошибки:

```text
INVALID_OPTIONS
```

Проверяются диапазоны:

- `fixedThreshold`: `0–255`;
- `minTextureScore`: `>= 0`;
- `minConfidence`: `0–1`;
- `axisScoreRatio`: `> 0`;
- `brightnessMargin`: `>= 0`;
- `ignoreBorderRatio`: `0–0.25`.

---

### 4. Обновлены README и CONTEXT

**Файлы:** `README.md`, `CONTEXT.md`

README приведён к структуре, принятой в DocuMind/DocuDeskew:

- текущий статус;
- pipeline;
- публичный API;
- options;
- defaults;
- ошибки;
- CLI;
- fixtures/benchmark;
- проверки;
- связь с DocuMind;
- ограничения MVP.

Создан `CONTEXT.md` для быстрого погружения новой LLM/агента.

---

## Проверки

### `npm run check`

```text
exit 0
```

Результат:

```text
Test Files  1 passed (1)
Tests       9 passed (9)
```

---

### `npm run benchmark`

```text
exit 0
```

Результат последнего запуска:

```json
{
  "fixture": "C:\\Any\\DocuOrient_review\\fixtures\\orientation-180.png",
  "iterations": 100,
  "p50Ms": 7.29,
  "p95Ms": 8.65,
  "p99Ms": 12.36,
  "maxMs": 20.84
}
```

MVP-требование `p95 <= 100 ms` выполнено на текущем fixture.

---

### `git diff --check`

```text
exit 0
```

---

### `npm audit --omit=dev --json`

```text
total vulnerabilities: 0
```

---

### `npm pack --dry-run --json`

```text
exit 0
entryCount: 21
```

После исправления package больше не включает `test/`, `bench/`, `scripts/`, `vitest.config.ts`.

---

### CLI smoke test

```bash
node dist/cli/orient.js fixtures/orientation-180.png output-cli-test.png --debug
```

Результат:

```text
rotationStep: 180
decision: rotated
confidence: 0.8157
```

Выходной файл:

```text
PNG image data, 320 x 220, 8-bit grayscale, non-interlaced
```

---

### `npm outdated --json`

Команда вернула exit `1`, потому что есть более новые версии. Это не security-блокер.

```text
@types/node: current 24.13.2, latest 26.0.0
sharp: current 0.34.5, latest 0.35.2
typescript: current 5.9.3, latest 6.0.3
```

---

## Актуальные открытые задачи

### П-1. Калибровать confidence на реальных документах

`confidence` сейчас эвристический:

- texture score;
- axis score;
- brightness asymmetry.

Риск: на реальных сканах с разным качеством, шумом, полями и вёрсткой порог `0.55` может быть слишком оптимистичным или слишком строгим.

Рекомендация: собрать golden set и посчитать accuracy / false rotate / false unchanged.

---

### П-2. Добавить golden set

Сейчас тесты используют синтетические документы.

Риск: синтетические fixtures не покрывают:

- реальные сканы;
- серые поля;
- печати;
- таблицы;
- плотный текст;
- штрихкоды;
- фотокопии;
- шум;
- артефакты сканера.

Рекомендация: добавить `test/golden/` с реальными анонимизированными изображениями и ожидаемыми `rotationStep`.

---

### П-3. Проверить вертикальную ориентацию

Вертикальная ветка реализована, но менее проверена. Для юридических русскоязычных документов это редкий режим.

Рекомендация:

- добавить вертикальные fixtures;
- проверить точность отдельно;
- если точность низкая — явно пометить vertical mode как experimental или добавить опцию отключения.

---

### П-4. Расширить входные форматы

Сейчас поддерживается только PNG.

Риск: пользователи могут передать JPEG/WebP или RGB-изображение из сканера.

Текущая компенсация: RGB/RGBA PNG приводится к grayscale. Но JPEG/WebP не принимаются.

Рекомендация: если это нужно DocuMind pipeline — расширить вход на PNG/JPEG/WebP и обновить SRS/README.

---

### П-5. Проверить симметричные документы

Симметричные документы могут давать близкие score для разных осей.

Рекомендация:

- добавить тесты на симметричные макеты;
- рассмотреть снижение `confidence`;
- возвращать `low_confidence`, если разница между лучшей и второй осью меньше порога.

---

## Итоговая оценка

DocuOrient MVP рабочий и проходит базовые проверки. Для demo / внутреннего pipeline его можно использовать с `low_confidence` как предохранителем. Для production нужна калибровка на реальных документах и golden set.
