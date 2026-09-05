# Lè Anime admin setup

The public app stays read-only for normal visitors. Admin mode is enabled only after GitHub OAuth verifies the configured GitHub user ID. Repo writes are performed by the Cloudflare Worker, so no GitHub write credential is included in the public Vite bundle.

## 1. Create a GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.

Use:
- Application name: `Lè Anime Admin`
- Homepage URL: `https://mensahx1.github.io/project-anime/`
- Authorization callback URL: `https://<your-worker-domain>/auth/callback`

Copy the OAuth Client ID and generate a Client Secret.

## 2. Create a fine-grained GitHub token

Create a fine-grained personal access token restricted to only `MensahX1/project-anime` with repository `Contents: Read and write` permission. Do not commit this token to the repo.

## 3. Deploy the Worker

From the `worker/` directory with Wrangler installed/authenticated, set these secrets:

```bash
wrangler secret put GITHUB_OAUTH_CLIENT_ID
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
wrangler secret put GITHUB_REPO_TOKEN
wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` should be a long random value. Then deploy:

```bash
wrangler deploy
```

The committed `worker/wrangler.toml` already restricts admin access to GitHub user ID `115842080`, the repo to `MensahX1/project-anime`, and browser CORS to `https://mensahx1.github.io`.

## 4. Point the PWA at the Worker

In the GitHub repo: Settings → Secrets and variables → Actions → Variables → New repository variable.

Create:

- Name: `ADMIN_API_URL`
- Value: `https://<your-worker-domain>`

The Pages workflow exposes that value to Vite as `VITE_ADMIN_API_URL` at build time. Re-run `Deploy Lè Anime` after setting it.

## What happens after setup

- Friends can browse, search, filter, sort, and view details without signing in.
- Clicking Admin sends you to GitHub OAuth.
- Only GitHub user ID `115842080` receives an admin session.
- Add/Edit/Delete updates `src/anime.json` in GitHub.
- GitHub Actions deploys the new library.
- The cover sync workflow downloads a missing repo-hosted cover for new/renamed titles and removes stale cover files after deletions/renames.
