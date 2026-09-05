# Lè Anime

Personal anime library PWA built with React, Vite, TypeScript, IndexedDB, and GitHub Pages.

## Deployment

GitHub Pages is deployed through **GitHub Actions** using `.github/workflows/deploy-pages.yml`.

Anime cover art is stored in `public/covers/` and mapped through `src/generatedCovers.json`. Missing covers are handled incrementally by `.github/workflows/sync-covers.yml` and `scripts/sync-covers.mjs`; existing local covers are skipped.

The app verifies bundled covers before every production build.
