# Contributing to Chorduction

Thank you for your interest in contributing. This guide explains how to get set up, what we value in contributions, and how the review process works.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Writing Tests](#writing-tests)
- [Commit Style](#commit-style)
- [Pull Request Process](#pull-request-process)
- [Areas That Need Help](#areas-that-need-help)

---

## Code of Conduct

Be respectful, constructive, and patient. Contributions from musicians, developers, and music theory enthusiasts of all experience levels are welcome.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm
- Spicetify + Spotify Desktop (for manual integration testing)

### Setup

```bash
git clone https://github.com/user/chorduction.git
cd chorduction
npm install
```

### Run the test suite

```bash
npm test
```

All 64 tests must pass before submitting a PR.

---

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature
   # or
   git checkout -b fix/issue-description
   ```

2. **Make changes** to `chorduction.js`. The extension is a single file — keep module boundaries clear using the existing comment separators.

3. **Add or update tests** in `tests/` for any new behavior. Integration tests go in `tests/integration/`.

4. **Run tests** locally before committing:
   ```bash
   npm test
   npm run test:coverage
   ```

5. **Test in Spotify** if your change touches UI or Spicetify integration:
   ```bash
   cp chorduction.js ~/.spicetify/Extensions/
   spicetify apply
   ```

---

## Writing Tests

- Unit tests belong in `tests/chorduction.test.js`
- Integration tests belong in `tests/integration/` — name the file after the flow being tested
- Mock Spicetify globals at the top of test files using the existing pattern in `chorduction.test.js`
- Aim for behavior coverage, not line coverage — test what the module should do, not how

### Test naming convention
```javascript
describe('ModuleName', () => {
  it('should [expected behavior] when [condition]', () => { ... });
});
```

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add ukulele fretboard diagrams
fix: correct DOM selector fallback order for Spotify 1.2.x
docs: update export format examples in README
test: add degradation tests for lyrics provider timeout
refactor: extract chord template definitions to constant
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`

---

## Pull Request Process

1. Open a PR against `main`
2. Fill in the PR template (description, testing steps, screenshots if UI changes)
3. All CI checks must pass (tests on Node 18, 20, 21)
4. One maintainer review required
5. Squash merge preferred for feature branches; merge commit for significant additions

### PR title format
```
feat: [short description]
fix: [short description]
```

---

## Areas That Need Help

These are open contribution opportunities aligned with the roadmap:

### High Priority
- **DOM selector improvements** — Spotify changes its UI frequently; help us build more resilient selectors and a proper observer-based injection strategy
- **Chord accuracy** — improvements to the chroma analysis algorithm or integration of `@tensorflow/tfjs` for ML-based detection
- **CORS handling** — explore service worker or background script strategies for web player compatibility

### Medium Priority
- **Section detection** — verse/chorus/bridge labeling using energy and chroma similarity patterns
- **Additional fretboard diagrams** — 7th, 9th, suspended chords
- **Ukulele and piano displays** — instrument-specific chord diagrams

### Low Priority
- **TypeScript migration** — incremental JSDoc annotations or `.d.ts` type definitions are also welcome
- **Offline mode** — IndexedDB caching of audio analysis data
- **i18n** — additional language support beyond English and Spanish

---

## Questions

Open a [GitHub Discussion](https://github.com/user/chorduction/discussions) for questions, ideas, or design proposals before investing significant effort in a large change.
