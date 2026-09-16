# Smart Locator Capture Studio

An Electron desktop app for automation testers: Ctrl+Click an element inside an embedded
browser and it generates ranked, live-validated locator strategies (XPath and CSS) for that
element — then hands you runnable code for the framework of your choice.

## Features

- **Ctrl+Click capture** — browse any page inside the app's embedded `<webview>`, toggle
  Capture Mode, and Ctrl+Click an element to snapshot it (tag, attributes, DOM context, nearby
  label, ancestor chain, and more).
- **Ranked, validated locators** — for every captured element, the engine generates a set of
  XPath and CSS candidates (id, name, class, attribute, text, combination, axis-based, absolute,
  indexed fallback, `starts-with()` for framework-generated ids/classes) and validates each one
  live against the real DOM. Uniqueness is judged on the raw DOM match count, never visibility, so
  a locator that matches several elements is never recommended just because only one is currently
  rendered.
- **Weighted scoring & classification** — each validated candidate is scored 0–100 (uniqueness,
  attribute stability, DOM dependency, readability, length, dynamic-value risk) and classified as
  Primary / Secondary / Fallback.
- **Smart XPath generation** — when the obvious attributes aren't enough (duplicated widgets,
  state-only differences like a hidden vs. visible tab panel), the engine falls back to
  label/landmark/sibling/state-anchor axes, and only as a last resort to `(expr)[N]` indexed
  disambiguation.
- **Same-origin iframe support** — captures and validates elements inside same-origin iframes,
  resolving live-validation queries against the iframe's own document.
- **Custom Locator Builder** — manually combine attributes into a predicate with live match-count
  feedback, with an explicit "wrap with position" last resort when nothing else is unique.
- **Code generation** — turn any captured element into a ready-to-paste locator statement for
  Selenium (Java/Python/C#), Playwright (TypeScript/JavaScript/Python/Java), Cypress, or Robot
  Framework — preferring semantic locators (`getByRole`, `getByTestId`, `getByPlaceholder`) where
  the framework supports them.
- **Sessions** — captures are grouped into named sessions, autosaved to disk as you work (no
  manual save required), switchable from a single header dropdown.
- **Export** — JSON (a complete, lossless record), TXT (the same detail as JSON, formatted for
  reading), or CSV (the doc's suggested column set), scoped to all captured elements or only the
  ones you've checked.

## Tech stack

- Electron + React 19 + TypeScript + Vite + Tailwind v4
- An embedded `<webview>` with its own guest-page preload (`electron/webview-preload.cjs`) drives
  capture and live validation; a separate host-window preload (`electron/preload.cjs`) exposes the
  session/export/file-dialog APIs to the renderer.
- Vitest for unit tests, Playwright (`_electron`) for end-to-end tests against the real app.

## Getting started

```bash
npm install
npm run electron:dev   # Vite dev server + Electron, with hot reload
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server only (renderer, no Electron shell) |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run electron` | Build, then launch the packaged renderer in Electron |
| `npm run electron:build` | Build an installable package via electron-builder (`release/`) |
| `npm run lint` | Type-check only (`tsc --noEmit`) |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run test:e2e` | Run the end-to-end suite (Playwright, drives the real Electron app) |

## Project structure

```x
electron/            Main process (electron/main.cjs) and the two preload scripts
src/
  components/         React UI (capture panel, locator details, DOM inspector, dialogs)
  engine/             Locator generation, scoring, classification, and code generation
    xpath/            One generator module per XPath strategy (id, class, attribute, text,
                       axis-based, absolute, starts-with prefix, ...)
    codegen/           One module per output framework (Selenium/Playwright/Cypress/Robot)
  session/            Capture pipeline, live DOM validation, session persistence
  export/             JSON/TXT/CSV export
  hooks/              React state (capture session, webview capture wiring)
tests/
  engine/, session/   Unit tests (Vitest)
  e2e/                End-to-end tests (Playwright, launches the real app)
  fixtures/           Static HTML pages the e2e tests capture elements from
```

## How locators are generated and scored

1. **Generate** (`src/engine/generate.ts`) runs every XPath/CSS strategy against a captured
   element's snapshot and de-duplicates the results.
2. **Validate** (`src/session/liveValidate.ts`, `src/engine/validator.ts`) runs each candidate
   against the live page (or the correct iframe document) via `webview.executeJavaScript()`,
   recording the real DOM match count.
3. **Score & classify** (`src/engine/scorer.ts`) weights uniqueness, attribute stability, DOM
   dependency, readability, length, and dynamic-value risk into a 0–100 total, then assigns
   Primary/Secondary/Fallback — a non-unique locator is never eligible for Primary/Secondary while
   any validated-unique candidate exists, regardless of its raw score.

## Sessions

A session (name, starting URL, and its captured elements) is autosaved to disk as JSON under the
app's user-data directory (`sessions/<id>.json`), debounced ~300ms after each change — creating a
session, capturing an element, or switching sessions all persist automatically; no manual save is
required, though Ctrl+S / the header Save button still work for an explicit save.

## Testing

```bash
npm run lint      # tsc --noEmit
npm test          # Vitest unit tests
npm run build     # production build
npm run test:e2e  # Playwright e2e tests (launches the real Electron app)
```

The e2e suite drives the actual packaged app against static fixtures in `tests/fixtures/` —
capturing elements, validating uniqueness, switching sessions, exporting, and generating code —
rather than mocking the Electron/webview layer.

## Packaging

```bash
npm run electron:build
```

Produces two Windows artifacts in `release/` via electron-builder: a standalone NSIS installer
(`Smart Locator Capture Studio-Setup-<version>.exe` — full install wizard, choose install
directory, Start Menu/Desktop shortcuts, uninstaller) and a portable build
(`Smart Locator Capture Studio-Portable-<version>.exe` — a single file that runs with no
installation at all).

**If this fails with `EPERM: operation not permitted, rename '...\win-unpacked.tmp' -> '...\win-unpacked'`**:
something (commonly OneDrive's folder backup, or endpoint security real-time scanning) is
holding a lock on freshly-extracted files inside a project that lives under a watched folder like
`Documents`. Two ways around it, neither requiring any security/OneDrive setting changes:

- Point the build output somewhere unwatched for one run:
  `npx electron-builder --config.directories.output="%LOCALAPPDATA%\slcs-release"`
- Ask IT for an exclusion on the project folder and `%LOCALAPPDATA%\electron-builder` if you hit
  this repeatedly on a managed machine.
