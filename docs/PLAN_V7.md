# Chorduction v7.0 — Plan de Implementación Exhaustivo

**Versión base:** 6.0.0 (chorduction.js, ~2000 líneas, Vanilla JS, single-file)
**Versión objetivo:** 7.0.0
**Fecha estimada de release:** Junio 2026
**Naturaleza del cambio:** Breaking — refactor arquitectural completo + 4 features nuevas mayores

---

## Índice

1. [Visión general](#1-visión-general)
2. [Diagnóstico del estado actual](#2-diagnóstico-del-estado-actual)
3. [Decisiones arquitecturales](#3-decisiones-arquitecturales)
4. [Módulo 1 — Build System y estructura modular](#4-módulo-1--build-system-y-estructura-modular)
5. [Módulo 2 — TypeScript (fase 1)](#5-módulo-2--typescript-fase-1)
6. [Módulo 3 — ML Chord Detection](#6-módulo-3--ml-chord-detection)
7. [Módulo 4 — Section Detection](#7-módulo-4--section-detection)
8. [Módulo 5 — YouTube Support](#8-módulo-5--youtube-support)
9. [Módulo 6 — Instrument Expansion](#9-módulo-6--instrument-expansion)
10. [Módulo 7 — UI/UX Overhaul](#10-módulo-7--uiux-overhaul)
11. [Módulo 8 — Test Suite v7](#11-módulo-8--test-suite-v7)
12. [Módulo 9 — CI/CD v7](#12-módulo-9--cicd-v7)
13. [Módulo 10 — Rendimiento y memoria](#13-módulo-10--rendimiento-y-memoria)
14. [Plan de migración desde v6](#14-plan-de-migración-desde-v6)
15. [Cronograma detallado](#15-cronograma-detallado)
16. [Criterios de aceptación](#16-criterios-de-aceptación)
17. [Riesgos y mitigaciones](#17-riesgos-y-mitigaciones)

---

## 1. Visión General

### Qué cambia en v7

| Dimensión | v6.0 | v7.0 |
|-----------|------|------|
| Estructura | Archivo único (2000 líneas) | Multi-módulo con bundle |
| Lenguaje | JavaScript ES6+ | JS + JSDoc types (TypeScript fase 1) |
| Detección | Chroma cosine similarity | Chroma + CNN TF.js (blended) |
| Análisis estructural | No existe | Verse / Chorus / Bridge / Intro / Outro |
| Plataformas | Solo Spicetify (Spotify Desktop) | Spicetify + extensión Chrome/Firefox |
| Instrumentos | Solo guitarra | Guitarra + ukulele + piano + bajo |
| Build | Ninguno (copiar el .js) | esbuild → bundle único para distribución |
| Tests | 64 tests (unit + integration) | 150+ tests (unit + integration + e2e) |
| CI/CD | Test + release básico | Test + lint + type-check + bundle + release |

### Qué NO cambia en v7

- La instalación para el usuario final sigue siendo copiar un `.js` a Spicetify
- Las APIs externas (Spotify Audio Analysis, LRCLIB) siguen siendo las mismas
- La configuración de usuario persiste en `localStorage`
- Las funciones de exportación (TXT, JSON, ChordPro) funcionan igual
- Compatibilidad hacia atrás en los formatos de exportación

---

## 2. Diagnóstico del Estado Actual

### Deuda técnica identificada en v6

**Crítica (bloquea v7):**

1. **Monolito no ramificable** — `chorduction.js` no puede ser extendido sin conflictos. Agregar TF.js (500KB+) y la extensión YouTube en el mismo archivo lo haría inmanejable.

2. **Sin sistema de tipos** — Los objetos que cruzan módulos (ChordResult, AnalysisData, LyricsLine) no tienen contratos. Bugs de integración son difíciles de detectar.

3. **Tests duplican implementación** — Los tests en `chorduction.test.js` redefinen clases completas (Transposer, ChordNotation) en lugar de importarlas. Cuando cambia la implementación, los tests no detectan la diferencia.

**Alta prioridad:**

4. **CORS en web player** — La extensión falla silenciosamente en el web player de Spotify por restricciones CORS. El soporte YouTube requiere una solución diferente (content script).

5. **DOM selector fragility** — Los selectores CSS para inyectar el botón en el player dependen de clases de Spotify que cambian. Hay lógica de retry pero no hay observación de cambios.

6. **No hay separación entre lógica de negocio y Spicetify API** — `ChordDetector` llama directamente a `Spicetify.CosmosAsync`. Esto hace imposible probar la lógica de detección sin mockear el entorno completo.

**Media prioridad:**

7. **SmartCache no es genérico** — Hay 3 instancias hardcodeadas. No puede usarse en YouTube o en el paquete `@chorduction/core`.

8. **Logger no es configurable por módulo** — Un solo nivel global. En una arquitectura multi-módulo se necesita per-module logging.

9. **FileExporter no es extensible** — Agregar un nuevo formato requiere modificar la función `export()` directamente (no hay patrón registry).

### Métricas actuales (baseline para v7)

```
Líneas de código (src):     ~1,700
Módulos lógicos:            10
Tests pasando:              64
Cobertura estimada:         ~45% (módulos core)
Tiempo de análisis:         ~2-3s (API-bound)
Tamaño del archivo:         75.6 KB
Memoria estimada:           ~5 MB
Precisión chords:           ~70% (chroma cosine)
```

Estas métricas son el punto de comparación para v7.

---

## 3. Decisiones Arquitecturales

### 3.1 Build system: esbuild

**Por qué esbuild y no Rollup/Webpack:**
- Zero config para el caso de uso (bundle sin minificación, sin code splitting)
- Velocidad: build completo en <100ms
- Output single-file nativo: exactamente lo que Spicetify requiere
- No requiere Babel — esbuild transpila nativo
- Soporta TypeScript nativo (no requiere `tsc` en el pipeline)

**Configuración objetivo:**

```javascript
// build.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'build/chorduction.js',
  format: 'iife',          // Immediately Invoked — compatible con Spicetify
  target: 'es2020',
  external: [],            // Todo bundleado, sin dependencias externas en runtime
  minify: false,           // Legible para auditoría del usuario
  sourcemap: false,        // No en producción (el usuario instala el .js)
  define: {
    'process.env.NODE_ENV': '"production"',
    '__VERSION__': JSON.stringify(pkg.version),
  },
  banner: {
    js: `// Chorduction v${pkg.version} — https://github.com/user/chorduction\n// MIT License\n`
  }
});
```

**Scripts npm:**

```json
"scripts": {
  "build":       "node build.js",
  "build:watch": "node build.js --watch",
  "dev":         "node build.js --watch & cp -f build/chorduction.js ~/.spicetify/Extensions/ && spicetify apply",
  "test":        "jest",
  "test:watch":  "jest --watch",
  "test:coverage": "jest --coverage",
  "typecheck":   "tsc --noEmit",
  "lint":        "eslint src/",
  "release":     "npm run test && npm run build && npm version patch"
}
```

### 3.2 Separación de capas

El principio central de v7: **la lógica de música no sabe que existe Spicetify ni YouTube.**

```
┌────────────────────────────────────────────────────────┐
│                    PLATFORM LAYER                      │
│  src/platforms/spicetify/   src/platforms/youtube/     │
│  (conoce Spicetify API)     (conoce DOM YouTube)       │
└─────────────────────┬──────────────────────────────────┘
                      │ llama a
┌─────────────────────▼──────────────────────────────────┐
│                   SERVICE LAYER                        │
│  src/providers/   src/cache/   src/export/             │
│  (orquesta APIs externas, no conoce plataforma)        │
└─────────────────────┬──────────────────────────────────┘
                      │ llama a
┌─────────────────────▼──────────────────────────────────┐
│                     CORE LAYER                         │
│  src/core/   src/ml/                                   │
│  (pura lógica de música, sin I/O, completamente        │
│   testeable con Jest, sin mocks de plataforma)         │
└────────────────────────────────────────────────────────┘
```

**Regla estricta:** Las flechas solo van hacia abajo. Core nunca importa de providers. Providers nunca importan de platforms.

### 3.3 Patrón de inyección de dependencias (DI lite)

Los módulos del core no hacen `fetch`, no acceden a `localStorage`, no tocan el DOM. Reciben sus dependencias como parámetros o en construcción.

```javascript
// v6 (acoplado):
class ChordDetector {
  async analyze(trackId) {
    const data = await Spicetify.CosmosAsync.get(`...`);  // acoplado a Spicetify
    ...
  }
}

// v7 (desacoplado):
class ChordDetector {
  constructor({ analysisProvider, lyricsProvider, cache }) {
    this.analysisProvider = analysisProvider;  // inyectado
    this.lyricsProvider   = lyricsProvider;
    this.cache            = cache;
  }
  async analyze(trackId) {
    const data = await this.analysisProvider.get(trackId);  // abstracción
    ...
  }
}

// En Spicetify platform:
const detector = new ChordDetector({
  analysisProvider: new SpotifyAnalysisProvider(Spicetify),
  lyricsProvider:   new LyricsProviderChain([lrclib, spotifyLyrics]),
  cache:            cacheManager.get('analysis'),
});

// En tests:
const detector = new ChordDetector({
  analysisProvider: { get: jest.fn(() => mockData) },
  lyricsProvider:   { get: jest.fn(() => mockLyrics) },
  cache:            new SmartCache({ name: 'test', ttl: 1000 }),
});
```

---

## 4. Módulo 1 — Build System y Estructura Modular

### 4.1 Nueva estructura de directorios

```
chorduction/
│
├── src/                              ← TODO el código fuente
│   ├── index.js                      ← Entry point: wiring, init
│   ├── config.js                     ← DEFAULT_CONFIG, constantes
│   ├── version.js                    ← Semver, injected en build
│   │
│   ├── core/                         ← Lógica de música pura (sin I/O)
│   │   ├── chord-templates.js        ← 60 plantillas de acordes (12 roots × 5 tipos)
│   │   ├── key-detector.js           ← Krumhansl-Schmuckler
│   │   ├── chord-detector.js         ← Cosine similarity + smoothing
│   │   ├── chord-notation.js         ← 4 formatos de notación
│   │   ├── transposer.js             ← Transposición ±12 semitonos
│   │   └── section-detector.js       ← Verse/Chorus/Bridge (NUEVO)
│   │
│   ├── ml/                           ← Detección ML (NUEVO)
│   │   ├── ml-detector.js            ← Interfaz pública
│   │   ├── model-loader.js           ← Descarga + caché de pesos TF.js
│   │   ├── feature-extractor.js      ← Chroma matrix 12×8 para el modelo
│   │   ├── blend-strategy.js         ← Mezcla chroma + ML por confianza
│   │   └── correction-collector.js   ← Recolecta correcciones del usuario
│   │
│   ├── providers/                    ← Adaptadores de APIs externas
│   │   ├── analysis-provider.js      ← Interfaz + Spotify impl
│   │   ├── lyrics-provider-chain.js  ← Orquestador con fallback
│   │   ├── lrclib-provider.js        ← Adaptador LRCLIB
│   │   ├── spotify-lyrics-provider.js← Adaptador Spotify Lyrics
│   │   └── youtube-provider.js       ← Audio + captions YouTube (NUEVO)
│   │
│   ├── cache/
│   │   ├── smart-cache.js            ← Clase genérica SmartCache<K,V>
│   │   └── cache-manager.js          ← Instancias nombradas + factory
│   │
│   ├── export/
│   │   ├── file-exporter.js          ← Dispatcher + download trigger
│   │   ├── formatters/
│   │   │   ├── txt-formatter.js
│   │   │   ├── json-formatter.js     ← Schema v2 (con sections[])
│   │   │   └── chordpro-formatter.js ← Con section markers
│   │   └── formatter-registry.js     ← Patrón registry para formatos
│   │
│   ├── platforms/
│   │   ├── spicetify/
│   │   │   ├── index.js              ← Entry point Spicetify
│   │   │   ├── player-adapter.js     ← Wrap Spicetify.Player events
│   │   │   ├── cosmos-provider.js    ← SpotifyAnalysisProvider via CosmosAsync
│   │   │   ├── button-injector.js    ← Inyección + MutationObserver
│   │   │   └── menu-registrar.js     ← Spicetify.Menu registration
│   │   └── youtube/
│   │       ├── index.js              ← Entry point YouTube extension
│   │       ├── audio-capturer.js     ← Web Audio API on <video>
│   │       ├── caption-provider.js   ← YouTube caption API
│   │       └── page-observer.js      ← Detecta navegación SPA
│   │
│   ├── ui/
│   │   ├── modal.js                  ← Spicetify.PopupModal wrapper
│   │   ├── settings-panel.js         ← Panel de configuración
│   │   ├── chord-display.js          ← Render de progresión de acordes
│   │   ├── lyrics-display.js         ← Sincronización letras
│   │   ├── section-display.js        ← Etiquetas de sección (NUEVO)
│   │   └── instruments/
│   │       ├── guitar-fretboard.js   ← SVG guitarra (existente, refactorizado)
│   │       ├── ukulele-fretboard.js  ← SVG ukulele (NUEVO)
│   │       ├── piano-keys.js         ← SVG piano (NUEVO)
│   │       └── bass-fretboard.js     ← SVG bajo (NUEVO)
│   │
│   └── utils/
│       ├── logger.js                 ← Logger por módulo + niveles
│       ├── error-boundary.js         ← GlobalErrorBoundary
│       ├── cleanup-manager.js        ← Resource cleanup
│       ├── math.js                   ← cosine, pearson, binarySearch
│       ├── settings.js               ← LocalStorage persistence
│       └── i18n.js                   ← Traducciones (en, es)
│
├── build/
│   └── chorduction.js               ← Artefacto generado (NO editar)
│
├── tests/
│   ├── unit/                        ← Un archivo por módulo src/
│   │   ├── core/
│   │   │   ├── chord-detector.test.js
│   │   │   ├── key-detector.test.js
│   │   │   ├── transposer.test.js
│   │   │   ├── chord-notation.test.js
│   │   │   └── section-detector.test.js
│   │   ├── ml/
│   │   │   ├── feature-extractor.test.js
│   │   │   └── blend-strategy.test.js
│   │   ├── cache/
│   │   │   └── smart-cache.test.js
│   │   └── export/
│   │       ├── txt-formatter.test.js
│   │       ├── json-formatter.test.js
│   │       └── chordpro-formatter.test.js
│   │
│   ├── integration/                 ← Flujos multi-módulo
│   │   ├── analysis-pipeline.test.js
│   │   ├── lyrics-chain.test.js
│   │   ├── export-pipeline.test.js
│   │   ├── ml-blend.test.js
│   │   ├── section-pipeline.test.js
│   │   └── degradation.test.js
│   │
│   └── e2e/                         ← Mock Spicetify environment
│       ├── setup/
│       │   └── spicetify-mock.js    ← Mock completo del entorno
│       ├── chord-display.e2e.js
│       ├── settings-persistence.e2e.js
│       └── export-flow.e2e.js
│
├── docs/
│   ├── PLAN_V7.md                   ← Este archivo
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── research-competitors.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   ← Test + lint + typecheck + build
│       ├── release.yml              ← Versión + artifacts + GitHub Release
│       └── model-retrain.yml        ← Nightly ML model update
│
├── build.js                         ← Script esbuild
├── jest.config.js                   ← Config Jest (reemplaza campo en package.json)
├── tsconfig.json                    ← TypeScript config (checkJs, strict)
├── .eslintrc.js                     ← ESLint config
├── package.json
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

### 4.2 Proceso de extracción desde v6

La migración desde `chorduction.js` a `src/` es incremental y segura:

**Paso 1 — Extraer core (sin cambios de lógica):**
Copiar los objetos `Transposer`, `ChordNotation`, `FileExporter`, `SmartCache`, `ChordDetector` a sus archivos correspondientes en `src/core/` y `src/cache/`. Agregar `export`. No cambiar la lógica interna.

**Paso 2 — Extraer providers:**
Extraer `getAudioAnalysis()` y `fetchLyrics()` a `src/providers/`. Parametrizar las dependencias de `Spicetify` como argumentos.

**Paso 3 — Extraer UI:**
Extraer las funciones de render de modal, fretboard, y botones a `src/ui/`.

**Paso 4 — Extraer platform:**
Crear `src/platforms/spicetify/` con los event listeners y el wiring de Spicetify.

**Paso 5 — Crear entry point:**
`src/index.js` instancia todo y conecta las capas.

**Paso 6 — Configurar esbuild:**
El bundle de `src/index.js` debe producir un `build/chorduction.js` funcionalmente idéntico a `chorduction.js` v6.

**Paso 7 — Validar:**
Correr los 64 tests existentes contra el bundle. Todos deben pasar sin cambios en los tests.

---

## 5. Módulo 2 — TypeScript (Fase 1)

### 5.1 Estrategia: JSDoc + `checkJs`

No migramos a `.ts` en v7. En cambio, activamos el type-checker de TypeScript sobre el código `.js` mediante `checkJs: true`. Esto da:
- Detección de errores de tipo en CI sin reescribir el código
- IDEs que muestran tipos y errores en tiempo real
- Base para migración gradual a `.ts` en v7.1+
- Costo de adopción: cero (no hay que cambiar la sintaxis)

### 5.2 Configuración `tsconfig.json`

```json
{
  "compilerOptions": {
    "checkJs": true,
    "allowJs": true,
    "strict": true,
    "noEmit": true,
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM"],
    "baseUrl": "./src",
    "paths": {
      "@core/*": ["core/*"],
      "@ml/*": ["ml/*"],
      "@providers/*": ["providers/*"],
      "@cache/*": ["cache/*"],
      "@export/*": ["export/*"],
      "@ui/*": ["ui/*"],
      "@utils/*": ["utils/*"]
    }
  },
  "include": ["src/**/*.js", "tests/**/*.js"],
  "exclude": ["node_modules", "build", "deprecated"]
}
```

### 5.3 Tipos definidos con JSDoc

Todos los objetos que cruzan módulos tienen `@typedef` explícitos en `src/types.js`:

```javascript
// src/types.js

/**
 * @typedef {Object} ChromaVector
 * @property {number[]} pitches - Array de 12 floats, energía por clase de tono
 * @property {number} duration  - Duración del segmento en segundos
 * @property {number} start     - Tiempo de inicio en segundos
 * @property {number} confidence
 */

/**
 * @typedef {Object} ChordResult
 * @property {string}  chord       - Nombre del acorde en notación actual
 * @property {string}  rawChord    - Nombre sin transposición ni conversión
 * @property {number}  confidence  - 0–1
 * @property {number}  startTime   - Segundos
 * @property {number}  endTime     - Segundos
 * @property {number}  beatIndex
 */

/**
 * @typedef {Object} SectionLabel
 * @property {'intro'|'verse'|'chorus'|'bridge'|'outro'|'unknown'} type
 * @property {number} startTime
 * @property {number} endTime
 * @property {number} repetitionIndex - Cuántas veces apareció esta sección
 */

/**
 * @typedef {Object} LyricsLine
 * @property {number} time     - Tiempo en segundos
 * @property {string} text     - Texto de la línea
 * @property {string} [chord]  - Acorde correspondiente (si está sincronizado)
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {ChordResult[]}  chords
 * @property {string}         key        - e.g. "C", "F#m"
 * @property {number}         keyConfidence
 * @property {number}         tempo      - BPM
 * @property {string}         timeSignature - e.g. "4/4"
 * @property {SectionLabel[]} sections
 * @property {LyricsLine[]}   lyrics
 * @property {string}         trackId
 * @property {number}         analyzedAt - timestamp
 */

/**
 * @typedef {Object} ExportData
 * @property {Object}         meta
 * @property {string}         meta.title
 * @property {string}         meta.artist
 * @property {string}         meta.key
 * @property {number}         meta.tempo
 * @property {string}         meta.version
 * @property {string}         meta.exportedAt  - ISO 8601
 * @property {ChordResult[]}  chords
 * @property {SectionLabel[]} sections
 * @property {LyricsLine[]}   lyrics
 */

/**
 * @template K, V
 * @typedef {Object} CacheEntry
 * @property {V}      value
 * @property {number} createdAt
 * @property {number} lastAccess
 * @property {number} accessCount
 */
```

### 5.4 Anotaciones en módulos core

```javascript
// src/core/transposer.js

/**
 * @param {string} chord     - Nombre del acorde (e.g. "Am", "G7", "Cmaj7")
 * @param {number} semitones - Semitonos a transponer (−12 a +12)
 * @returns {string}         - Acorde transpuesto
 */
export function transpose(chord, semitones) { ... }

/**
 * @param {string} note - Nombre de la nota ("C", "F#", "Bb")
 * @returns {number}    - Índice cromático (0–11), o −1 si no reconoce
 */
export function noteToIndex(note) { ... }
```

### 5.5 Comando en CI

```yaml
- name: Type check
  run: npx tsc --noEmit
```

---

## 6. Módulo 3 — ML Chord Detection

### 6.1 Justificación

El detector actual (cosine similarity sobre chroma) tiene un techo teórico de precisión de ~75–80% en condiciones óptimas. Los errores sistemáticos son:

- **Acordes con tensiones** (maj7, m9, sus4): El vector binario de la plantilla no captura el peso relativo de los armónicos
- **Acordes superpuestos** (slash chords: C/E): Dos centros tonales simultáneos confunden el detector
- **Transiciones rápidas**: Un beat de 0.3s a 180BPM no da suficiente chroma estable
- **Grabaciones con reverb/compresión**: La chroma se difumina hacia los armónicos superiores

Una CNN sobre secuencias de chroma (contexto temporal) puede aprender estos patrones y alcanzar ~85–90% de precisión.

### 6.2 Arquitectura del modelo

**Input:** Matriz 12 × 16 — los 12 tonos cromáticos × 16 beats de contexto (8 antes + beat actual + 7 después)

**Por qué 16 beats:** Un compás de 4/4 = 4 beats. 16 beats = 4 compases de contexto. Esto permite al modelo ver la progresión completa y usar contexto armónico (un acorde es más probable si el anterior era su dominante).

**Arquitectura:**

```
Input: (batch, 12, 16, 1)  ← Imagen 12×16 de 1 canal
         │
         ▼
Conv2D(32, kernel=(3,3), activation='relu', padding='same')
         │
         ▼
MaxPooling2D((2,2))          → (batch, 6, 8, 32)
         │
         ▼
Conv2D(64, kernel=(3,3), activation='relu', padding='same')
         │
         ▼
MaxPooling2D((2,2))          → (batch, 3, 4, 64)
         │
         ▼
Flatten                      → (batch, 768)
         │
         ▼
Dense(256, activation='relu')
         │
         ▼
Dropout(0.3)
         │
         ▼
Dense(128, activation='relu')
         │
         ▼
Dense(73, activation='softmax')   ← 73 clases de acordes
```

**73 clases de acordes:**
- 12 raíces × 5 cualidades = 60 acordes fundamentales
  - major, minor, dominant 7, major 7, minor 7
- + 12 acordes suspended 2 (sus2)
- + 1 clase "N.C." (no chord / silencio)
= 73 total

**Parámetros del modelo:** ~850K parámetros
**Tamaño estimado (float16):** ~1.7 MB
**Tamaño gzipped:** ~800 KB
**Tiempo de inferencia:** < 5ms en WebGL backend

### 6.3 Dataset de entrenamiento

**Fuentes:**
1. **CASD (Chord Annotated Song Dataset)** — 200 canciones con anotaciones manuales verificadas, géneros variados
2. **Beatles Annotations** — 180 canciones de los Beatles, dataset académico de referencia (Harte, 2010)
3. **RWC Music Database** — 315 piezas, includye jazz y pop
4. **Generación sintética** — Generar chromagramas desde MIDI con síntesis de piano para aumentar el dataset en acordes raros

**Preprocesamiento:**
1. Extraer chromagramas con librosa (hop_length=512, n_fft=4096)
2. Normalizar por L2-norm por beat
3. Construir ventanas de 16 beats con stride 1 (data augmentation implícita)
4. Split: 70% train / 15% validation / 15% test
5. Balancear clases: oversample acordes raros (dim, aug, sus)

**Total estimado:** ~50,000 ejemplos de entrenamiento

### 6.4 Pipeline de entrenamiento (offline)

```python
# scripts/train_model.py — ejecutado en GitHub Actions (no en el browser)

import tensorflow as tf
import numpy as np
from data_loader import load_casd, load_beatles, load_rwc

# Cargar y preprocesar
X_train, y_train = prepare_dataset([load_casd(), load_beatles(), load_rwc()])

# Definir modelo
model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(12, 16, 1)),
    tf.keras.layers.Conv2D(32, (3,3), activation='relu', padding='same'),
    tf.keras.layers.MaxPooling2D((2,2)),
    tf.keras.layers.Conv2D(64, (3,3), activation='relu', padding='same'),
    tf.keras.layers.MaxPooling2D((2,2)),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(256, activation='relu'),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dense(73, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy', 'top_3_accuracy']
)

# Entrenar
model.fit(X_train, y_train, epochs=50, validation_split=0.15,
          callbacks=[tf.keras.callbacks.EarlyStopping(patience=5)])

# Convertir a TF.js
import tensorflowjs as tfjs
tfjs.converters.save_keras_model(model, 'model/tfjs_model')
# Produce: model.json + group1-shard1of1.bin
```

### 6.5 Integración en el browser (TF.js)

```javascript
// src/ml/model-loader.js

const MODEL_URL = 'https://cdn.chorduction.app/models/v7/model.json';
const MODEL_CACHE_KEY = 'chorduction-tfjs-model-v7';

export class ModelLoader {
  constructor({ logger, cache }) {
    this.logger = logger;
    this.cache  = cache;
    this.model  = null;
    this.loading = false;
  }

  /** @returns {Promise<boolean>} true si el modelo cargó */
  async load() {
    if (this.model) return true;
    if (this.loading) {
      // Esperar a que termine la carga en curso
      await this._waitForLoad();
      return !!this.model;
    }

    this.loading = true;
    try {
      // TF.js cachea el modelo en IndexedDB automáticamente
      this.model = await tf.loadLayersModel(
        `indexeddb://${MODEL_CACHE_KEY}`,
        { fromTFHub: false }
      );
      this.logger.debug('[ModelLoader] Loaded from IndexedDB cache');
    } catch {
      try {
        this.model = await tf.loadLayersModel(MODEL_URL);
        await this.model.save(`indexeddb://${MODEL_CACHE_KEY}`);
        this.logger.info('[ModelLoader] Downloaded and cached model');
      } catch (err) {
        this.logger.warn('[ModelLoader] Failed to load ML model:', err.message);
        this.model = null;
      }
    } finally {
      this.loading = false;
    }
    return !!this.model;
  }

  async predict(chromaMatrix12x16) {
    if (!this.model) throw new Error('Model not loaded');
    const tensor = tf.tensor4d([chromaMatrix12x16], [1, 12, 16, 1]);
    const prediction = this.model.predict(tensor);
    const probs = await prediction.data();
    tensor.dispose();
    prediction.dispose();
    return Array.from(probs); // Array de 73 probabilidades
  }
}
```

### 6.6 Feature extractor

```javascript
// src/ml/feature-extractor.js

/**
 * Construye la matriz 12×16 para el modelo a partir de los segmentos Spotify.
 * @param {ChromaVector[]} segments
 * @param {number} centerBeat  - Índice del beat a analizar
 * @returns {number[][]}       - Matriz [12][16]
 */
export function buildChromaMatrix(segments, centerBeat) {
  const CONTEXT_BEFORE = 8;
  const CONTEXT_AFTER  = 7;
  const matrix = [];

  for (let pitch = 0; pitch < 12; pitch++) {
    const row = [];
    for (let offset = -CONTEXT_BEFORE; offset <= CONTEXT_AFTER; offset++) {
      const beatIdx = centerBeat + offset;
      if (beatIdx < 0 || beatIdx >= segments.length) {
        row.push(0.0);  // padding
      } else {
        row.push(segments[beatIdx].pitches[pitch] ?? 0.0);
      }
    }
    matrix.push(row);
  }

  // L2 normalization
  const norm = Math.sqrt(matrix.flat().reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 16; j++)
        matrix[i][j] /= norm;
  }

  return matrix;
}
```

### 6.7 Blend strategy

```javascript
// src/ml/blend-strategy.js

const ML_CONFIDENCE_THRESHOLD   = 0.7;  // Si ML > 0.7, usar ML
const CHROMA_CONFIDENCE_THRESHOLD = 0.6; // Si ML < 0.7 pero chroma > 0.6, usar chroma
const BLEND_ABOVE               = 0.5;  // Entre 0.5–0.7: blend ponderado

/**
 * @param {ChordResult} chromaResult
 * @param {{chord: string, confidence: number}|null} mlResult
 * @returns {ChordResult}
 */
export function blendResults(chromaResult, mlResult) {
  if (!mlResult) return chromaResult;  // ML no disponible: usar chroma

  const mlConf     = mlResult.confidence;
  const chromaConf = chromaResult.confidence;

  if (mlConf >= ML_CONFIDENCE_THRESHOLD) {
    // ML muy confiado: usar ML
    return { ...chromaResult, chord: mlResult.chord, confidence: mlConf, source: 'ml' };
  }

  if (mlConf < BLEND_ABOVE) {
    // ML poco confiado: usar chroma
    return { ...chromaResult, source: 'chroma' };
  }

  // Zona de blend: si coinciden, boost de confianza; si discrepan, chroma gana
  if (mlResult.chord === chromaResult.chord) {
    const blended = Math.min(1, (mlConf + chromaConf) / 2 + 0.1);
    return { ...chromaResult, confidence: blended, source: 'blend' };
  }

  // Discrepan: elegir el más confiado, con penalización
  return mlConf > chromaConf
    ? { ...chromaResult, chord: mlResult.chord, confidence: mlConf * 0.9, source: 'ml-uncertain' }
    : { ...chromaResult, confidence: chromaConf * 0.9, source: 'chroma-uncertain' };
}
```

### 6.8 Correction collector (fine-tuning continuo)

Cuando el usuario corrige manualmente un acorde, la corrección se persiste localmente y se puede usar para mejorar el modelo:

```javascript
// src/ml/correction-collector.js

const CORRECTIONS_KEY = 'chorduction-corrections-v7';
const MAX_CORRECTIONS = 500;

export class CorrectionCollector {
  /** Guardar una corrección */
  save(chromaMatrix, predictedChord, correctChord) {
    const corrections = this._load();
    corrections.push({
      chroma:    chromaMatrix,
      predicted: predictedChord,
      correct:   correctChord,
      timestamp: Date.now()
    });

    // Mantener solo las últimas MAX_CORRECTIONS
    if (corrections.length > MAX_CORRECTIONS)
      corrections.splice(0, corrections.length - MAX_CORRECTIONS);

    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
  }

  /** Exportar para fine-tuning manual */
  export() {
    return this._load();
  }

  _load() {
    try {
      return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) ?? '[]');
    } catch { return []; }
  }
}
```

En v8 se planifica una API para subir correcciones anónimas al servidor de entrenamiento.

---

## 7. Módulo 4 — Section Detection

### 7.1 Concepto y fundamento musical

Una "sección" es un segmento temporal con identidad estructural: Intro, Verso, Coro, Puente, Outro. La estructura de una canción pop típica es ABABCB (Verso-Coro-Verso-Coro-Puente-Coro), aunque hay miles de variaciones.

Los marcadores acústicos de cada sección:
- **Coro:** Mayor energía sonora (loudness), mayor densidad de notas, centros tonales más estables, alta repetición
- **Verso:** Energía media, variación melódica, menos repetición
- **Puente:** Alta novedad (diferente de secciones anteriores), baja repetición, frecuentemente cambio de modo (mayor↔menor)
- **Intro/Outro:** Posición temporal + baja densidad armónica o fade-in/fade-out de energía

### 7.2 Algoritmo de detección

**Paso 1: Construir la matriz de auto-similitud de chroma**

Para cada par de segmentos (i, j) de la canción, computar la similitud de sus vectores de chroma:

```javascript
// S[i][j] = similitud chroma entre el segmento i y el segmento j
function buildSimilarityMatrix(segments) {
  const n = segments.length;
  const S = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      const sim = cosineSimilarity(segments[i].pitches, segments[j].pitches);
      S[i][j] = sim;
      S[j][i] = sim;  // simétrica
    }
  return S;
}
```

La matriz resultante muestra bloques de alta similitud en la diagonal → secciones repetidas producen bloques paralelos fuera de la diagonal.

**Paso 2: Detección de novelty (cambios estructurales)**

Aplicar un kernel de "tablero de ajedrez" a la diagonal de la matriz de similitud:

```javascript
// Kernel de Foote (2000) para detección de cambios estructurales
function computeNovelty(S, kernelSize = 8) {
  const n = S.length;
  const novelty = new Float32Array(n);

  for (let i = kernelSize; i < n - kernelSize; i++) {
    let score = 0;
    for (let di = 0; di < kernelSize; di++)
      for (let dj = 0; dj < kernelSize; dj++) {
        // Bloques diagonales (alta similitud interna) vs bloques cruzados (baja)
        const internal = S[i - di][i - dj] + S[i + di][i + dj];
        const cross    = S[i - di][i + dj] + S[i + di][i - dj];
        score += internal - cross;
      }
    novelty[i] = Math.max(0, score / (kernelSize * kernelSize));
  }
  return novelty;
}
```

Los picos de novelty corresponden a cambios de sección.

**Paso 3: Identificar límites de sección**

Encontrar los picos prominentes en la curva de novelty usando un threshold adaptativo:

```javascript
function findBoundaries(novelty, minDuration = 8) {
  const threshold = mean(novelty) + 0.5 * std(novelty);
  const boundaries = [0];

  for (let i = 1; i < novelty.length - 1; i++) {
    const isPeak = novelty[i] > novelty[i-1] && novelty[i] > novelty[i+1];
    const isAboveThreshold = novelty[i] > threshold;
    const isDistant = i - boundaries[boundaries.length - 1] >= minDuration;
    if (isPeak && isAboveThreshold && isDistant)
      boundaries.push(i);
  }

  boundaries.push(novelty.length - 1);
  return boundaries;
}
```

**Paso 4: Agrupar segmentos en secciones**

Segmentos entre dos boundaries consecutivos forman una sección candidata. Computar su vector de chroma promedio.

**Paso 5: Etiquetar por similitud y posición**

```javascript
function labelSections(sections, analysis) {
  // Identificar grupos de secciones similares (misma posición en la diagonal → misma etiqueta)
  const groups = clusterBySimilarity(sections, threshold=0.85);

  // El grupo más repetido con mayor energía → CHORUS
  // El primer grupo → INTRO (si corto < 16s)
  // El último grupo → OUTRO (si fade-out o corto)
  // Grupos alternantes → VERSE
  // Grupo de alta novedad, baja repetición → BRIDGE

  return sections.map(section => ({
    ...section,
    type: assignLabel(section, groups, analysis)
  }));
}
```

**Paso 6: Convertir a timestamps**

Los índices de segmento se convierten a segundos usando el mapa de tiempos de los segmentos de Spotify Audio Analysis.

### 7.3 Integración con ChordDetector

```javascript
// src/core/section-detector.js

export class SectionDetector {
  /**
   * @param {ChromaVector[]} segments
   * @param {Object} analysisMetadata  - { loudness, tempo, duration }
   * @returns {SectionLabel[]}
   */
  detect(segments, analysisMetadata) {
    const S         = buildSimilarityMatrix(segments);
    const novelty   = computeNovelty(S);
    const boundaries = findBoundaries(novelty);
    const rawSections = segmentsToSections(segments, boundaries);
    return labelSections(rawSections, analysisMetadata);
  }
}
```

`ChordDetector.processAnalysis()` llama a `SectionDetector.detect()` y agrega `sections[]` al `AnalysisResult`.

### 7.4 Integración con UI

```
┌─────────────────────────────────────────────┐
│  [INTRO]                          0:00–0:16  │
│  C  →  G  →  Am  →  F                       │
│                                              │
│  [VERSE 1]                        0:16–0:48  │
│  C  →  G  →  Am  →  F                       │
│  C  →  G  →  Em  →  F                       │
│                                              │
│ ▶ [CHORUS]  ←── resaltado actual  0:48–1:04  │
│  F  →  C  →  G  →  Am                       │
│  F  →  C  →  G  →  G                        │
│                                              │
│  [VERSE 2]                        1:04–1:36  │
│  ...                                         │
└─────────────────────────────────────────────┘
```

### 7.5 Integración con export

**TXT v2:**
```
# Song Title - Artist
# Key: C Major | Tempo: 120 BPM | 4/4

[INTRO] (0:00 – 0:16)
[0:00] C  [0:04] G  [0:08] Am  [0:12] F

[VERSE] (0:16 – 0:48)
[0:16] C  [0:20] G  [0:24] Am  [0:28] F
...

[CHORUS] (0:48 – 1:04)
[0:48] F  [0:52] C  [0:56] G  [1:00] Am
...
```

**JSON v2:**
```json
{
  "meta": { ... },
  "sections": [
    { "type": "intro",  "startTime": 0,    "endTime": 16,  "repetitionIndex": 0 },
    { "type": "verse",  "startTime": 16,   "endTime": 48,  "repetitionIndex": 1 },
    { "type": "chorus", "startTime": 48,   "endTime": 64,  "repetitionIndex": 1 }
  ],
  "chords": [ ... ]
}
```

**ChordPro v2:**
```
{title: Song Title}
{artist: Artist}
{key: C}

{comment: Intro}
[C][G][Am][F]

{comment: Verse 1}
[C]First line of [G]lyrics here
...

{start_of_chorus}
[F]Chorus line [C]here
{end_of_chorus}
```

---

## 8. Módulo 5 — YouTube Support

### 8.1 Arquitectura: extensión de navegador separada

El soporte YouTube **no** es parte de `chorduction.js`. Es una extensión de Chrome/Firefox independiente que comparte la lógica core mediante el paquete `@chorduction/core`.

**Por qué separada:**
- Spicetify y extensiones de browser tienen modelos de seguridad completamente distintos
- YouTube requiere Web Audio API sobre el elemento `<video>`, lo cual no aplica a Spotify
- Mantener un solo `.js` gigante con ambos contextos sería inmanejable

### 8.2 Paquete compartido `@chorduction/core`

```bash
npm init -w packages/core
```

```
packages/core/
├── src/
│   ├── index.js              ← Re-exporta todo lo público
│   ├── chord-detector.js     ← Copiado de src/core/
│   ├── key-detector.js
│   ├── chord-notation.js
│   ├── transposer.js
│   ├── section-detector.js
│   ├── smart-cache.js
│   └── types.js
├── package.json              ← name: "@chorduction/core"
└── README.md
```

Tanto la extensión Spicetify como la extensión YouTube dependen de `@chorduction/core`. esbuild bundlea el core dentro de cada extensión — el usuario no instala el paquete por separado.

### 8.3 Arquitectura técnica de la extensión YouTube

**Tipo:** Chrome Extension Manifest V3 + Firefox Add-on (WebExtensions API compatible)

**Componentes:**

```
youtube-extension/
├── manifest.json             ← MV3 config
├── background/
│   └── service-worker.js    ← Intercepta navigation, gestiona estado global
├── content/
│   ├── chorduction-yt.js    ← Injected en youtube.com/watch
│   ├── audio-capturer.js    ← Web Audio API sobre <video>
│   ├── caption-provider.js  ← YouTube Captions API
│   └── ui-overlay.js        ← Overlay chord display en el video
├── popup/
│   ├── popup.html
│   └── popup.js             ← Mini-panel de settings
└── icons/
    └── icon-*.png
```

**Flujo de datos YouTube:**

```
Usuario abre youtube.com/watch?v=...
        │
        ▼
content/chorduction-yt.js se inyecta
        │
        ├─ Obtiene título y artista del DOM de YouTube
        ├─ Extrae trackId como videoId
        │
        ▼
audio-capturer.js
        │
        ├─ audioCtx = new AudioContext()
        ├─ source = audioCtx.createMediaElementSource(<video>)
        ├─ analyser = audioCtx.createAnalyser()
        ├─ source.connect(analyser) → analyser.connect(audioCtx.destination)
        │
        ├─ Cada 50ms: analyser.getFloatFrequencyData(buffer)
        │   → Convertir FFT a chromagrama (12 tonos)
        │   → Acumular en ventana de 1 beat (según BPM estimado)
        │
        ▼
@chorduction/core ChordDetector.detectChord(chroma)
        │
        ▼
ui-overlay.js renderiza chord sobre el video
```

**Diferencias técnicas vs Spicetify:**

| Aspecto | Spicetify | YouTube |
|---------|-----------|---------|
| Fuente de audio | Spotify Audio Analysis API | Web Audio API (análisis en tiempo real) |
| Calidad de análisis | Alta (datos pre-calculados por Spotify) | Media (FFT en tiempo real, sin datos de beat) |
| Lyrics | LRCLIB / Spotify | YouTube Captions API |
| Beat tracking | Spotify provee beats[] | Estimación propia (onset detection) |
| Sección detection | Spotify provee segments[] | Calculado sobre chroma en tiempo real |
| CORS | Problema en web player | No aplica (content script) |

**Limitaciones conocidas:**
- La calidad del análisis en tiempo real es menor a la de Spotify Audio Analysis
- Videos con audio procesado (EDM, hip-hop fuertemente producido) tienen menor precisión
- No funciona en videos con restricciones DRM

### 8.4 Sincronización de playback YouTube

YouTube no tiene una API pública estable de eventos de playback. La estrategia:

```javascript
// content/chorduction-yt.js

// Observar el elemento de video
const video = document.querySelector('video');

video.addEventListener('timeupdate', (e) => {
  const currentTime = video.currentTime;
  // Buscar el acorde correspondiente en la timeline (binary search)
  const chord = timeline.getChordAt(currentTime);
  overlay.update(chord);
});

video.addEventListener('seeking', () => {
  // Flush el buffer de chroma al buscar en el video
  audioCapt.flushBuffer();
});
```

### 8.5 YouTube Caption Provider

```javascript
// content/caption-provider.js

export class YouTubeCaptionProvider {
  async fetch(videoId, lang = 'en') {
    // YouTube expone las captions en la respuesta inicial del video (ytInitialPlayerResponse)
    const playerResponse = window.ytInitialPlayerResponse;
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captions?.length) return null;

    // Preferir captions manuales sobre auto-generadas
    const track = captions.find(c => c.kind !== 'asr' && c.languageCode === lang)
                 ?? captions.find(c => c.languageCode === lang)
                 ?? captions[0];

    const response = await fetch(track.baseUrl + '&fmt=json3');
    const data = await response.json();

    return this._parse(data);
  }

  _parse(data) {
    return data.events
      .filter(e => e.segs)
      .map(e => ({
        time: e.tStartMs / 1000,
        text: e.segs.map(s => s.utf8).join('').trim()
      }));
  }
}
```

---

## 9. Módulo 6 — Instrument Expansion

### 9.1 Diseño SVG unificado

Todos los instrumentos comparten una interfaz común:

```javascript
// src/ui/instruments/base-instrument.js

export class BaseInstrument {
  /**
   * @param {string} chord  - Nombre del acorde a mostrar
   * @returns {string}      - SVG string
   */
  render(chord) {
    const fingering = this.getFingering(chord);
    if (!fingering) return this.renderUnknown(chord);
    return this.renderDiagram(fingering);
  }

  getFingering(chord) { throw new Error('implement in subclass'); }
  renderDiagram(fingering) { throw new Error('implement in subclass'); }
  renderUnknown(chord) { return `<svg>...</svg>`; }
}
```

### 9.2 Guitarra (refactorizado desde v6)

Actualmente los fingerings están como un objeto literal dentro del modal. En v7:

```javascript
// src/ui/instruments/guitar-fretboard.js

export class GuitarFretboard extends BaseInstrument {
  // 60 acordes: 12 raíces × 5 cualidades
  // Formato: [cuerda1, cuerda2, cuerda3, cuerda4, cuerda5, cuerda6]
  // -1 = cuerda no tocada, 0 = cuerda al aire, N = traste N
  static FINGERINGS = {
    'C':     [0, 3, 2, 0, 1, 0],
    'Cm':    [0, 3, 5, 5, 4, 3],
    'C7':    [0, 3, 2, 3, 1, 0],
    'Cmaj7': [0, 3, 2, 0, 0, 0],
    'Cm7':   [0, 3, 5, 3, 4, 3],
    'D':     [-1, -1, 0, 2, 3, 2],
    // ... (60 total)
  };

  getFingering(chord) {
    return GuitarFretboard.FINGERINGS[chord] ?? null;
  }

  renderDiagram(fingering) {
    // SVG grid 5 trastes × 6 cuerdas
    // Puntos en las posiciones de los dedos
    // Círculo abierto en cuerdas al aire, X en cuerdas silenciadas
    ...
  }
}
```

**SVG estructura:**
```
  e B G D A E
  │ │ │ │ │ │
──┼─┼─┼─┼─┼─┤  ← cejilla (si aplica)
  │ │ ●─●─│ │
──┼─┼─┼─┼─┼─┤
  │ │ │ │ ● │
──┼─┼─┼─┼─┼─┤
  │ │ │ │ │ │
──┴─┴─┴─┴─┴─┘
```

### 9.3 Ukulele

4 cuerdas (G, C, E, A). Fingerings propios (distintos a guitarra aunque el acorde tenga el mismo nombre).

```javascript
// src/ui/instruments/ukulele-fretboard.js

export class UkuleleFretboard extends BaseInstrument {
  // [cuerda G, cuerda C, cuerda E, cuerda A]
  static FINGERINGS = {
    'C':  [0, 0, 0, 3],
    'Cm': [0, 3, 3, 3],
    'G':  [0, 2, 3, 2],
    'Am': [2, 0, 0, 0],
    // ...
  };
}
```

### 9.4 Piano

No hay "trastes" — mostrar las teclas resaltadas de la octava central.

```javascript
// src/ui/instruments/piano-keys.js

export class PianoKeys extends BaseInstrument {
  // Notas que componen el acorde (índices cromáticos 0–11)
  static CHORD_NOTES = {
    'C':  [0, 4, 7],          // C  E  G
    'Cm': [0, 3, 7],          // C  Eb G
    'C7': [0, 4, 7, 10],      // C  E  G  Bb
    // ...
  };

  renderDiagram(notes) {
    // SVG de 1 octava (C4–B4): 7 teclas blancas + 5 negras
    // Las teclas del acorde se resaltan en verde (#1db954)
    const whites = ['C','D','E','F','G','A','B'];
    const blacks = { 1:'C#', 3:'D#', 6:'F#', 8:'G#', 10:'A#' };
    ...
  }
}
```

**Preview:**
```
┌──┬─┬──┬─┬──┬──┬─┬──┬─┬──┬─┬──┐
│  │█│  │█│  │  │█│  │█│  │█│  │
│  │ │  │ │  │  │ │  │ │  │ │  │
│  └─┘  └─┘  │  └─┘  └─┘  └─┘  │
│  C  D  E  F  G  A  B          │
│  ▲        ▲  ▲  ← resaltados  │
└──────────────────────────────-─┘
```

### 9.5 Bajo

Solo la posición de la nota raíz en el mástil (posición más cómoda en cuerdas E y A).

```javascript
// src/ui/instruments/bass-fretboard.js

export class BassFretboard extends BaseInstrument {
  // [cuerda E, cuerda A] — solo raíz en posición más baja
  static ROOT_POSITIONS = {
    'C':  { string: 'A', fret: 3 },
    'C#': { string: 'A', fret: 4 },
    'D':  { string: 'A', fret: 5 },
    'E':  { string: 'E', fret: 7 },
    // ...
  };
}
```

### 9.6 Selector de instrumento en Settings

```
Instrument: [ Guitar ▼ ]
            [ Guitar   ]
            [ Ukulele  ]
            [ Piano    ]
            [ Bass     ]
```

Persiste en `localStorage`. El diagrama se actualiza en tiempo real al cambiar.

---

## 10. Módulo 7 — UI/UX Overhaul

### 10.1 Problemas de UI en v6

1. **Modal monolítico** — `buildContent()` genera todo el HTML en un template string de 300+ líneas. Actualizar una sola sección requiere re-renderizar todo.
2. **Sin estado local de UI** — Los datos del análisis, el instrumento activo, y el transpose viven en variables globales. Difícil de razonar en múltiples pantallas.
3. **Sin transición entre canciones** — El modal se vacía bruscamente y vuelve a llenarse.
4. **Fretboard no escala** — SVG fijo en px, se ve mal en monitores 4K o con zoom del browser.

### 10.2 Arquitectura UI v7: componentes ligeros

Sin framework (no hay React ni Vue en Spicetify). En cambio, un patrón de componentes mínimo propio:

```javascript
// src/ui/component.js

export class Component {
  constructor(container) {
    this.container = container;
    this.state = {};
  }

  setState(partial) {
    const prev = this.state;
    this.state = { ...this.state, ...partial };
    if (this._changed(prev, this.state)) this.render();
  }

  render() {
    this.container.innerHTML = this.template(this.state);
    this.bindEvents();
  }

  template(state) { return ''; }
  bindEvents() {}

  _changed(prev, next) {
    // Shallow comparison de las claves que importan
    return JSON.stringify(prev) !== JSON.stringify(next);
  }
}
```

Cada sección de la UI es un componente con su propio estado:

```
Modal
├── HeaderComponent         (título, artista, key, BPM)
├── SectionNavComponent     (lista de secciones, sección activa)
├── ChordDisplayComponent   (progresión con highlight del beat actual)
├── LyricsComponent         (letras sincronizadas)
├── InstrumentComponent     (diagrama del instrumento activo)
├── TransposeComponent      (control de transposición)
└── SettingsComponent       (panel de configuración)
```

### 10.3 Transiciones

```javascript
// Al cambiar de canción:
async function onTrackChange(track) {
  ui.setLoadingState(track);         // Muestra skeleton + "Analyzing..."
  const result = await analyze(track);
  ui.setAnalysisResult(result);      // Transición con CSS fade-in
}
```

```css
/* En el CSS inyectado por el modal */
.chorduction-content {
  transition: opacity 0.2s ease;
}
.chorduction-content.loading {
  opacity: 0.4;
}
```

### 10.4 SVG responsivo

Todos los diagramas de instrumentos usan `viewBox` en lugar de dimensiones fijas:

```javascript
// Antes (v6):
`<svg width="120" height="150">`

// Después (v7):
`<svg viewBox="0 0 120 150" style="width:100%;max-width:120px;height:auto">`
```

### 10.5 Teclado y accesibilidad

- Todos los botones interactivos tienen `aria-label`
- La sección activa tiene `aria-current="true"`
- El foco se mueve al modal al abrirlo (`focus()` en el primer elemento interactivo)
- `Escape` cierra el modal (ya existe en v6, verificar)
- `Tab` navega entre controles

---

## 11. Módulo 8 — Test Suite v7

### 11.1 Principio: los tests importan el código real

El mayor problema de los tests en v6 es que redefinen las clases completas:

```javascript
// v6 tests — MALO:
describe('Transposer', () => {
  const Transposer = {
    transpose(chord, n) { ... }  // ← reimplementación, no testea el código real
  };
  test(...);
});

// v7 tests — CORRECTO:
import { transpose } from '../../src/core/transposer.js';
describe('transpose()', () => {
  test('C + 2 semitones = D', () => {
    expect(transpose('C', 2)).toBe('D');
  });
});
```

Con la arquitectura modular de v7, esto es directo.

### 11.2 Estructura de tests

**Unit tests — `tests/unit/`**

Un archivo por módulo. Solo dependen del módulo que testean. Cero mocks de plataforma.

```javascript
// tests/unit/core/chord-detector.test.js
import { ChordDetector } from '../../../src/core/chord-detector.js';

const mockAnalysisProvider = { get: jest.fn() };
const mockLyricsProvider   = { get: jest.fn() };
const mockCache            = { get: jest.fn(() => null), set: jest.fn() };

describe('ChordDetector', () => {
  let detector;
  beforeEach(() => {
    detector = new ChordDetector({
      analysisProvider: mockAnalysisProvider,
      lyricsProvider:   mockLyricsProvider,
      cache:            mockCache
    });
  });

  describe('detectChord()', () => {
    test('returns chord with highest cosine similarity', () => { ... });
    test('returns confidence 0 for zero chroma vector', () => { ... });
    test('applies MIN_CONFIDENCE threshold', () => { ... });
    test('smoothing window reduces chord flickering', () => { ... });
  });

  describe('detectKey()', () => {
    test('returns C major for C major chroma profile', () => { ... });
    test('returns Am for A minor chroma profile', () => { ... });
    test('confidence decreases for ambiguous chroma', () => { ... });
  });
});
```

**Integration tests — `tests/integration/`**

Testean flujos completos entre módulos. Mockean solo las fronteras externas (APIs).

```javascript
// tests/integration/analysis-pipeline.test.js
import { ChordDetector } from '../../src/core/chord-detector.js';
import { SmartCache }    from '../../src/cache/smart-cache.js';
import { Transposer }    from '../../src/core/transposer.js';
import { MOCK_ANALYSIS_RESPONSE } from '../fixtures/spotify-analysis.js';

test('full pipeline: analysis → chords → transpose → notation', async () => {
  const cache    = new SmartCache({ name: 'test', ttl: 60000, capacity: 10 });
  const provider = { get: jest.fn(() => MOCK_ANALYSIS_RESPONSE) };
  const detector = new ChordDetector({ analysisProvider: provider, cache });

  const result = await detector.processAnalysis('track123');

  expect(result.key).toBe('C');
  expect(result.chords[0].chord).toBe('C');
  expect(result.chords[0].confidence).toBeGreaterThan(0.5);

  // Transpose
  const transposed = result.chords.map(c => ({
    ...c, chord: Transposer.transpose(c.chord, 5)
  }));
  expect(transposed[0].chord).toBe('F');
});
```

**E2E tests — `tests/e2e/`**

Simulan el entorno completo de Spicetify con un mock extenso:

```javascript
// tests/e2e/setup/spicetify-mock.js

global.Spicetify = {
  Player: {
    data: null,
    _listeners: {},
    addEventListener(event, fn) { this._listeners[event] = fn; },
    removeEventListener(event) { delete this._listeners[event]; },
    emit(event, data) { this._listeners[event]?.(data); },
    back: jest.fn(),
    next: jest.fn(),
    togglePlay: jest.fn(),
  },
  Platform: {
    getPlayerAPI() { return { getState: jest.fn() }; },
    AccessToken: { _token: 'mock-token' }
  },
  CosmosAsync: { get: jest.fn() },
  PopupModal: {
    display: jest.fn(),
    hide: jest.fn(),
  },
  showNotification: jest.fn(),
  Menu: { Item: jest.fn(), SubMenu: jest.fn() },
};

global.localStorage = new (class {
  constructor() { this._store = {}; }
  getItem(k) { return this._store[k] ?? null; }
  setItem(k, v) { this._store[k] = v; }
  removeItem(k) { delete this._store[k]; }
  clear() { this._store = {}; }
})();
```

```javascript
// tests/e2e/chord-display.e2e.js
import './setup/spicetify-mock.js';
// Importar el bundle completo (build/chorduction.js) para testear la integración real
// O importar src/platforms/spicetify/index.js

test('clicking guitar button opens modal', async () => {
  await initializeChorduction();  // Simula Spicetify ready

  // Simular inyección del botón
  const btn = document.querySelector('[data-chorduction-trigger]');
  btn.click();

  expect(Spicetify.PopupModal.display).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Chorduction' })
  );
});

test('song change triggers analysis', async () => {
  Spicetify.CosmosAsync.get.mockResolvedValue(MOCK_ANALYSIS);

  Spicetify.Player.emit('songchange', { item: MOCK_TRACK });

  await waitFor(() => {
    expect(Spicetify.CosmosAsync.get).toHaveBeenCalledWith(
      expect.stringContaining('/audio-analysis/')
    );
  });
});
```

### 11.3 Fixtures

```javascript
// tests/fixtures/spotify-analysis.js
export const MOCK_ANALYSIS_RESPONSE = {
  track: { duration: 240.5, tempo: 120.3, time_signature: 4, key: 0, mode: 1 },
  segments: [
    { start: 0.0, duration: 0.5, pitches: [1,0,0,0,1,0,0,1,0,0,0,0], loudness_max: -5 },
    { start: 0.5, duration: 0.5, pitches: [0,0,0,0,0,0,0,1,0,0,0,1], loudness_max: -6 },
    // ... más segmentos
  ],
  beats: [
    { start: 0.0, duration: 0.5 },
    { start: 0.5, duration: 0.5 },
  ],
  bars: [{ start: 0.0, duration: 2.0 }]
};

export const MOCK_TRACK = {
  uri: 'spotify:track:abc123',
  name: 'Test Song',
  artists: [{ name: 'Test Artist' }],
  duration_ms: 240500
};
```

### 11.4 Metas de cobertura

| Capa | Meta v7 |
|------|---------|
| src/core/ | 95% |
| src/ml/ | 85% |
| src/cache/ | 95% |
| src/export/ | 90% |
| src/providers/ | 80% |
| src/platforms/ | 70% (E2E) |
| src/ui/ | 60% (visual, difícil sin browser real) |
| **Total** | **>80%** |

### 11.5 Total de tests objetivo

| Suite | Tests actuales | Tests v7 objetivo |
|-------|---------------|------------------|
| Unit | 24 | 80 |
| Integration | 40 | 50 |
| E2E | 0 | 25 |
| ML-specific | 0 | 15 |
| **Total** | **64** | **~170** |

---

## 12. Módulo 9 — CI/CD v7

### 12.1 Nuevos workflows

**`.github/workflows/ci.yml` — Pipeline principal**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: matrix.node-version == '20.x'

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  build:
    runs-on: ubuntu-latest
    needs: [test, typecheck, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: chorduction-build
          path: build/chorduction.js

  bundle-size:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/download-artifact@v4
        with: { name: chorduction-build }
      - name: Check bundle size
        run: |
          SIZE=$(wc -c < build/chorduction.js)
          MAX=200000  # 200 KB límite
          if [ $SIZE -gt $MAX ]; then
            echo "Bundle too large: ${SIZE}B > ${MAX}B"
            exit 1
          fi
          echo "Bundle size: ${SIZE}B (OK)"
```

**`.github/workflows/release.yml` — Release automático**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run build

      - name: Generate changelog for release
        id: changelog
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          NOTES=$(awk "/## \[$VERSION\]/,/## \[/" CHANGELOG.md | head -n -2)
          echo "NOTES<<EOF" >> $GITHUB_OUTPUT
          echo "$NOTES" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - uses: softprops/action-gh-release@v2
        with:
          name: Chorduction ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.NOTES }}
          files: |
            build/chorduction.js
            build/chorduction.js.map
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**`.github/workflows/model-update.yml` — Actualización del modelo ML**

```yaml
name: Model Update

on:
  schedule:
    - cron: '0 3 * * 0'   # Domingo 3am UTC
  workflow_dispatch:        # También manual

jobs:
  retrain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }

      - run: pip install tensorflow tensorflowjs librosa

      - name: Download training data
        run: python scripts/download_dataset.py

      - name: Train model
        run: python scripts/train_model.py

      - name: Evaluate model
        id: eval
        run: |
          ACCURACY=$(python scripts/evaluate_model.py)
          echo "ACCURACY=$ACCURACY" >> $GITHUB_OUTPUT

      - name: Fail if accuracy below threshold
        run: |
          if (( $(echo "${{ steps.eval.outputs.ACCURACY }} < 0.82" | bc -l) )); then
            echo "Model accuracy too low: ${{ steps.eval.outputs.ACCURACY }}"
            exit 1
          fi

      - name: Upload model to CDN
        if: success()
        run: |
          aws s3 cp model/tfjs_model/ s3://chorduction-models/v7/ --recursive
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## 13. Módulo 10 — Rendimiento y Memoria

### 13.1 Problema: TF.js aumenta el footprint

En v6 la extensión usa ~5 MB. Con TF.js cargado el modelo (~1.7 MB gzipped), el footprint sube a ~12–15 MB. Esto es aceptable para una extensión de Spotify, pero requiere:

1. **Carga lazy del modelo:** El modelo solo se descarga cuando el usuario activa Chorduction por primera vez, no al arrancar Spotify.
2. **Descarga del modelo si no se usa:** Si el usuario no abre Chorduction en 7 días, purgar el modelo de IndexedDB para liberar espacio.
3. **WebGL backend:** TF.js WebGL hace la inferencia en GPU, sin impacto en el hilo principal de Spotify.

### 13.2 Lazy loading de módulos

esbuild puede hacer code splitting (aunque limitado en modo IIFE). Estrategia alternativa:

```javascript
// src/ml/ml-detector.js

let _tf = null;

async function ensureTF() {
  if (_tf) return _tf;
  // Carga dinámica — solo cuando el usuario pide análisis con ML
  _tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.x/dist/tf.min.js');
  await _tf.setBackend('webgl');
  return _tf;
}

export class MLDetector {
  async predict(chromaMatrix) {
    const tf = await ensureTF();
    // ...
  }
}
```

**Importante:** La URL de TF.js debe estar en la lista de permisos de Spicetify (`allowedExtensionUrls`). Verificar compatibilidad.

Alternativa si dynamic import no es posible en Spicetify: bundlear TF.js core (~400KB gzipped) dentro del bundle principal pero inicializarlo solo bajo demanda.

### 13.3 Optimización de la matriz de similitud

La sección detection construye una matriz N×N donde N = número de segmentos. Para una canción de 4 minutos con segmentos de 0.5s, N ≈ 480. La matriz ocupa 480² × 4 bytes = ~900 KB.

Optimizaciones:
1. Usar `Float32Array` en lugar de arrays nativos (mitad de memoria)
2. Solo calcular el triángulo superior (la matriz es simétrica) → mitad de operaciones
3. Usar submuestreo: calcular similitud cada 2 segmentos para canciones > 5 min

```javascript
// Matriz compacta: solo triángulo superior como array 1D
function buildCompactSimilarityMatrix(segments) {
  const n = segments.length;
  const size = (n * (n + 1)) / 2;
  const flat = new Float32Array(size);

  let idx = 0;
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++)
      flat[idx++] = cosineSimilarity(segments[i].pitches, segments[j].pitches);

  // Accessor: getS(i, j) donde i <= j
  return {
    get(i, j) {
      if (i > j) [i, j] = [j, i];
      return flat[i * n - (i * (i - 1)) / 2 + (j - i)];
    }
  };
}
```

### 13.4 Benchmark targets v7

| Métrica | v6 baseline | v7 objetivo |
|---------|------------|-------------|
| Tiempo de análisis (sin ML) | ~2-3s | < 2s |
| Tiempo de análisis (con ML) | N/A | < 3.5s |
| Inferencia ML (por beat) | N/A | < 5ms |
| Tiempo de carga inicial | ~200ms | < 300ms (con ML lazy) |
| Memoria (sin ML) | ~5 MB | < 6 MB |
| Memoria (con ML cargado) | N/A | < 15 MB |
| Tamaño del bundle | 75.6 KB | < 200 KB (sin TF.js) |
| Precisión de acordes | ~70% | > 82% (con ML blend) |

---

## 14. Plan de Migración desde v6

### 14.1 Compatibilidad con settings v6

```javascript
// src/utils/settings.js

const V6_KEY = 'chorduction-settings-v6';
const V7_KEY = 'chorduction-settings-v7';

function migrateFromV6() {
  const v6 = localStorage.getItem(V6_KEY);
  if (!v6) return null;

  const parsed = JSON.parse(v6);

  // Mapeo de campos v6 → v7
  return {
    chordNotation:     parsed.CHORD_NOTATION   ?? 'standard',
    smoothingBeats:    parsed.SMOOTHING_BEATS  ?? 3,
    minConfidence:     parsed.MIN_CONFIDENCE   ?? 0.1,
    transposeSemitones: parsed.TRANSPOSE_SEMITONES ?? 0,
    showLyrics:        parsed.SHOW_LYRICS      ?? true,
    showFretboard:     parsed.SHOW_FRETBOARD_DIAGRAMS ?? true,
    autoAnalyze:       parsed.AUTO_REFRESH_ON_SONG_CHANGE ?? true,
    debugLevel:        parsed.DEBUG_LEVEL      ?? 'INFO',
    language:          parsed.LANGUAGE         ?? 'en',
    instrument:        'guitar',   // nuevo en v7, default
    showSections:      true,       // nuevo en v7, default
    useMLDetection:    true,       // nuevo en v7, default
  };
}

export function loadSettings() {
  const v7 = localStorage.getItem(V7_KEY);
  if (v7) return { ...DEFAULT_CONFIG_V7, ...JSON.parse(v7) };

  const migrated = migrateFromV6();
  if (migrated) {
    saveSettings(migrated);
    return { ...DEFAULT_CONFIG_V7, ...migrated };
  }

  return { ...DEFAULT_CONFIG_V7 };
}
```

### 14.2 Compatibilidad con export JSON

El formato JSON v2 agrega `sections[]` pero mantiene todos los campos existentes. Herramientas que consumen JSON v1 seguirán funcionando (los campos nuevos son opcionales desde su perspectiva).

```json
{
  "meta": {
    "version": "2.0",          ← Bumped
    "chorductionVersion": "7.0.0",
    "title": "...",
    "artist": "...",
    "key": "C",
    "tempo": 120
  },
  "chords": [ ... ],           ← Igual que v1
  "sections": [ ... ],         ← NUEVO — opcional para consumidores v1
  "lyrics": [ ... ]            ← NUEVO — antes no estaba en el export
}
```

### 14.3 Proceso de release

1. Publicar v7.0.0 como **pre-release** en GitHub
2. Período de beta: 2 semanas con usuarios voluntarios
3. Reportes de bugs y regresiones vía GitHub Issues
4. Fix en v7.0.1, v7.0.2 si necesario
5. Marcar como release estable cuando:
   - Cero regresiones críticas reportadas
   - Tests E2E pasan en 3 versiones de Spotify verificadas
   - ML accuracy > 82% confirmado en campo

---

## 15. Cronograma Detallado

### Fase 0 — Preparación (Semanas 1–2)

| Tarea | Responsable | Estimación |
|-------|-------------|-----------|
| Configurar esbuild, tsconfig, eslint | Dev | 1 día |
| Crear estructura de directorios `src/` | Dev | 0.5 días |
| Agregar `@chorduction/core` como workspace package | Dev | 0.5 días |
| Migrar `chorduction.test.js` a importar módulos reales | Dev | 2 días |
| Verificar que 64 tests siguen pasando | Dev | 1 día |
| Actualizar CI para incluir typecheck + lint + build | Dev | 1 día |

**Hito:** CI verde con estructura v7, código aún en chorduction.js (en src/ como un solo archivo)

### Fase 1 — Extracción de módulos (Semanas 3–5)

| Tarea | Estimación |
|-------|-----------|
| Extraer `src/core/chord-templates.js` | 0.5 días |
| Extraer `src/core/transposer.js` + tests | 1 día |
| Extraer `src/core/chord-notation.js` + tests | 1 día |
| Extraer `src/cache/smart-cache.js` + tests | 1 día |
| Extraer `src/core/chord-detector.js` + tests | 2 días |
| Extraer `src/core/key-detector.js` + tests | 1 día |
| Extraer `src/providers/` + tests | 2 días |
| Extraer `src/export/` + tests | 1.5 días |
| Extraer `src/ui/` (sin cambios de lógica) | 2 días |
| Crear `src/platforms/spicetify/` | 2 días |
| Crear `src/index.js` y wiring | 1 día |
| Bundle con esbuild → verificar igual a v6 | 1 día |

**Hito:** `build/chorduction.js` generado desde `src/`, funcionalmente idéntico a v6.0, 64+ tests pasando.

### Fase 2 — TypeScript + Tipos (Semanas 6–7)

| Tarea | Estimación |
|-------|-----------|
| Crear `src/types.js` con todos los @typedef | 2 días |
| Agregar JSDoc a todos los módulos core | 3 días |
| Fix errores de typecheck (`tsc --noEmit`) | 2 días |
| Agregar typecheck al CI | 0.5 días |

**Hito:** `npm run typecheck` pasa sin errores.

### Fase 3 — Section Detection (Semanas 8–9)

| Tarea | Estimación |
|-------|-----------|
| Implementar `src/core/section-detector.js` | 4 días |
| Tests unitarios para section-detector | 2 días |
| Integrar en `ChordDetector.processAnalysis()` | 1 día |
| Implementar `src/ui/section-display.js` | 2 días |
| Actualizar exporters (TXT, JSON, ChordPro) | 2 días |
| Tests de integración section pipeline | 1.5 días |

**Hito:** La UI muestra Intro/Verse/Chorus/Bridge en canciones de prueba.

### Fase 4 — ML Detection (Semanas 10–14)

| Tarea | Estimación |
|-------|-----------|
| Preparar dataset de entrenamiento (CASD, Beatles) | 4 días |
| Entrenar modelo baseline en Colab/local | 3 días |
| Iterar arquitectura hasta accuracy > 82% | 5 días |
| Convertir a TF.js (tensorflowjs converter) | 1 día |
| Implementar `src/ml/model-loader.js` | 2 días |
| Implementar `src/ml/feature-extractor.js` | 2 días |
| Implementar `src/ml/blend-strategy.js` | 1 día |
| Implementar `src/ml/correction-collector.js` | 1 día |
| Tests de ML (unit + integration) | 3 días |
| CDN setup para el modelo | 1 día |
| Configurar `model-update.yml` en CI | 1 día |

**Hito:** En tests A/B internos, accuracy ML > accuracy chroma en 5+ canciones de referencia.

### Fase 5 — Instrument Expansion (Semanas 15–16)

| Tarea | Estimación |
|-------|-----------|
| Refactorizar `GuitarFretboard` como clase | 1 día |
| Implementar `UkuleleFretboard` (60 fingerings) | 2 días |
| Implementar `PianoKeys` (SVG octava) | 1.5 días |
| Implementar `BassFretboard` (root positions) | 1 día |
| Selector de instrumento en Settings | 1 día |
| Tests visuales (snapshot tests de SVG) | 1.5 días |

**Hito:** Los 4 instrumentos renderizan correctamente todos los 60 acordes.

### Fase 6 — YouTube Extension (Semanas 17–20)

| Tarea | Estimación |
|-------|-----------|
| Publicar `@chorduction/core` en npm (privado o público) | 1 día |
| Setup del proyecto `youtube-extension/` | 1 día |
| Implementar `audio-capturer.js` (Web Audio API) | 4 días |
| Implementar `caption-provider.js` | 2 días |
| Implementar `ui-overlay.js` | 3 días |
| Implementar `page-observer.js` (SPA navigation) | 2 días |
| Implementar `popup/` (mini settings) | 1.5 días |
| Publicar en Chrome Web Store (review) | variable |
| Publicar en Firefox Add-ons (review) | variable |

**Hito:** La extensión YouTube detecta acordes en 10 canciones de prueba con accuracy > 70%.

### Fase 7 — UI/UX + Polish (Semana 21)

| Tarea | Estimación |
|-------|-----------|
| Implementar componentes UI ligeros | 2 días |
| Transiciones de carga | 1 día |
| SVG responsivo | 0.5 días |
| Accesibilidad (aria-labels, focus management) | 1 día |
| Fix CORS + DOM selectors (deuda v6.1) | 1 día |

### Fase 8 — Testing exhaustivo + Release (Semanas 22–23)

| Tarea | Estimación |
|-------|-----------|
| Completar suite E2E | 3 días |
| Tests en 3 versiones de Spotify | 2 días |
| Performance benchmarks vs v6 | 1 día |
| Beta release (pre-release GitHub) | 0.5 días |
| Período de beta + fixes | 1 semana |
| Release v7.0.0 estable | 0.5 días |
| Actualizar documentación | 1 día |

---

## 16. Criterios de Aceptación

Un feature se considera completo cuando:

### Build System
- [ ] `npm run build` produce `build/chorduction.js` en < 2s
- [ ] El bundle es funcionalmente idéntico a `chorduction.js` v6 (todos los tests pasan)
- [ ] Bundle size < 200 KB (sin TF.js)
- [ ] CI verde: test + typecheck + lint + build en < 3 min

### TypeScript
- [ ] `npx tsc --noEmit` pasa sin errores ni warnings
- [ ] Todos los objetos cross-módulo tienen @typedef
- [ ] IntelliSense muestra tipos en VSCode para todos los módulos core

### Section Detection
- [ ] Detecta correctamente Intro/Verse/Chorus en 8/10 canciones pop de referencia
- [ ] Detecta Bridge cuando existe en 6/10 canciones de referencia
- [ ] Tiempo de section detection < 200ms adicionales al análisis normal
- [ ] Export JSON v2 incluye `sections[]` con tipos y timestamps correctos

### ML Detection
- [ ] Accuracy > 82% en el test set de referencia (CASD + Beatles)
- [ ] Accuracy >= accuracy chroma en 8/10 canciones de validación manual
- [ ] Tiempo de inferencia por beat < 5ms en WebGL backend
- [ ] El modelo carga en < 2s desde IndexedDB (segunda vez)
- [ ] El modelo carga en < 8s desde CDN (primera vez)
- [ ] Fallback silencioso a chroma si TF.js falla en cargar

### YouTube Extension
- [ ] Detecta acordes en 10 canciones de prueba (accuracy visual > 65%)
- [ ] Sincroniza con el playback de YouTube con desfase < 200ms
- [ ] Funciona en Chrome 120+ y Firefox 120+
- [ ] No introduce latencia perceptible en el playback de YouTube

### Instrumentos
- [ ] Los 4 instrumentos renderizan los 60 acordes fundamentales
- [ ] El diagrama se actualiza en < 50ms al cambiar de acorde
- [ ] SVG responsive: se ve correctamente con zoom 100%, 150%, 200%

### Tests
- [ ] > 170 tests en total
- [ ] Cobertura > 80% en src/core/ y src/cache/
- [ ] Todos los tests importan el código real (ninguno reimplementa clases)
- [ ] Tests E2E pasan en Node 18, 20, 22

---

## 17. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| TF.js no carga en el contexto de Spicetify por CSP | Media | Alto | Bundlear TF.js core en el bundle; usar worker si es necesario |
| Spotify cambia la estructura de `segments[]` en Audio Analysis | Baja | Alto | Agregar validación de esquema + tests de regresión con fixtures |
| Model accuracy < 82% con el dataset disponible | Media | Medio | Reducir objetivo a 78% para v7, iterar en v7.1 |
| YouTube cambia la estructura de `ytInitialPlayerResponse` | Alta | Medio | Parser defensivo + fallback a null lyrics; monitoreo automatizado |
| esbuild produce bundle incompatible con Spicetify | Baja | Alto | Testear bundle en Spotify Desktop en Fase 1 antes de continuar |
| Section detection demasiado lenta para canciones > 8 min | Media | Medio | Limitar a primeros 5 minutos + usar submuestreo |
| Chrome Web Store review demora > 4 semanas | Media | Bajo | Publicar como side-load para beta testers mientras espera review |
| Usuarios de Spotify en Linux tienen versiones viejas de Spicetify | Media | Bajo | Mantener `build/chorduction-v6-compat.js` como alternativa |

---

## Apéndice A — Dependencias nuevas en v7

| Paquete | Versión | Uso | Bundleado |
|---------|---------|-----|-----------|
| `esbuild` | ^0.20 | Build tool | No (devDep) |
| `@tensorflow/tfjs` | ^4.x | ML inference | Sí (lazy) |
| `typescript` | ^5.x | Type checking | No (devDep) |
| `eslint` | ^8.x | Linting | No (devDep) |
| `jest` | ^29.x | Testing | No (devDep, ya existe) |

**Runtime dependencies en el bundle final:** Cero (excepto TF.js que se carga bajo demanda)

---

## Apéndice B — Ejemplo de output completo v7

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎸 Chorduction  •  Let It Be — The Beatles
Key: C Major  •  76 BPM  •  4/4
Chord: F  (transpose: 0)  [Piano]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[INTRO]                              0:00–0:07
  C    G    Am   F

[VERSE 1]                            0:07–0:49
  C    G    Am   F   C    G    F    C
  C    G    Am   F   C    G    F    C

▶ [CHORUS]                           0:49–1:10  ← actual
  F    C    G    Am
  F    C    G    G    ← beat actual: F

  When I find myself in times of trouble
  Mother Mary comes to me

[VERSE 2]                            1:10–1:52
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────┐
│     F PIANO (C4-B4)         │
│ C D E F G A B               │
│ ┌┬┬─┬┬┐ ┌┬┬─┬┬─┬┬┐          │
│ ││├─┤││ │├─┤│ │├─┤         │
│ │┘ └┘│┘ │┘ └┘ └┘ │         │
│ C D E F G A B               │
│   ▲   ▲ ▲               │
│   F   A C                   │
└─────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Save ▼]  [Transpose: 0]  [Settings]
```

---

*Plan v7 generado 2026-03-20. Actualizar a medida que avanza la implementación.*
