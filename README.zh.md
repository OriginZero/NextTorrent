<p align="right">
  <a href="README.md">🇬🇧 English</a> | <a href="README.zh.md">🇨🇳 中文</a>
</p>

# TorrentNext

聚合 43 个种子解析器的 Web 搜索服务。Next.js + TailwindCSS + TypeScript

## 截图

| 搜索首页 | 搜索结果 | 种子详情 |
|---------|---------|---------|
| ![首页](screenshots/app-home.png) | ![搜索结果](screenshots/app-search.png) | ![详情](screenshots/app-detail.png) |

## 架构

```
用户 → nginx:80 → Next.js (app):3000 → 外部种子 API/页面
```

- **Next.js App Router** — API 路由 + 前端页面，单体部署
- **43 个 Provider** — 从 Kotlin 移植的种子搜索解析器，覆盖电影、剧集、动漫、音乐、游戏、图书等分类
- **nginx** — 反向代理，生产环境入口

## 快速开始

### 开发模式

```bash
npm install
npm run dev
# http://localhost:3000
```

### Docker 部署

```bash
docker compose up -d
# http://localhost
```

## API

| 端点 | 说明 |
|------|------|
| `GET /api/search?q=<query>` | 搜索种子 |
| `GET /api/torrent/details?url=<url>&provider=<name>` | 种子详情 |
| `GET /api/torrent/latest?category=<cat>` | 最新种子 |
| `GET /api/torrent/top?category=<cat>` | 热门种子 |
| `GET /api/providers` | 可用解析器列表 |
| `GET /api/health` | 健康检查 |

## Provider 说明

43 个 Provider 位于 `src/lib/providers/`，每个独立实现搜索逻辑。部分站点有 Cloudflare 保护（如 Eztv、1337x），服务端无法绕过，建议通过客户端浏览器访问。

## 语言

支持 English / 中文，点击右上角切换。

---

## 致谢

本项目的 43 个种子解析器移植自 [prajwalch/TorrentNext](https://github.com/prajwalch/TorrentNext) —— 一个优秀的 Android 开源种子搜索应用。感谢原作者的出色工作。
