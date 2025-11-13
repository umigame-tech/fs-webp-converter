# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the React Router v7 application: routes in `app/routes`, shared UI in `app/welcome`, and global styles in `app/app.css`.
- `public/` contains static assets (e.g., `/ogp.webp`) served verbatim.
- `workers/` + `wrangler.jsonc` define the Cloudflare Worker entry points used during build/deploy.
- `vite.config.ts`, `react-router.config.ts`, and the `tsconfig*.json` files govern bundling and type-check boundaries. Keep all new code in `app/` unless it truly belongs to Workers or static assets.

## Build, Test, and Development Commands
- `npm run dev` – launches the React Router dev server with live reload; use for day-to-day UI work.
- `npm run build` – produces the production bundle and Worker artifacts; run before deployment changes.
- `npm run preview` – serves the build output locally for smoke testing.
- `npm run typecheck` – runs `wrangler types`, React Router typegen, and the TypeScript project references; execute before committing.

## Coding Style & Naming Conventions
- TypeScript + JSX throughout; prefer functional components with hooks.
- Stick to existing Tailwind classes in `app/app.css`; new global styles belong there.
- Use descriptive camelCase for variables/functions and PascalCase for components. Keep utility helpers colocated near the route unless reused broadly.
- Comments are rare; add only when intent is non-obvious (e.g., File System Access quirks).

## Testing Guidelines
- No automated test suite exists; rely on `npm run typecheck` plus manual browser verification.
- When adding conversion features, document manual steps (browser + sample directory) in PR descriptions.
- If you introduce formal tests later, name files `*.test.ts` and place them alongside the code under test.

## Commit & Pull Request Guidelines
- History favors concise, descriptive messages (e.g., `OGP URL`, `jpb追加`). Summarize the change in the imperative mood.
- Each PR should include: purpose, key changes, screenshots or GIFs for UI tweaks, manual test notes (commands + browser scenarios), and linked issues if available.
- Ensure the branch passes `npm run typecheck` and that Worker config changes are called out explicitly, since they affect deployment.
