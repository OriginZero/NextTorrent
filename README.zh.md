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

### 在线体验地址

体验地址：**[https://OriginZero.github.io/NextTorrent/](https://OriginZero.github.io/NextTorrent/)**

> 页面通过 GitHub Actions 自动化静态导出并部署至 GitHub Pages。

### 开发模式

```bash
npm install
npm run dev
# http://localhost:3000
```

### GitHub Actions 自动化部署 (GitHub Pages)

本项目已配置 `.github/workflows/deploy.yml`。推送代码至 `main` 分支时将自动构建并发布到 GitHub Pages。

**首次使用请在 GitHub 仓库中开启 Pages：**
1. 进入 GitHub 仓库设置：`Settings` → `Pages`
2. 将 `Build and deployment` 的 `Source` 设置为 **GitHub Actions**
3. （可选）如需默认连接自定义外部后端，可在 `Settings` → `Secrets and variables` → `Actions` 中添加 Repository secret：`NEXT_PUBLIC_API_URL`（例如 `https://your-api.com`）

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

## 免责声明

TorrentNext 不托管、存储或分发任何种子文件或受版权保护的内容。它仅搜索公开可访问的第三方来源并展示结果。开发者不对这些结果的使用方式负责。

## 开源许可

[![GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

本项目采用 GNU General Public License v3.0 开源许可证。

## 致谢

本项目的 43 个种子解析器移植自 [prajwalch/TorrentSearch](https://github.com/prajwalch/TorrentSearch) —— 一个优秀的 Android 开源种子搜索应用。感谢原作者的出色工作。
