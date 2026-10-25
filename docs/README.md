# Pixcape 文档中心

本目录 `docs/` 是项目文档的**唯一正式文档目录**。旧的 `doc/` 已迁移到这里，不再保留第二套文档。

## 项目总技术文档

- **[CDPC / Pixcape 项目总技术与文档总纲](./PROJECT-MASTER-TECHNICAL-DOCUMENT.md)**：产品定位、技术栈、架构、路由、功能规格、认证、数据库、部署、UI 重构进度、安全、测试、合规和待办事项的统一入口。

## 快速入口

| 你要做什么 | 从这里开始 |
| --- | --- |
| 项目定位与当前架构 | [项目概览](./PROJECT_OVERVIEW.md)、[技术架构](./ARCHITECTURE.md) |
| 编辑器怎么用 | [使用指南](./USER_GUIDE.md) |
| 本地开发、贡献与 PR | [开发指南](./DEVELOPMENT.md) |
| 部署与环境变量 | [单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md)、[部署入口说明](./DEPLOYMENT.md) |
| 登录、OAuth、邮箱魔法链接与首次管理员初始化 | [登录配置指南](./AUTHENTICATION-SETUP.md) |
| 独立 Next.js 容器 | [Next.js 容器部署](./NEXTJS-CONTAINER-DEPLOYMENT.md) |
| 用户、创作者、管理员与数据库迁移 | [角色与迁移方案](./NEXTJS-USER-ROLES-MIGRATION.md) |
| 发布、验证与回滚 | [发布清单](./RELEASE.md)、[生产安全上线清单](./PRODUCTION-SECURITY-ROLLOUT.md) |
| AI 图片模型接口 | [AI 模型架构](./AI-MODEL-ARCHITECTURE.md) |
| PWA、SEO 与分享元数据 | [PWA / SEO 部署](./PWA-SEO-DEPLOYMENT.md) |
| 第三方许可证和素材署名 | [第三方声明](../THIRD_PARTY_NOTICES.md) |

## 文档分组

- **产品与架构**：PROJECT_OVERVIEW.md、ARCHITECTURE.md、USER_GUIDE.md
- **开发与协作**：DEVELOPMENT.md
- **部署与运维**：DEPLOYMENT.md、SINGLE-IMAGE-PRODUCTION.md、NEXTJS-CONTAINER-DEPLOYMENT.md、RELEASE.md、PRODUCTION-SECURITY-ROLLOUT.md
- **功能与集成**：AUTHENTICATION-SETUP.md、NEXTJS-USER-ROLES-MIGRATION.md、AI-MODEL-ARCHITECTURE.md、PWA-SEO-DEPLOYMENT.md
- **许可与合规**：根目录 THIRD_PARTY_NOTICES.md

## 推荐阅读顺序

1. 阅读项目概览和技术架构。
2. 使用编辑器时查看使用指南。
3. 开发或贡献代码时查看开发指南。
4. 部署前阅读单镜像部署、环境变量和发布清单。
5. 配置登录提供商或初始化管理员时，阅读登录配置指南。
6. 涉及账户、权限、数据库或生产变更时，必须额外阅读角色迁移方案与生产安全清单。

## 文档维护规则

- 所有正式项目文档统一放在 `docs/`；不要重新创建旧的 `doc/` 目录。
- 环境变量以根目录 `.env.example`、实际读取代码和部署文档交叉核对；示例值不是生产值。
- 代码、工作流、Docker 入口或 UI 行为变化时，同一 PR 更新对应文档和本索引。
- 明确区分**已实现**、**需部署配置**、**尚待验证**。文档描述的步骤不等于线上已经执行。
- 不在文档、提交、截图或日志中写入真实密码、API Key、OAuth Secret 或数据库连接凭据。
- 避免重复描述同一配置；以单镜像生产部署文档为生产部署的主要依据。
