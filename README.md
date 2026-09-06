# Lè Anime

Personal anime library PWA built with React, Vite, TypeScript, and GitHub Pages.

## Product scope

The Watchlist is a personal anime library and discovery app, not an episode-by-episode tracker. It stores title-level metadata, library status, ratings, franchises, and recommendations. Total episode counts may be synced as catalog metadata, but personal watched-episode progress is intentionally not part of the design.

## Source of truth

`src/anime.json` is the canonical anime library. The app is read-only by default.

Edit mode can create prefilled `[anime-admin]` GitHub issues for add, edit, and delete requests. `.github/workflows/anime-admin-issues.yml` only applies those requests when the issue author's immutable GitHub user ID matches the library owner. Approved changes are committed to `src/anime.json`, then cover sync and Pages deployment are dispatched.

## Frontend structure

`src/main.tsx` only boots the PWA and renders the app. `src/App.tsx` owns page-level state and orchestration, while focused components live under `src/components/`. Shared catalog data helpers, admin helpers, and TypeScript models live in dedicated modules.

Catalog heuristics such as franchise grouping, media type detection, search aliases, and recommendation explanations live in `src/catalog.ts` and have unit coverage in `src/catalog.test.ts`.

## Deployment

GitHub Pages is deployed through **GitHub Actions** using `.github/workflows/deploy-pages.yml`.

Anime cover art is stored in `public/covers/` and mapped through `src/generatedCovers.json`. Missing covers are handled incrementally by `.github/workflows/sync-covers.yml` and `scripts/sync-covers.mjs`; existing local covers are skipped.

Pull requests run unit tests, cover verification, and the production build before merge. Production builds also verify bundled covers before deployment.
