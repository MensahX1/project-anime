# Lè Anime

Personal anime library PWA built with React, Vite, TypeScript, and GitHub Pages.

## Source of truth

`src/anime.json` is the canonical anime library. The app is read-only by default.

Edit mode can create prefilled `[anime-admin]` GitHub issues for add, edit, and delete requests. `.github/workflows/anime-admin-issues.yml` only applies those requests when the issue author's immutable GitHub user ID matches the library owner. Approved changes are committed to `src/anime.json`, then cover sync and Pages deployment are dispatched.

## Deployment

GitHub Pages is deployed through **GitHub Actions** using `.github/workflows/deploy-pages.yml`.

Anime cover art is stored in `public/covers/` and mapped through `src/generatedCovers.json`. Missing covers are handled incrementally by `.github/workflows/sync-covers.yml` and `scripts/sync-covers.mjs`; existing local covers are skipped.

The app verifies bundled covers before every production build.
