# AniVault

A personal anime library and discovery PWA built with React, Vite, TypeScript, and GitHub Pages.

## What it does

AniVault is a title-level anime catalog, not an episode-by-episode tracker. It supports:

- library statuses and 1–5 star ratings
- fast title, alias, franchise, genre, and studio search
- multi-genre, rating, decade, media-type, franchise, studio, recent-update, and unrated filters
- sorting by score, title, year, and studio
- a Random picker that chooses from the full personal catalog, including completed titles
- a compact library stats modal
- franchise grouping and related-title browsing
- installable PWA behavior with automatic service-worker updates
- owner-only admin add/edit/delete flows backed by GitHub Issues and Actions
- search-first anime creation using a local catalog generated from the Manami anime offline database

Personal watched-episode progress and AI recommendations are intentionally outside the v1 product scope.

## Data model

`src/anime.json` is the canonical personal library.

Entries retain the original display strings used by the app (`genre`, `studio`) while also supporting structured catalog fields such as `genres`, `studios`, `mediaType`, and `franchiseName`. Catalog metadata can include `metadataSource` and `metadataUpdatedAt`.

Cover art is repo-hosted under `public/covers/` and mapped by `src/generatedCovers.json`.

## Add Anime search

Admin mode loads `public/anime-index.json` only when the Add Anime search is opened. The index is generated from the latest Manami anime offline database and contains the fields needed for local search and form prefilling: title, synonyms, media type, episodes, year, genres, studios, and picture URL.

The full catalog is deliberately excluded from the PWA precache so it does not inflate the initial application download. `.github/workflows/sync-anime-index.yml` refreshes the index weekly and can also be run manually. `scripts/check-anime-index.mjs` prevents empty, malformed, or unexpectedly small indexes from reaching production.

## Admin write flow

The public app is read-only by default. Admin mode creates prefilled `[anime-admin]` GitHub Issues for add, edit, and delete requests.

`.github/workflows/anime-admin-issues.yml` applies a request only when the issue author's immutable GitHub user ID matches the library owner. Approved changes are committed to `src/anime.json`. That `main` push automatically triggers the normal cover-sync and Pages workflows; no browser-side repository credentials are exposed.

## Frontend structure

- `src/main.tsx` — PWA registration and React bootstrap
- `src/App.tsx` — page-level orchestration, random selection, and modal state
- `src/components/` — cards, details, filters, stats, forms, and catalog search
- `src/hooks/useCatalogFilters.ts` — catalog filtering and sorting state
- `src/hooks/useDialogFocus.ts` — reusable modal focus trapping/restoration
- `src/appData.ts` — canonical app data normalization and shared helpers
- `src/catalog.ts` — search aliases, franchise grouping, and media-type helpers
- `src/admin.ts` — admin issue URLs, new-entry defaults, and exports
- `src/types.ts` — shared TypeScript models

Catalog helpers and app-data behavior have unit coverage with Vitest.

## Automation

- `validate-pr.yml` — reproducible install, unit tests, cover verification, anime-index integrity check, and production build
- `deploy-pages.yml` — validates the catalog and deploys `main` to GitHub Pages
- `sync-covers.yml` — fills missing repo-hosted covers from the latest Manami release and removes stale mappings
- `sync-anime-index.yml` — regenerates and validates the local searchable anime catalog
- `anime-admin-issues.yml` — owner-authorized library writes

Dependencies are pinned in `package.json` and locked in `package-lock.json`; CI and production use `npm ci`.

## Local development

```bash
npm ci --legacy-peer-deps
npm test
npm run covers:check
npm run index:check
npm run dev
```

Production verification:

```bash
npm run build
```

## Release

The deployed app displays its build-time **Last deployed** timestamp in the footer, making stale PWA sessions easy to identify. AniVault is intended to remain a small, low-maintenance personal library rather than grow into a general-purpose tracking service.
