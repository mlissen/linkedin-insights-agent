# Repository Guidelines

## Project Structure & Module Organization
The core TypeScript sources live in `src/`, with orchestrators (`multi-expert-orchestrator.ts`), scraping utilities (`scraper.ts`), analysis (`analyzer.ts`), and CLI helpers (`cli-parser.ts`). Output state is written to `data/USERNAME/` after runs, while reusable run presets live in `configs/`. Compiled assets land in `dist/` after `npm run build`. Keep large scraped artifacts out of version control; `.cache/` is recreated on demand for Puppeteer and analyzer caching.

## Build, Test, and Development Commands
- `npm install`: install dependencies; rerun after updating `package.json`.
- `npm start -- --config ./configs/example.json`: launch the multi-expert pipeline using a JSON preset.
- `npm run dev`: watch mode for iterating on `src/main.ts`; restarts on change.
- `npm run build`: compile TypeScript to `dist/`; fails if type errors exist.
- `npx tsx src/test-ai.ts`: smoke-test AI analysis with canned data.
- `npx tsx src/test-search.ts`: verify LinkedIn search scraping without the full pipeline.

## Coding Style & Naming Conventions
We ship strict-mode TypeScript targeting ES2020. Follow existing patterns: PascalCase for classes (`InsightAnalyzer`), camelCase for functions and variables, and snake-case folder names only for output directories. Use 2-space indentation and prefer async/await over promise chains. Keep side-effect imports (e.g., `env.ts`) at the top and maintain ESM `import … from` syntax.

## Testing Guidelines
No automated test suite is wired yet; rely on targeted scripts above and `npm run build` as a type-safety gate. When adding tests, place them beside the module under test (`src/foo.test.ts`) and name scenarios verbosely. Mock remote services, and document required environment variables in test headers. Ensure data fixtures do not include real LinkedIn content.

## Commit & Pull Request Guidelines
Commits use short, imperative summaries (e.g., “Add multi-expert aggregation”). Scope your changes narrowly and describe configuration impacts in the body when necessary. Pull requests should include: purpose overview, notable commands to rerun, screenshots or sample output paths (`data/<run>/`) when UI/formatting changes occur, and references to related configs. Confirm `.env` secrets stay local before opening a PR.

## Security & Configuration Tips
Anthropic and LinkedIn credentials belong in `.env`; never commit them. Prefer referencing configs in `config.json` or `configs/*.json` instead of hardcoding secrets. Review Puppeteer settings before sharing branches to avoid enabling headless login flows unintentionally.
