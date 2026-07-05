# Repository Guidelines

## Project Structure & Module Organization

This is a React + TypeScript + Vite single-page Texas Hold'em game. Application UI starts in `src/main.tsx` and `src/App.tsx`. Core game logic lives in `src/lib/`: `game.ts` manages state transitions, `cards.ts` models decks and cards, `handEvaluator.ts` ranks hands, `winner.ts` resolves winners, and `cpu.ts` contains rule-based CPU decisions. Tests are colocated under `src/test/` and mirror the main logic modules. Global styles are in `src/styles.css`. Build and tooling configuration is in `vite.config.ts` and the `tsconfig*.json` files.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server.
- `npm run build`: run TypeScript project checks with `tsc -b`, then create a production Vite build.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode while developing.

The Vite `base` is `/texas-holdem/` for GitHub Pages deployment. Change it only when the deployment path changes.

## Coding Style & Naming Conventions

Use TypeScript modules with explicit exported types for shared game state and actions. Follow the existing style: two-space indentation, double quotes, semicolons, `camelCase` for functions and variables, `PascalCase` for React components and TypeScript interfaces/types where appropriate. Keep pure game rules in `src/lib/`; avoid mixing UI state rendering with hand evaluation, winner selection, or CPU decision logic.

## Testing Guidelines

Vitest is the test framework. Add tests in `src/test/*.test.ts`, grouped with `describe` and behavior-focused `it` cases. For bug fixes, include a regression test when practical, especially for betting flow, hand evaluation, winner resolution, and CPU actions. Run `npm test` before submitting changes; run `npm run build` when TypeScript types or production behavior may be affected.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit style such as `fix(cpu): limit raise loops` and `ci: add GitHub Pages deployment workflow`. Prefer `type(scope): summary` when a scope is useful. Pull requests should include a short description, test results, linked issues if any, and screenshots or screen recordings for visible UI changes.

## Security & Configuration Tips

Do not commit secrets or deployment credentials. Keep dependencies minimal and confirm before adding new packages. Treat user input, file I/O, and future external APIs as boundary points that require validation and explicit error handling.
