<p align="right">
  <a href="README.md">🇬🇧 English</a> | <a href="README.zh.md">🇨🇳 中文</a>
</p>

# TorrentNext

Aggregated torrent search across 43 providers. Built with Next.js + TailwindCSS + TypeScript.

## Screenshots

| Home | Search | Detail |
|---|---|---|
| ![Home](screenshots/app-home.png) | ![Search](screenshots/app-search.png) | ![Detail](screenshots/app-detail.png) |

## Architecture

```
User → nginx:80 → Next.js (app):3000 → External torrent APIs/Pages
```

- **Next.js App Router** — API routes + frontend pages, single deployment
- **43 providers** — Torrent search parsers ported from Kotlin
- **nginx** — Reverse proxy, production entry point

## Quick Start

### Development

```bash
npm install
npm run dev
# http://localhost:3000
```

### Docker

```bash
docker compose up -d
# http://localhost
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/search?q=<query>` | Search torrents |
| `GET /api/torrent/details?url=<url>&provider=<name>` | Torrent details |
| `GET /api/torrent/latest?category=<cat>` | Latest torrents |
| `GET /api/torrent/top?category=<cat>` | Top torrents |
| `GET /api/providers` | Available providers |
| `GET /api/health` | Health check |

## Providers

43 providers in `src/lib/providers/`, each implements its own search logic. Some sites (Eztv, 1337x) are Cloudflare-protected — server-side fetch fails, use client-side browse.

## Language

English / Chinese, toggle in the top-right corner of the app.

---

## Acknowledgments

The 43 torrent parsers in this project are ported from [prajwalch/TorrentNext](https://github.com/prajwalch/TorrentNext) — an excellent open-source Android torrent search app. Thanks to the original author for the great work.
