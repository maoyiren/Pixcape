# CDPC GitHub main → GHCR → 1Panel V2 自动部署

## 工作方式

1. 合并或直接推送到 `main`。
2. `.github/workflows/docker-publish.yml` 先运行 PostgreSQL / MySQL / SQLite 容器冒烟测试。
3. 测试通过后构建并推送 `ghcr.io/maoyiren/pixcape`，同时发布 `latest` 和 `sha-<短 SHA>` 标签。
4. 仅当仓库变量 `CDPC_DEPLOY_ENABLED=true` 时，GitHub Actions 才通过 SSH 把 Compose 文件和部署脚本传到 1Panel 项目目录，并部署本次提交对应的 SHA 镜像。
5. 脚本保存当前运行镜像为本地 rollback 标签，更新 `PIXSCAPE_IMAGE_TAG`，拉取新镜像、重建容器并等待 Docker healthcheck。失败时自动恢复旧镜像。

## GitHub 配置

在仓库 Settings → Secrets and variables → Actions 中设置：

### Repository variables

| 名称 | 值 |
|---|---|
| `CDPC_DEPLOY_ENABLED` | `true`（全部准备好后再启用；设为 `false` 可暂停自动部署） |

### Repository secrets

| 名称 | 说明 |
|---|---|
| `CDPC_DEPLOY_HOST` | VPS 公网 IP 或 SSH 域名 |
| `CDPC_DEPLOY_USER` | 专用部署用户，建议不要使用 root |
| `CDPC_DEPLOY_SSH_KEY` | 对应用户的 SSH 私钥（仅私钥内容，不要提交到仓库） |
| `CDPC_DEPLOY_PORT` | SSH 端口；默认 22 |
| `CDPC_DEPLOY_PATH` | 1Panel 中 CDPC Compose 项目的实际目录，目录内应有当前生产环境的 `.env` |
| `CDPC_DEPLOY_FINGERPRINT` | VPS SSH 主机公钥指纹，用于校验 SSH 主机身份 |
| `CDPC_GHCR_USERNAME` | GHCR 拉取账号；仅私有镜像需要 |
| `CDPC_GHCR_TOKEN` | 仅授予 `read:packages` 的 PAT；仅私有镜像需要 |

部署用户需要有权限在该目录写入文件，并执行 Docker / Docker Compose。建议只授予必要的 Docker 管理权限；加入 docker 组本身等同于较高主机权限，请妥善保护 SSH 私钥。

## 1Panel V2 准备

1. 在 1Panel V2 创建或确认 CDPC Compose 项目，使用本仓库的 `docker-compose.yml`。
2. 将项目目录的实际绝对路径填入 `CDPC_DEPLOY_PATH`。不要猜测路径；可在 1Panel 项目详情中查看 Compose 文件所在目录。
3. 保留并检查现有 `.env`。数据库连接、`NEXTAUTH_SECRET`、OAuth、AI API Key 等生产值继续保存在 1Panel 项目的 `.env`，不要放进 GitHub workflow。
4. 当前 Compose 使用命名卷 `pixcape-data` 持久化 `/data`。不要删除该卷；生产数据库若为外部 PostgreSQL/MySQL，也要确保数据库本身有独立备份。Compose 文件只拉取 GHCR 镜像，不在 VPS 本地构建。
5. 确认服务器已安装 Docker Compose 插件，部署用户可以运行 `docker compose`。
6. GHCR 若为私有包，在 GitHub Secrets 中设置 `CDPC_GHCR_USERNAME` 和 `CDPC_GHCR_TOKEN`；部署脚本会通过 stdin 登录，不会把 Token 写入 `.env`。若镜像包为 Public，可不设置这两个 Secret。
7. 部署脚本会优先读取现有 `pixcape` 容器的 Compose project label，以沿用 1Panel 当前项目名和项目级命名卷；首次部署则使用项目目录名。不要在自动部署过程中更换项目目录或 Compose 项目名。

## 首次接入注意事项

- 先在 1Panel 手动备份当前 Compose 项目目录的 `.env` 和数据库。
- 先不要设置 `CDPC_DEPLOY_ENABLED=true`。先完成 SSH 连通性、目录权限、GHCR 拉取权限和 Compose 配置验证。
- 首次自动部署时，脚本会尝试把当前运行容器的镜像 ID 重新标记为 rollback 镜像；如果没有现存容器，就没有可回滚版本。
- 自动部署使用精确 SHA 标签，不依赖可变的 `latest` 标签。
- 数据库迁移由容器现有 entrypoint 在启动时执行 `prisma migrate deploy`。部署前必须确保数据库备份有效；应用回滚不会自动反向回滚数据库 schema。
- 1Panel 继续负责容器项目和卷的可视化管理；GitHub Actions 负责发布与触发更新。不要同时在 1Panel 配置另一条自动拉取相同镜像的更新任务。

## 手动验证

在服务器的 1Panel Compose 项目目录执行：

```bash
docker compose config -q
docker compose ps
docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q pixcape)"
```

默认容器端口映射为 VPS `8080` → 容器 `80`；如在 `.env` 中更改 `PIXELCAPE_PORT`，需同步修改 1Panel 网站反向代理目标。

部署完成后检查：

- `https://cdpc.cc/health`
- `https://cdpc.cc/`
- 1Panel 项目日志及容器健康状态

## 暂停自动部署

把仓库变量 `CDPC_DEPLOY_ENABLED` 改为 `false`。镜像仍会构建并发布，但不会通过 SSH 更新 VPS。
