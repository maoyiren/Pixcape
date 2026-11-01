# CDPC GitHub main → GHCR → 1Panel 自动部署

## 自动流程
- `main` push：执行现有镜像构建与 PostgreSQL、MySQL、SQLite 启动冒烟测试。
- 测试通过后发布 `ghcr.io/maoyiren/pixcape:sha-<短 SHA>` 和 `latest`。
- 仅当 Actions Repository Variable `CDPC_DEPLOY_ENABLED=true` 时才执行 SSH 部署。
- 上传 Compose 文件和部署脚本到 1Panel 项目目录，部署该次提交对应的固定 SHA 镜像。
- 同时检查 Docker health 与 Next.js 首页 HTTP 200；失败时恢复当前容器镜像的本地 rollback tag。

## 1Panel 项目准备
在 1Panel Docker Compose 中创建或确认 CDPC 项目，项目目录作为 `CDPC_DEPLOY_PATH`。建议项目名为 `cdpc`，并确保 SSH 部署用户可写入该目录且有 Docker Compose 执行权限。

项目目录必须提前有 `.env`。workflow 只更新 `docker-compose.yml` 和 `deploy-1panel.sh`，不会上传、覆盖或删除 `.env`。至少确认：

```dotenv
PIXSCAPE_IMAGE_TAG=latest
PIXELCAPE_PORT=8080
DATABASE_PROVIDER=postgresql
DATABASE_URL=现有数据库连接
NEXTAUTH_SECRET=长随机密钥
NEXTAUTH_URL=https://cdpc.cc
```

继续保留当前部署需要的 GitHub OAuth、AI provider 等所有环境变量。容器默认映射 VPS 8080 → 容器 80，1Panel 网站反向代理将 `cdpc.cc` 指向 VPS 8080。若端口不同，修改 `PIXELCAPE_PORT`。

数据卷 `pixcape-data:/data` 保留应用数据；外部 PostgreSQL/MySQL 需要独立持久化和备份。不要把真实 `.env` 提交到仓库。

## GitHub Actions 配置
添加 Repository Variable：
- `CDPC_DEPLOY_ENABLED=true`（未设置时只构建并推送镜像，不会 SSH 部署）

添加 Repository Secrets：
- `CDPC_DEPLOY_HOST`：VPS SSH 主机/IP
- `CDPC_DEPLOY_USER`：专用部署用户
- `CDPC_DEPLOY_SSH_KEY`：部署用户私钥
- `CDPC_DEPLOY_PATH`：1Panel Compose 项目绝对路径
- `CDPC_DEPLOY_PORT`：SSH 端口，默认 22
- `CDPC_DEPLOY_FINGERPRINT`：SSH 主机指纹
- `CDPC_GHCR_USERNAME`：GHCR 拉取用户（私有 package 需要）
- `CDPC_GHCR_TOKEN`：仅授予 `read:packages` 的 PAT（私有 package 需要）

若 GHCR package 是公开的，可不设置 GHCR 凭据；私有 package 必须设置。部署用户需要能访问 Docker daemon。不要将 1Panel API 暴露到公网。

## 首次启用与回滚
首次部署前，先在 1Panel 中手动运行一个当前可用的 GHCR 镜像，并在 `.env` 中保留可用的旧 `PIXSCAPE_IMAGE_TAG`。脚本会将当前运行镜像打上本地 rollback tag；新版本启动或健康检查失败时恢复旧镜像。

脚本只回滚应用镜像，不会反向执行 Prisma migration。上线前备份数据库，并确保 migration 向后兼容。不要在部署后立即执行全量镜像清理。
