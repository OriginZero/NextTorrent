<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server at `localhost:3000` |
| `npm run build` | Build (output: `.next/standalone/`) |
| `npm run start` | Start production |
| `npm run lint` | ESLint |
| `docker compose up -d` | Full stack with nginx on `:80` |

No test runner configured.

## Architecture

- **Next.js 16 App Router** monolith — API route handlers in `src/app/api/`, pages in `src/app/`
- **43 providers** in `src/lib/providers/`, each extends `BaseProvider` and implements the `SearchProvider` interface (`src/lib/types.ts:77`)
- **`SearchProvidersManager`** (`src/lib/manager.ts`) holds the provider list; filters by category and capability
- **`SearchProvidersGateway`** (`src/lib/gateway.ts`) orchestrates parallel searches across providers via `Promise.allSettled`
- **`httpClient`** (`src/lib/http-client.ts`) singleton — 20s timeout, mobile UA, `CloudflareChallengeError` on 403/503/cf-mitigated
- **i18n** via React context (`I18nProvider` in `src/lib/i18n/context.tsx`) — English and Chinese, toggled by header buttons, persisted in `localStorage`

## Adding a Provider

1. Create `src/lib/providers/<name>.ts` extending `BaseProvider`
2. Implement `search(query, context): Promise<Torrent[]>`
3. Optionally implement `getDetails`, `getLatestTorrents`, `getTopTorrents`
4. Set `supportedCategories`, `enabledByDefault`, `isCloudflareProtected`
5. Register in `src/lib/providers/index.ts` — import and add to `BuiltinSearchProviders` array

Providers use `ctx.httpClient` for search context methods or the singleton `httpClient` for static calls. Both work, prefer the injected `ctx.httpClient` in search.

## API Routes (Route Handlers)

All in `src/app/api/`. Each file exports `GET` (and optionally `POST`) async functions receiving `NextRequest`.

See `src/app/api/search/route.ts` for the simplest pattern — instantiate `manager` + `gateway` at module level (not per-request).

## Notable

- `next.config.ts` sets `output: 'standalone'` — required for Docker build (see `Dockerfile`)
- `@/*` path alias maps to `./src/*`
- `infoHash` is the primary torrent identifier, parsed from magnet URIs via `getInfoHashFromMagnetUri()` in `src/lib/utils/torrent.ts`
- Some providers (Eztv, 1337x) are Cloudflare-protected — server-side fetch fails, client-side browse suggested
- `ThePirateBay` is `enabledByDefault: false` due to safety warnings
