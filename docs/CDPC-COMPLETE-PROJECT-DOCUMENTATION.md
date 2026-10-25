# CDPC / Pixcape 项目完整文档总集

> 本文件将仓库原有专项文档按原文完整合并，保留决策、实施计划、部署说明、技术细节和历史记录。不同文件之间可能有重复或过时信息；冲突时以当前代码、`.env.example`、Prisma schema/migrations、Docker 启动文件和最新 CI/生产证据为准。文档合并不代表所有计划均已实现或通过验证。

- 仓库：https://github.com/maoyiren/Pixcape
- 整理日期：2026-10-25
- 原文按文件分节保留，文件路径与原始 Blob SHA 作为追溯信息。



---

# 原文：`docs/AI-MODEL-ARCHITECTURE.md`

> 原文件 Blob SHA：`8d689e7c046331303fe0b84ca07c6cbca57acd06`

# Pixcape AI 多模型架构方案

## 目标

在 Pixcape 现有 Vite/React 前端中加入 AI 皮肤工坊，同时将模型接入做成可扩展的服务端能力。第一阶段支持文字生成和参考图转换；生成结果必须通过 Minecraft 皮肤纹理映射与校验流程，再进入现有 3D 预览和编辑器。

## 架构原则

1. 浏览器不得持有任何供应商 API Key。
2. 前端只调用 Pixcape 自己的服务端 API，不直接请求模型供应商。
3. 统一服务端 provider 路由，供应商适配器可单独启停。
4. 用户可选模型；“自动”模式按任务、可用密钥、能力和成本路由。
5. 模型生成的角色概念图不能直接当作皮肤 PNG。必须经过 UV/面板映射、Classic/Slim 适配、透明像素规则校验和 3D 预览。
6. 失败切换只对可重试错误启用；用户主动选择的模型失败时，默认明确报错，不应静默更换模型。
7. 记录 provider/model、耗时、状态和成本估算，不记录 API Key；对上传文件设大小、格式和速率限制。

## 当前支持的供应商

| 供应商 | 服务端密钥 | 默认模型示例 | 文生图 | 参考图编辑 |
|---|---|---|---|---|
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash-image` | 是 | 是 |
| OpenAI Images | `OPENAI_API_KEY` | `gpt-image-1` | 是 | 是 |
| OpenRouter | `OPENROUTER_API_KEY` | 由账户配置 | 依模型而定 | 仅对配置允许的模型开放 |
| Doubao Seedream（火山方舟） | `ARK_API_KEY` | `doubao-seedream-5-0-lite-260128` | 是 | 依所选模型与账户权限 |

Seedream 通过火山方舟图片生成 API `POST /api/v3/images/generations` 调用；可用模型 ID、地域端点与账户权限应以火山方舟控制台为准。参考图以服务端生成的 data URL 传入，返回图像先做格式/尺寸限制，再进入统一皮肤转换器。

## 配置

所有密钥只在服务端环境变量中设置，不得加 `VITE_` 前缀：

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `ARK_API_KEY`（或 `VOLCENGINE_ARK_API_KEY`）
- `SEEDREAM_IMAGE_MODELS`（可配置多个模型 ID）
- `ARK_BASE_URL`（可选，默认为北京地域的 Ark API 基础地址）
- `AI_DEFAULT_PROVIDER=auto`
- `AI_DEFAULT_MODEL`（可选，需与配置的供应商匹配）
- `AI_MAX_UPLOAD_MB`
- `AI_RATE_LIMIT_PER_MINUTE`

## UI 设计

- 模型选择：自动 / Gemini / OpenAI / OpenRouter / Seedream 内已配置的具体模型。
- 生成方式：文字生成 / 参考图转换。
- 输出：概念图、皮肤纹理、校验结果、3D 预览；支持重新生成和进入现有编辑器。
- 对用户显示“生成中、映射中、校验失败、可编辑、可导出”等明确状态。

## 交付与验证顺序

1. 核对当前仓库后端与部署入口。当前前端仍为 React + TypeScript + Vite，不能假定 Next.js API 路由已经存在。
2. 由独立 `ai-api/` Node.js 服务调用各供应商，保留现有 Nginx、Docker 与 Zeabur 链路。
3. 逐个供应商用真实密钥验证文生图和参考图两条链路。
4. 测试纹理映射、Classic/Slim、上传校验、限流、超时、错误处理与模型选择。
5. 运行构建和自动化测试；确认没有密钥泄漏、现有编辑器路由无回归后，再合并和部署。

## 实施状态（2026-10-17）

开发分支 `feature/ai-skin-generator` / 草稿 PR #18 已加入独立 `ai-api/` 服务、Gemini / OpenAI Images / OpenRouter 适配器、Doubao Seedream 适配器、可配置模型 ID、参考图上传、皮肤 UV 转换、限流与上传限制，以及 Docker / CI 测试。Seedream 代码接入不代表真实 API 调用已验证；仍需在部署环境设置有效 Ark API Key 和账户可用的模型 ID，执行有可能计费的文生图与图生图测试。转换器是第一版，输出仍需 3D 预览人工检查。



---

# 原文：`docs/ARCHITECTURE.md`

> 原文件 Blob SHA：`64b96f43906cdd70e99fbbaa7ff2300e4e467a66`

# Pixcape 技术架构说明

## 1. 总体架构

Pixcape 当前包含 React + TypeScript + Vite 编辑器、Blockbench Web 入口，以及 Next.js 账户/API 相关代码。生产请求由单镜像中的 Nginx 统一路由；实际启用的功能以当前 Dockerfile、入口脚本和部署验证为准。

```text
浏览器
  ├── Next.js 主站 / 账户 / API
  ├── Vite 构建的皮肤编辑器（/studio/）
  └── Blockbench Web（/blockbench/）
                │
                ▼
      Docker 镜像 + Nginx 路由
                │
                ▼
         Zeabur 或其他容器平台
```

## 2. 像素数据模型

编辑器使用长度为 4096（64×64）的字符串数组表示画布。数组每个元素对应一个像素：

- 空字符串代表透明像素。
- 颜色字符串代表像素颜色。
- 索引通过 `y * SIZE + x` 计算。
- 坐标从画布的指针位置换算为 0 到 63 的整数坐标。

当前数据模型是运行时内存状态，不是持久化项目文件格式。

## 3. 绘制与工具

当前工具类型包括：

- Pencil：写入当前颜色。
- Eraser：将目标像素设为空字符串。
- Fill：使用栈遍历与起始像素相连且颜色相同的区域。
- Eyedropper：从非透明像素读取颜色。
- Line：根据起点和终点生成直线像素索引。

指针事件通过 Canvas 元素捕获，便于用户拖动绘制。画布重绘时先清除 Canvas，再遍历像素数组，将非空颜色绘制为单像素矩形。

## 4. 历史记录

撤销/重做通过像素数组快照实现。新操作会更新撤销历史并清除重做历史。历史快照保存在浏览器内存中；页面刷新后不会保留。

新增编辑操作时，应确认历史快照是在一次完整操作前创建，避免拖动过程中生成过多无意义的历史记录。

## 5. 图片导入

导入时创建临时 Canvas，将源图像按比例缩放并居中绘制到 64×64 画布，再读取像素数据。透明度低于阈值的像素保持透明，其余像素转换为 RGB 十六进制颜色。

由于当前模型仅存储颜色、不存储每像素的透明度值，导入图像的半透明像素会转换为不透明 RGB 像素；透明背景会保留。

## 6. 导出与透明背景

像素内容渲染到透明 Canvas。导出 PNG 时未绘制区域保持透明。若将来增加缩放导出或其他格式，应单独验证输出尺寸、透明度和边缘像素。

## 7. 生产容器

生产镜像与路由细节以 [单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md) 为准。当前方案包含 Next.js、Vite 静态编辑器、Blockbench 与 Nginx；不要把旧的纯静态 Vite 部署说明直接当作当前生产架构。

## 8. 当前限制与后续演进

当前版本没有实现云端账户、项目数据库、跨设备同步或自动云保存。若将来增加这些能力，需要重新评估后端 API、身份验证、存储和隐私安全设计。



---

# 原文：`docs/AUTHENTICATION-SETUP.md`

> 原文件 Blob SHA：`0c572ee4681cfa2a3a1480bad0b462574bd62252`

# 登录方式、OAuth 与管理员初始化配置指南

本文对应当前仓库的 NextAuth v4 实现。配置项以根目录 `.env.example` 和 `auth.ts` 为准。

> **重要：** 当前版本的登录方式通过部署环境变量启用。管理后台里的 OAuth / SMTP / AI 配置区域如果仍显示占位内容，就不代表它已经能保存或更新这些密钥。请在 Zeabur、Docker 部署平台的环境变量 / Secrets 页面配置，并在修改后重启或重新部署服务。

## 1. 配置前准备

1. **CDPC 生产主域名固定使用 `https://cdpc.cc`。** 本部署目标是 Zeabur 上的 Pixcape 单镜像服务，不再使用 Vercel `home` 项目作为应用入口。
2. 在部署平台配置数据库，先阅读[单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md)。数据库必须使用持久化存储；不要在生产环境使用临时 SQLite 文件。
3. 配置稳定的 `NEXTAUTH_SECRET`。可使用密码管理器生成至少 32 字节随机值；也可在可信终端运行：
   ```bash
   openssl rand -base64 48
   ```
   把输出保存到部署平台 Secret 中。**不要每次启动时重新生成**，否则会影响会话和加密相关配置。
4. 在 Zeabur 的 Pixcape 服务环境变量中设置 `NEXTAUTH_URL=https://cdpc.cc`（不要带末尾路径），并设置持久的 `NEXTAUTH_SECRET`。修改环境变量后重新部署服务。
5. 只启用你已完成配置的登录方式。对应 ID 和 Secret 必须成对填写；未配置完整的提供商不会显示在登录页。

本地开发时可以把 `.env.example` 复制为未提交的 `.env.local`。不要把真实密钥提交到 Git。

## 2. OAuth 提供商设置

CDPC 生产环境使用以下**精确回调地址**。在启用的每个 OAuth 提供商控制台登记对应地址，协议、域名和路径必须完全一致：

| 提供商 | OAuth 回调 URL |
| --- | --- |
| GitHub | `https://cdpc.cc/api/auth/callback/github` |
| Google | `https://cdpc.cc/api/auth/callback/google` |
| Microsoft Entra ID | `https://cdpc.cc/api/auth/callback/azure-ad` |
| Apple | `https://cdpc.cc/api/auth/callback/apple` |

不要把登录发起地址、主页 URL 或 Zeabur 的临时域名误填成回调地址。若还要用临时域名测试，可额外登记对应的临时回调 URL，但生产登录必须回到 `cdpc.cc`。

### GitHub

**配置入口：** [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)

1. 打开上方链接，进入 OAuth Apps，创建或选择应用。
2. Homepage URL 填主站网址。
3. Authorization callback URL 填 `https://你的域名/api/auth/callback/github`。
4. 将 Client ID、Client Secret 配到部署环境：

```dotenv
AUTH_GITHUB_ID="你的 GitHub OAuth Client ID"
AUTH_GITHUB_SECRET="你的 GitHub OAuth Client Secret"
```

### Google

**配置入口：** [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) · [OAuth consent screen / Google Auth Platform](https://console.cloud.google.com/auth/overview)

1. 打开上方链接，在 Google Cloud Console 中配置 OAuth consent screen，并创建 OAuth Client ID（Web application）。
2. Authorized JavaScript origins 填主站网址。
3. Authorized redirect URIs 填 `https://你的域名/api/auth/callback/google`。
4. 设置：

```dotenv
AUTH_GOOGLE_ID="你的 Google Client ID"
AUTH_GOOGLE_SECRET="你的 Google Client Secret"
```

若应用处于测试发布状态，只允许 OAuth 同意屏幕中添加的测试用户登录；上线前检查应用受众、验证状态和 Google 的最新要求。

### Microsoft

**配置入口：** [Microsoft Entra admin center → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

1. 打开上方链接注册应用。
2. 添加 Web 平台的 Redirect URI：`https://你的域名/api/auth/callback/azure-ad`。
3. 创建客户端密码，并按租户策略配置支持的账户类型。
4. 设置：

```dotenv
AUTH_MICROSOFT_ENTRA_ID_ID="你的 Application (client) ID"
AUTH_MICROSOFT_ENTRA_ID_SECRET="你的客户端密码值"
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="common"
```

`AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` 可用 `common`、`organizations`、`consumers` 或特定租户 UUID。若只允许组织内部账户，选择对应组织租户配置。客户端密码应填写创建时显示的 **Value**，不是 Secret ID。

### Apple

**配置入口：** [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) · [Sign in with Apple 官方说明](https://developer.apple.com/sign-in-with-apple/)

1. 打开上方链接配置 Sign in with Apple，按 Apple 要求准备已启用的 App ID / Services ID、域名与回调地址。
2. Return URL 填 `https://你的域名/api/auth/callback/apple`。
3. Apple 的客户端密钥涉及 Team ID、Key ID 和私钥生成的 client-secret JWT。按 Apple 当前开发者文档生成有效密钥，再将其配置为：

```dotenv
AUTH_APPLE_ID="你的 Apple Services ID"
AUTH_APPLE_SECRET="按 Apple 要求生成的 client-secret JWT"
```

Apple 密钥可能会过期，需要设置到期提醒并在失效前更新。Apple 控制台中的域名验证、HTTPS 和回调地址要求必须按其当前文档完成。

## 3. 邮箱魔法链接（SMTP）

邮箱登录不是密码登录。用户提交邮箱后，系统发送一次性登录链接；当前代码把链接有效期设为 **15 分钟**。只有能够接收该邮箱邮件的人才能使用链接。

需要一个允许应用发送邮件的 SMTP 服务商，并获取服务器地址、端口、用户名和密码。可参考：[Resend SMTP 文档](https://resend.com/docs/send-with-smtp)、[Brevo SMTP 文档](https://help.brevo.com/hc/en-us/articles/7924908992402)。请先选择并注册你实际使用的服务商。将 SMTP 连接 URL 放进 `EMAIL_SERVER`，发件人放进 `EMAIL_FROM`：

```dotenv
EMAIL_SERVER="smtp://SMTP用户名:URL编码后的密码@smtp.example.com:587"
EMAIL_FROM="Pixcape <no-reply@example.com>"
```

以上为格式示例，不能直接照抄。请使用邮件服务商提供的主机、端口和 TLS 要求。若密码含有 `@`、`:`、`/`、`#` 等保留字符，应进行 URL 编码。不同 SMTP 服务商的连接 URL / TLS 要求可能不同；严格按服务商文档填写，不要把 SMTP 密码贴到聊天或提交到仓库。

如果服务商要求隐式 TLS（常见端口 465），通常使用 `smtps://`；若使用 STARTTLS（常见端口 587），按服务商支持的配置填写。配置完成后，重启应用，在登录页选择邮箱登录，并检查收件箱、垃圾邮件和应用日志。日志中不应出现 SMTP 密码或完整魔法链接。

`EMAIL_SERVER` 与 `EMAIL_FROM` 都填写后，邮箱登录选项才会显示。

## 4. 首次管理员初始化

新用户首次登录默认是普通用户，不会自动成为管理员。项目提供一次性脚本 `npm run db:bootstrap-admin`：

1. 先完成数据库连接和至少一种登录方式配置。
2. 使用该登录方式登录一次，确保数据库中已创建对应用户记录。
3. 在运行应用脚本的同一部署版本/容器中，临时设置 `BOOTSTRAP_ADMIN_EMAIL` 为该账户的**实际登录邮箱**。
4. 在部署容器的终端或受控运维环境执行：
   ```bash
   npm run db:bootstrap-admin
   ```
5. 确认脚本成功并核对管理员账户后，立即从环境变量中删除 `BOOTSTRAP_ADMIN_EMAIL`，再重新部署/重启服务。

注意事项：

- 这是受控的一次性初始化步骤，不是普通登录密码，也不应长期保留该变量。
- 必须确保邮箱与已登录用户记录完全匹配。OAuth 提供商返回的邮箱若为空或不一致，先检查账户记录，不要猜测。
- 不要把自己的管理员权限撤销，也不要在未确认还有其他有效管理员之前操作。
- 生产环境执行前先备份数据库，并确认执行目标是正确的实例。
- 如果部署平台没有交互式终端，使用其受控一次性任务/运维入口执行；不要为了运行脚本把数据库公开到互联网。

## 5. 登录限流与代理 IP

当前示例默认：

```dotenv
LOGIN_RATE_LIMIT_MAX="10"
LOGIN_RATE_LIMIT_WINDOW_SECONDS="900"
LOGIN_RATE_LIMIT_IP_HEADER="x-real-ip"
```

即默认每个识别到的 IP 在 15 分钟窗口内最多 10 次尝试。应用应只信任由自己控制的反向代理覆盖写入的 IP 头。如果服务直接暴露公网，不能信任用户可自行伪造的 `X-Real-IP` 或 `X-Forwarded-For`。先确认 Zeabur / Nginx / 负载均衡器的实际代理行为，再选择可信头；不要盲目更改默认值。

## 6. 部署验证清单

- [ ] Zeabur 服务环境变量 `NEXTAUTH_URL` 精确为 `https://cdpc.cc`，生产环境使用 HTTPS。
- [ ] `NEXTAUTH_SECRET` 是随机、持久的 Secret，且没有提交到 Git。
- [ ] OAuth 控制台已登记上表中对应的 `https://cdpc.cc/api/auth/callback/<provider>` 回调 URL。
- [ ] 登录页只显示已配置的提供商；未配置的方式不会显示。
- [ ] OAuth 登录能完成授权、回调、数据库用户创建与会话建立。
- [ ] 邮箱魔法链接可投递、15 分钟内可使用，过期后不可再用于登录。
- [ ] 新用户默认是 USER；只有通过受保护的管理员流程才能授予 ADMIN。
- [ ] 首次管理员初始化完成后已移除 `BOOTSTRAP_ADMIN_EMAIL`。
- [ ] 生产数据库有持久化与备份；代理 IP 头配置经过验证。
- [ ] 检查部署日志、Git 历史和错误追踪中没有泄露密钥、SMTP 凭据或魔法链接。

## 7. 常见问题

**登录页没有显示某个提供商？** 检查其 ID 与 Secret 是否都已设置，变量名是否完全匹配，修改后是否重启/重新部署。

**出现 `redirect_uri is not associated with this application`？** 检查触发登录的具体提供商，并将其控制台回调地址精确设为上表中对应的 `https://cdpc.cc/api/auth/callback/<provider>`。同时核对 Zeabur 的 `NEXTAUTH_URL=https://cdpc.cc`，保存 OAuth 控制台配置后重新部署/重试。

**邮箱收不到链接？** 检查 SMTP 主机、端口、TLS、凭据、发件人域名验证、服务商发送限制和垃圾邮件文件夹；不要公开粘贴包含凭据的 SMTP URL。

**能否直接在管理员后台填写 OAuth/SMTP 密钥？** 当前以部署环境变量为准。除非后续版本实现并通过安全验收的加密配置存储功能，否则不要假设后台占位配置卡片能保存密钥。

**登录成功但没有管理员入口？** 确认数据库中用户状态为 ACTIVE、角色确为 ADMIN，并重新登录刷新数据库会话。不要通过修改客户端页面或请求参数赋予自己管理员权限。

## 相关文档

- [环境变量模板](../.env.example)
- [单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md)
- [用户、创作者与管理员迁移方案](./NEXTJS-USER-ROLES-MIGRATION.md)
- [生产安全上线清单](./PRODUCTION-SECURITY-ROLLOUT.md)


## 8. 管理员用户名 / 密码登录

部署环境可设置以下三个变量，全部非空时登录页会显示单独的“管理员登录”入口：

```dotenv
ADMIN_USERNAME="你的管理员用户名"
ADMIN_PASSWORD="请使用唯一且足够长的随机密码"
ADMIN_EMAIL="用于管理员账户的邮箱"
```

这组凭据与普通用户注册分离。首次使用正确凭据登录时，如果数据库中还没有该邮箱，会创建管理员账户；若已有该邮箱则授予 ADMIN 角色。账户必须处于 ACTIVE 状态。请只在受控部署 Secrets 中保存密码，不要把真实值提交到仓库或聊天记录。部署后请验证登录成功后能进入 `/admin`，并确认退出后无法访问管理员页面。

## 9. 邮箱与密码注册

当前注册页为 `/register`。默认不要求邮箱验证码：用户填写邮箱、至少 10 位密码即可创建普通用户，密码使用 Node.js scrypt 加盐哈希保存，不会以明文写入数据库。注册接口使用持久化 IP 限流。邮箱魔法链接仍是可选登录方式，需要配置 SMTP 后才显示。

首次部署此版本前，先在维护窗口备份数据库并同步 Prisma schema：

```bash
npm run db:push
npm run db:generate:all
```

`db:push` 会依据 `DATABASE_PROVIDER` 选择 PostgreSQL、MySQL 或 SQLite schema。请先在测试数据库验证；生产环境不要在未备份时执行 schema 变更。PostgreSQL 部署也可按项目现有 migration 流程运行 `npm run db:migrate`，并确认新 migration 已包含在部署版本中。

普通邮箱注册不会自动授予管理员权限。管理员登录凭据应与普通账户登录流程分开保管。管理员可在“系统配置中心”开启邮箱验证。开启后，新注册账户必须点击有效期 30 分钟的一次性邮件链接才能使用邮箱密码登录；关闭时（默认）无需邮箱验证码。开启前必须配置并测试 EMAIL_SERVER、EMAIL_FROM 与 NEXTAUTH_URL。


## 10. CDPC 主域名切换到 Zeabur

生产应用目标域名为 `https://cdpc.cc`。切换时请按以下顺序，避免先改 DNS 导致网站暂时不可用：

1. 在 Zeabur 中打开正在运行 Pixcape 单镜像的 HTTP 服务，先确认服务端口、健康状态和 `ghcr.io/maoyiren/pixcape:latest` 镜像版本。
2. 在该服务的 **Domains / Custom Domain** 中添加 `cdpc.cc`，让 Zeabur 显示本次绑定所要求的 DNS 记录目标。
3. 在 Cloudflare DNS 中，将根域名现有的旧站记录切换为 Zeabur 控制台给出的记录。**不要猜测 CNAME 目标或使用固定 IP**；Zeabur 为服务显示的目标才是依据。Cloudflare 的根域名支持 CNAME flattening。
4. 原来的 `www.cdpc.cc` 记录当前指向 Vercel；如果希望 `www.cdpc.cc` 也进入 Pixcape，可在 Zeabur 另外绑定该域名，并按 Zeabur 给出的 DNS 目标更新记录；否则先保留原有 www 行为。
5. 在 Zeabur 设置 `NEXTAUTH_URL=https://cdpc.cc`，并检查 `NEXTAUTH_SECRET`、`DATABASE_PROVIDER`、`DATABASE_URL` 等生产环境变量。重新部署后验证 `https://cdpc.cc/login`、`/register` 和 `/api/auth/providers`。
6. 在所启用的 OAuth 提供商后台逐一登记本指南列出的回调 URL，并执行完整登录/登出测试。

注意：代码仓库可以提供镜像和正确的回调地址，但不能代替 Zeabur 服务绑定，也不能自动修改 Google、Microsoft 或 Apple 开发者控制台中的 OAuth 应用设置。DNS 记录只有在 Zeabur 控制台显示确切目标后才能安全切换。



---

# 原文：`docs/CDPC-BLESSING-SKIN-INTEGRATION-PLAN.md`

> 原文件 Blob SHA：`6f70368bbd7a123443404007e8152636ccc1e73f`

# CDPC × Blessing Skin Server 融合实施方案

> 状态：架构与实施计划；本文件不代表已完成部署或账号打通。
> 日期：2026-10-24
> 目标仓库：`maoyiren/Pixcape`
> 上游项目：`bs-community/blessing-skin-server`

## 1. 决策摘要

采用“CDPC 主平台 + 独立 Blessing Skin 服务 + 受控适配层”的松耦合架构。不把 Blessing Skin Server 的 PHP/Laravel 代码合并进 Next.js，也不让它替换 CDPC 现有认证、Prisma 数据层或创作工坊。

第一阶段先交付兼容性验证、皮肤 PNG 导入/导出约定、作品与皮肤资产的关联模型，以及可关闭的外部皮肤服务配置。只有在独立环境通过安全、备份、兼容性和运维验证后，才开放真实服务接入。

## 2. 已核验的仓库基线

### CDPC

- 主仓库：`maoyiren/Pixcape`，默认分支 `main`。
- 当前主应用包含 Next.js、NextAuth、Prisma，并保留 Vite 创作工坊构建流程。
- 数据库目标覆盖 PostgreSQL、MySQL 和 SQLite。
- 当前依赖中已有 `skinview3d`，可继续承担 CDPC 内部的 3D 皮肤预览。
- PR #20 正在推进创作者生态基础，但仍是 draft；不可将其描述为已发布。
- 创作者作品、衣柜、皮肤站玩家档案是不同领域对象，不应仅凭相似名称复用同一张表。

### Blessing Skin Server

- 上游仓库：`bs-community/blessing-skin-server`，当前仓库默认分支为 `dev`；实施时必须另行选择并固定经验证的 release/tag，不能直接追随开发分支部署。
- `composer.json` 声明 PHP `^8.1`、Laravel `^10`，并依赖多个 PHP 扩展及 PDO。
- 上游 `composer.json` 声明 MIT 许可；分发或修改时仍须保留许可与版权声明，并单独核对插件及依赖的许可。
- 上游 README 描述的核心用途是皮肤/披风托管、分享与离线模式服务器的皮肤显示，并支持插件及可选的 Yggdrasil 相关接入。
- 该项目与 CDPC 的 Node/Next.js 技术栈不同，独立部署和升级风险更低。

## 3. 产品边界与术语

必须区分以下资产类型：

1. **标准 Minecraft 玩家皮肤**：符合约定尺寸、格式和模型规则的皮肤 PNG。
2. **Blessing 皮肤站纹理资产**：由皮肤服务托管和分发的皮肤、披风等资源。
3. **CDPC 创作作品**：有作者、描述、分类、版本、授权和发布状态的社区内容。
4. **CDPC 装扮/部件资产**：披肩、外套、帽子、上衣、裤子、鞋子、披风等编辑素材；它们不自动等于标准玩家皮肤。
5. **官方账号披风**：不属于 CDPC 导出 PNG 可以创建或替代的内容；页面必须避免暗示与 Mojang/Microsoft 官方账号或服务存在背书关系。

初期仅提供明确的导入、导出、预览和关联，不承诺把任意 CDPC 装扮自动转换成可在游戏中穿戴的资产。转换功能必须经过 UV 映射、尺寸、透明通道、Steve/Alex 模型及实际客户端验证。

## 4. 目标架构

```text
Browser
  └─ cdpc.cc (Next.js / existing auth / Prisma)
       ├─ Creator & Creation APIs
       ├─ Asset metadata and permission checks
       ├─ Blessing adapter (server-side, feature-flagged)
       └─ Skin preview / import-export
                │ HTTPS + scoped server-side credentials
                ▼
       Separate Blessing Skin deployment
       (PHP/Laravel + its own database + own storage)
```

约束：

- 不共享数据库、不直连对方的业务表、不复制密码哈希、不把服务端凭据下发浏览器。
- 不因皮肤服务故障而阻断 CDPC 登录、编辑器、作品浏览或导出。
- 默认关闭远程写入；初版可先使用用户主动上传/下载和管理员验证过的只读信息。
- 外部服务 URL 必须由服务器配置，校验 HTTPS、允许的主机和请求目标，阻止 SSRF、重定向绕过及任意 URL 代理。
- 设置连接超时、响应大小上限、速率限制、审计日志和健康状态；日志不得包含令牌、密码、完整私密 URL 或用户敏感数据。
- 文件上传需要校验真实文件类型、PNG 解码、像素尺寸、大小和透明通道；不能只信任扩展名或客户端 MIME。

## 5. 身份与单点登录策略

阶段一不做自动单点登录，不改变现有 NextAuth 提供商或回调配置。

后续如需要单点登录，先确认固定版本的 Blessing 是否有可维护且受支持的认证扩展点；优先使用标准协议或受审查的插件，不应直接改写上游密码验证流程。建立独立映射记录，例如：

- `cdpcUserId`：CDPC 稳定用户 ID。
- `provider`：皮肤服务标识。
- `externalUserId`：皮肤服务用户 ID。
- `linkedAt`、`status`、`lastVerifiedAt`：绑定状态和审计时间。

绑定必须由已登录用户明确发起并验证控制权；禁止仅按相同邮箱自动合并账号。解绑、封禁、删除及账号恢复流程需要定义一致的行为。管理员权限绝不能从皮肤站普通用户角色自动映射到 CDPC ADMIN。

## 6. 资产与数据映射

初期不新建与现有 `User`、`CreatorProfile`、`Project` 重复的模型。先建立轻量外部资产引用（具体字段须在检查当前 schema 后决定），建议语义包括：

- 内部作品 ID 与版本 ID；
- 资产类型：`PLAYER_SKIN`、`CAPE_TEXTURE`、`CDPC_PART`；
- 外部服务标识及外部资产 ID（可空）；
- 资产来源、作者、授权快照、校验结果；
- MIME、尺寸、内容哈希、存储位置引用；
- 可见性、审核状态、创建与更新时间。

数据库迁移必须分别验证 PostgreSQL、MySQL、SQLite。避免将图片 base64 长期保存到业务表；优先使用受控对象存储或现有文件存储机制。删除外部资产前应先解除引用或留下 tombstone，避免作品详情出现不可解释的断链。

## 7. 分阶段交付

### Phase 0 — 只读审计与隔离部署

- 固定上游 release/tag 和镜像 digest，审查安全公告、依赖、插件、安装文档与许可证。
- 建立独立测试部署、独立数据库、独立存储、独立备份和恢复演练。
- 不接生产用户、不导入真实凭据、不改变 cdpc.cc DNS 或生产容器。
- 产出兼容性矩阵、威胁模型、成本估算和回滚步骤。

### Phase 1 — CDPC 本地皮肤资产体验

- 提供标准皮肤 PNG 导入、校验、预览、下载和编辑器导入。
- 记录来源与授权；保留原文件，生成预览图时不覆盖原件。
- 先支持用户主动导入/导出，不依赖 Blessing API。
- 在界面中清晰区分“玩家皮肤”“CDPC 装扮部件”和“披风纹理”。

### Phase 2 — 可选 Blessing 连接器

- 增加服务器端配置与 feature flag，默认关闭。
- 只实现已核验并有稳定契约的 API；没有官方稳定 API 时，不猜测私有端点，改用明确的人工导入/导出。
- 增加超时、重试上限、权限校验、速率限制、审计和降级状态。
- 在测试站完成读取、上传、删除/解绑和异常处理测试后再开放。

### Phase 3 — 账号链接与游戏端能力（单独审批）

- 评估标准 SSO、Yggdrasil 兼容范围、目标客户端和服务端类型。
- 明确离线模式安全边界、账号冒用风险、封禁同步、数据删除和支持责任。
- 任何认证插件或上游补丁都需要单独维护计划、兼容测试和安全复核。
- 不声称能替代 Mojang/Microsoft 官方认证，也不将外置登录等同官方账号登录。

### Phase 4 — 创作者生态深化

- 将作品版本、授权、审核、下载事件与外部皮肤资产关联。
- 仅在真实需求、版权流程和运维能力验证后再考虑皮肤托管服务商业化。
- 付费授权、退款、作者收益、侵权投诉和地区合规需另立方案，不在初期连接器中引入支付。

## 8. 安全、隐私与版权验收

上线前必须通过：

- SSRF、越权访问、IDOR、CSRF、XSS、文件上传与路径处理检查。
- 外部服务凭据不进入客户端 bundle、公开 API 响应、构建日志或普通应用日志。
- 用户只能访问其有权查看或管理的作品与资产；不能信任客户端传入的 owner ID。
- 文件大小、解码像素数、格式、尺寸、速率及请求超时均有上限。
- 备份恢复演练、外部服务不可用演练、超时/畸形响应/上游升级演练。
- 用户删除、作品下架、账号封禁和解除绑定的行为有文档和审计记录。
- 上游 MIT 版权声明完整保留；逐项检查插件和依赖许可。
- 提供清楚的非官方关联声明、素材授权说明、侵权举报与下架流程。

## 9. 发布门槛与回滚

生产启用前要求：

1. 独立环境构建与部署成功，并固定版本和镜像摘要。
2. 数据库、存储、备份与恢复均验证成功。
3. CDPC CI、Next.js 构建、安全测试、浏览器回归和 Docker 冒烟检查通过。
4. 连接器关闭时，CDPC 主要流程无回归；连接器开启时，授权和失败降级测试通过。
5. 所有环境变量有文档、默认安全值和启动校验；密钥只通过部署密钥管理注入。
6. 明确监控指标、告警责任人、维护窗口与回滚演练。

回滚时先关闭 feature flag，再停止连接器流量；保留必要审计记录，不自动删除用户资产。不要在回滚时直接覆盖或清空任一服务的数据库。

## 10. 当前不做的事情

- 不把 Blessing 的 PHP/Laravel 代码并入 Next.js 进程。
- 不共享 Prisma 与 Blessing 数据库或密码表。
- 不在未经审查的情况下安装第三方认证插件。
- 不直接在生产环境试验上游 `dev` 分支。
- 不宣称账号互通、游戏端兼容或自动装扮转换已实现。
- 不在本计划 PR 中修改生产配置、密钥、DNS、数据库或部署镜像。

## 11. 官方核验入口

- Blessing Skin Server：<https://github.com/bs-community/blessing-skin-server>
- 上游 Composer 依赖与许可证声明：<https://github.com/bs-community/blessing-skin-server/blob/dev/composer.json>
- 上游许可证：<https://github.com/bs-community/blessing-skin-server/blob/dev/LICENSE>
- 上游安装文档：<https://blessing.netlify.app/en/setup.html>

在真正部署时，应以选定 release/tag 的文件和安全公告为准，而不是将上述 `dev` 分支文件视为稳定发布承诺。



---

# 原文：`docs/CDPC-CREATOR-ECOSYSTEM-PLAN.md`

> 原文件 Blob SHA：`ea84a1fd262e43666836e6c1d2b18333867523bc`

# CDPC 创作者生态扩展实施方案

> 状态：PR #20 的产品/技术实施基线；本文定义目标与验收条件，不代表所有功能已上线。  
> 更新日期：2026-10-24  
> 范围：Next.js 主站、现有 Prisma 数据层、Vite 创作工坊、现有登录与管理员后台。

## 1. 产品目标与导航

CDPC 从像素编辑工具逐步扩展为创作、发布、分享、发现和治理平台。保留统一的信息架构，不新增独立账号系统：

- **首页**：精选作品、最新素材、创作入口、社区动态。
- **编辑器 / 创作工坊**：披肩、帽子、上衣、裤子、鞋子、外套、披风的独立模式；2D/3D 编辑、AI 辅助、PNG 导出。仅启用已有真实素材和已验证能力。
- **作品社区**：分类、搜索、标签、作品详情、点赞、收藏、评论、举报。
- **创作者中心**：个人主页、草稿、作品发布与版本、数据统计、授权设置。
- **个人中心**：统一账户资料、登录方式、安全状态、隐私设置。
- **管理员后台**：用户、内容审核、举报/申诉、角色权限、系统配置、审计日志与健康状态。

主导航和页脚继续使用现有共享布局，不创建第二套导航或登录状态。管理员使用同一认证基础，但所有管理操作必须由服务端独立鉴权。

## 2. 账号模型：创作者身份、操作权限、认证状态分离

目标规则：

1. 注册用户自动拥有创作者身份，可开始创作，无需申请“成为创作者”。
2. 创作者身份不等于公开发布权、精选资格、商业售卖资格或管理员权限。
3. 管理员权限只允许通过受控的后台/运维授权流程授予，禁止用户自行提交角色字段。
4. 认证状态独立记录：未申请、审核中、已认证、未通过、受限。受限状态需要原因、时间和操作审计。
5. 登录、OAuth、邮箱验证与创作者资料初始化必须幂等；重复回调、重复注册或重试不能产生重复资料。
6. 不暴露邮箱、OAuth provider ID、内部用户 ID 等私人信息到公开主页。

### 当前代码基线与迁移注意

当前 Prisma schema 已有 `User.role`（USER/CREATOR/ADMIN）、`User.status`、`CreatorProfile`（`reviewStatus`）和 `Project`。在当前 PR #20 分支中，邮箱注册已在事务内创建 `CREATOR` 用户与 `CreatorProfile`，资料初始化使用 `NOT_SUBMITTED`；创作者中心已移除“申请加入创作者计划”作为身份门槛，历史 `USER` 在部分资料更新流程中可升级为 `CREATOR`，并保留 `ADMIN`。这些属于账号/资料基础，不代表社区发布、私有云端草稿、互动、认证或商业权限已完整上线。

建议渐进式迁移：
- 将“创作者身份”从可操作权限中分离，使用明确的身份/能力字段或等价模型；不要继续把一个 `role` 同时当身份、审核状态和权限集合。
- 保留现有 `User.role` 作为兼容层，先盘点所有读写点和 admin guard，再安排数据迁移；迁移期间不得把 ADMIN 降权，也不得给普通用户升级 ADMIN。
- 对历史 USER 账户做幂等的创作者资料补建；保留原有用户 ID、OAuth 关联、会话和项目归属。
- 默认创作者资料可创建/编辑草稿；公开发布能力由单独的服务端权限规则决定。
- 先覆盖 PostgreSQL、MySQL、SQLite 三套 schema/migration 路径，再部署到生产。

## 3. 用户生命周期

### 注册成功
- 创建统一用户记录、稳定用户 ID 和默认创作者资料。
- 默认昵称优先使用用户明确设置的显示名；重复昵称允许存在，公开主页使用稳定 slug/ID 处理路由冲突。
- 初始化必须幂等；失败时注册流程应可重试，并通过日志发现部分成功状态。

### 首次创作
- 可从空白项目、官方模板或导入 PNG 开始。
- 自动保存草稿，清楚显示保存状态、最近更新时间和失败重试。
- 草稿绑定当前登录用户；任何读写都按服务端 session 的 user ID 过滤，不能信任客户端传入的 ownerId。

### 发布作品
作品发布前至少校验：标题、分类、有效预览图/资产引用、描述长度、标签数量与长度、授权选项、内容安全状态和作者权限。发布状态建议包含 DRAFT、PENDING_REVIEW、PUBLISHED、REJECTED、UNLISTED、TAKEN_DOWN、TRASHED 等明确状态；采用项目现有命名规范时可映射，但不能用任意字符串在各页面各自判断。

首次版本优先采用审核后发布或风险分级审核；未经验证的作品不能默认进入首页精选。发布和更新需记录操作者、时间、版本和审核理由。

### 个人主页
- 展示公开昵称、头像、简介、公开作品及真实统计。
- 默认隐藏邮箱、认证凭据和内部状态；私密草稿绝不可通过公开作品 API 返回。
- 关注功能后续再做，不能先展示无后端的假按钮。

## 4. 创作者中心模块

1. **作品管理**：草稿、公开、待审核、未通过、已下架、回收站；搜索、筛选、批量管理、版本更新。
2. **创作资产库**：披肩、帽子、上衣、外套、裤子、鞋子、披风分类；保存原始文件、缩略图、导出文件引用和版本记录。文件存储使用受控对象存储/资产服务，不将大体积 base64 长期塞入数据库。
3. **创作数据**：浏览、下载、收藏、点赞、评论、互动趋势与热门作品。没有真实事件数据时显示空状态，禁止伪造统计。
4. **作者主页**：昵称、头像、简介、公开作品排序与可分享 URL。
5. **授权设置**：每个作品记录授权类型、授权文本/版本、确认时间；修改授权要留下历史记录，不能静默覆盖已授予的旧授权。
6. **状态与帮助**：审核结果、拒绝原因、申诉入口、限制原因及恢复流程。

## 5. 作品社区分阶段交付

### 阶段一：免费作品社区
- 原创作品发布与详情页。
- 分类：披肩、外套、披风、帽子、上衣、裤子、鞋子；名称保持独立，不合并相似品类。
- 搜索、标签、点赞、收藏、评论、举报。
- 作品作者可控制是否允许下载、是否允许二次创作。
- 举报和内容下架流程先于大规模公开发布上线。

### 阶段二：作者成长
- 关注、作品合集、精选推荐、编辑推荐、活动/挑战。
- 作者认证、侵权投诉与申诉。
- 以服务端真实事件计算互动，设置速率限制、幂等键和反刷规则；不可直接信任客户端传来的计数。

### 阶段三：原创素材市场（远期）
在用户需求、版权审核和平台运营能力得到验证前，不启动真实支付。正式交易前另行完成商品/授权 SKU、订单、支付、退款、作者收益与结算、税务/地区合规、争议处理、反欺诈、条款和账务审计设计。不得将普通社区发布误称为已具备售卖能力。

## 6. 管理后台治理

- **用户管理**：搜索、状态、封禁/恢复、会话/登录异常线索。
- **创作者管理**：认证审核、发布限制、解除限制、申诉复核。
- **内容管理**：待审作品、驳回理由、下架/恢复、侵权投诉。
- **举报中心**：分类、证据引用、处理人、处理时间、申诉与复核。
- **推荐管理**：首页精选、分类推荐、活动配置；只推荐有效且可公开的作品。
- **权限管理**：最小权限、服务端检查、重要操作二次确认/审计；管理员角色不能由用户资料表单修改。
- **系统监控**：数据库、邮件、OAuth、AI 服务、存储和异步任务状态；健康检查不泄漏密钥。

每个管理 API 都要在服务端检查 session、账号状态、操作权限和目标资源范围。隐藏按钮只改善体验，不构成安全控制。

## 7. 数据模型方向

先复用现有 `User`、`CreatorProfile`、`Project`、`AuditLog`，确认职责后再扩展；禁止创建与现有模型重复的同义表。

目标实体及关系：

- `User`：统一账号、登录关联和状态。
- `CreatorProfile`：公开资料、主页 slug、认证状态。
- `Project/Creation`：作品主体、分类、作者归属、公开状态、授权下载/二创策略。
- `CreationVersion`：版本号、资产引用、变更说明、创建者和时间。
- `CreationInteraction`：点赞、收藏等幂等互动；浏览/下载等事件可采用独立事件表或分析管道。
- `Comment`：评论/回复、状态、作者与时间。
- `Report`：举报类型、目标、证据、处理状态、处理人、申诉关系。
- `UserRole/Permission` 或等效权限机制：管理员及审核能力的受控分配。
- `LicenseRecord`：授权类型、条款版本、确认时间和历史记录。
- `AuditLog`：审核、封禁、下架、权限变更、授权变更等重要操作。

关系约束：作品只能有一个明确所有者；互动需要唯一约束防止同一用户重复点赞/收藏；版本和授权历史不可被普通更新静默覆盖；删除用户时遵循既定保留/匿名化策略；公开查询必须按发布状态过滤。

## 8. 阶段与验收标准

### 阶段 1：账号与权限基础（优先）
- [ ] 梳理所有注册入口、OAuth 回调、邮箱登录、角色判断、管理员 guard。
- [ ] 设计身份/权限/认证状态迁移，覆盖 PostgreSQL/MySQL/SQLite。
- [ ] 注册和历史账户资料初始化幂等；管理员不被降权。
- [ ] 统一服务端权限函数并加测试：普通用户不能执行管理操作，不能访问他人草稿。
- [ ] 删除创作者身份申请作为前置门槛；认证申请保留为独立可选流程。

**验收：** 新注册用户可进入创作者中心并创建私有草稿；无需身份切换；无法自行获得管理员权限；现有登录和 OAuth 回归通过。

### 阶段 2：创作者中心
- [ ] 草稿箱、作品管理、作者主页、资料编辑。
- [ ] 作品版本、资产引用和真实数据统计的存储方案。
- [ ] 作品状态筛选与空/加载/错误状态。

**验收：** 用户只能读写自己的草稿；统计来自数据库/事件，不展示虚构数字；公开主页不泄露私人资料。

### 阶段 3：发布与社区
- [ ] 作品发布校验与审核状态机。
- [ ] 分类、搜索、标签、详情、点赞、收藏、评论、举报。
- [ ] 管理员审核、下架、申诉、审计日志。

**验收：** 未发布作品不会出现在公开接口；互动幂等；举报可追踪；管理操作有审计记录。

### 阶段 4：编辑器整合
- [ ] 工作台保存到当前用户草稿。
- [ ] 预览、导出与作品发布共享同一资产/版本 ID。
- [ ] 分类和素材 ID 明确传递；不通过显示名称猜路径。
- [ ] 失败可重试，未接入服务端保存前明确标注本地保存边界。

**验收：** 编辑器导入、保存、重新打开、版本更新和 PNG 导出端到端测试通过。

### 阶段 5：成长与商业化
- [ ] 关注、合集、精选、认证、授权管理。
- [ ] 用真实数据验证作者留存与原创素材需求。
- [ ] 在法律条款、支付、退款、结算和争议流程就绪后再开放交易。

**验收：** 所有成长数据可追溯；交易功能有独立安全/合规评审，不影响免费创作和社区基础能力。

## 9. 工程实施要求

- 每次改动先读取实际 schema、actions、API 和迁移文件；先扩展已有职责，不重复建模。
- 保持 root 与 `ai-api` 的依赖边界；数据库变更必须更新所有受支持 provider 的 schema/migration。
- 为注册初始化、权限检查、草稿归属、发布状态、互动幂等、举报审核和管理员授权增加自动化测试。
- 先运行 lint/typecheck/unit tests/Next build/Vite build/Playwright，再运行 Docker 与生产 smoke test。
- PR 和文档要区分“已实现”“正在实施”“规划中”；CI 或生产验证未完成时不得声称已通过或已发布。

## 10. 当前 PR #20 的边界与实施状态

截至 2026-10-24，PR #20 仍为 Draft，尚未合并。当前分支已落实的创作者基础包括：邮箱注册事务内创建 `CREATOR` 用户和默认创作者资料；创作者资料状态默认 `NOT_SUBMITTED`；创作者中心直接编辑公开资料，不要求申请创作者身份；注册页面文案已说明注册后可开始创作；管理员仍通过受控服务端流程获得权限。

仍未完成或尚未验收的部分：
- 注册成功后：未开启邮箱验证时，页面调用邮箱密码 provider 自动登录并跳转 `/workbench`；开启验证时提示用户查收验证邮件，不绕过验证。该流程已通过当前 PR head 的 Next.js 构建/安全工作流，但仍需在生产 OAuth/邮件配置下做部署后验收。
- 将身份、认证状态与细粒度操作权限彻底分离；目前 `User.role` 仍包含 `USER/CREATOR/ADMIN`，需要继续梳理所有授权点。
- 云端私有草稿、作品发布状态机、社区详情、点赞/收藏/评论/举报、版本历史、真实统计和授权记录的完整端到端链路。
- 精选推荐、商业售卖和收益结算等进阶能力；这些不应在未完成合规与支付设计前开放。
- Mantine/Tailwind CSS v4 迁移仍未完成；OAuth 外部 provider 仍需在真实生产凭据与回调配置下验收。

本文是分阶段实施路线，不代表规划功能已经上线。后续先补齐注册后体验和权限边界，再逐步交付创作者中心与社区功能。当前 head `4a5fa0daa9604eec87450a924af09d1bd813b6e0` 的 GitHub Actions CI、Next.js Preview Build/Security Tests 均已通过；Playwright 浏览器测试 5 项通过；Docker smoke-test 已通过，镜像发布 job 因 PR 事件被跳过，未发布新镜像。PR #20 仍为 Draft、未合并。合并前仍需完成剩余功能范围审查与真实 OAuth/部署验收。


## 11. 最新推进记录（2026-10-24 21:52，Asia/Singapore）

- 登录成功后的默认目标已从 `/account` 调整为 `/workbench`，覆盖密码登录、OAuth 登录与邮箱登录链接。
- 注册页已明确：注册即创作者，不需要身份申请/切换；作品当前默认保存在本机，公开发布与商业能力以实际权限开放为准。
- 最新已完成的一组 GitHub Actions（提交 `b60a5c9951bb1d6ff601ebaf3dd286702b6b98f4`）中，CI、Next.js Preview Build/Security Tests、Docker smoke-test 均成功；测试覆盖 PostgreSQL/MySQL/SQLite 迁移与相关安全检查。
- Docker workflow 的 `smoke-test` 成功，但 `publish` job 因 PR 工作流条件被跳过；这不是镜像发布成功，当前未确认发布了新镜像。
- 随后继续修正登录页字段文案：普通账户实际使用注册邮箱登录；配置的管理员使用管理员用户名登录。普通账户昵称目前不是登录标识，页面已避免误导。该文案修改的新提交仍需等待 CI 结果。
- PR #20 仍为 Draft，尚未合并。生产 OAuth、SMTP、cdpc.cc 回调及注册后真实会话仍需部署后验证。


## 12. 管理后台配置与登录入口约束（2026-10-24）

### 登录入口约束
- 普通密码登录、OAuth 登录和邮箱 magic link 默认统一进入 `/workbench`，减少登录后的二次导航。
- 注册成功且不要求邮箱验证时直接进入 `/workbench`；需要验证时先完成验证流程。
- 只有显式传入并经过校验的安全回跳目标才可覆盖默认工作台，不能任意接受外部 URL。
- 不再为这项优化额外增加角色切换、身份选择或多余中转页。

### 管理后台运行配置目标
- 在管理员后台配置可动态读取的 AI 服务商、模型、兼容 API 地址、生成参数和密钥；变更需审计并支持测试连接、启用/停用与回滚。
- API Key 等敏感值必须由服务端加密存储，表单只展示“已配置/未配置”和脱敏摘要；绝不回传完整密钥、写入日志或客户端 bundle。
- 数据库连接、认证签名密钥、加密主密钥等启动基础设施配置仍由部署 Secret 管理，不能允许普通后台表单修改。
- 不能只把值写进 `AppSetting` 就宣称生效：AI 生成服务必须改为读取服务端有效配置（数据库覆盖优先、部署环境变量作为回退），并覆盖所有实际调用路径及测试。
- 当前后台的 AI 服务商卡片仍是占位说明，尚未实现可保存并实际驱动生成服务的动态 AI 配置。完成前不得对外宣称该功能已上线。

### 本轮回归修复
- 浏览器测试此前仍断言旧标签“用户名或邮箱地址”，与统一登录页当前标签不一致，导致浏览器回归测试失败。
- 已将测试断言同步为当前标签“邮箱地址或管理员用户名”；需要等待新提交 CI 再确认通过。


## 12. 管理员 AI 配置与登录入口收敛（2026-10-24）

- 登录、第三方登录和邮箱链接默认进入 `/workbench`；`/workbench` 是创作工坊的稳定路由别名，账户资料仍可从工坊进入 `/account`。
- 主导航中的已登录账户入口改为工作台，减少登录后再次寻找创作入口的步骤。
- 管理后台「配置中心」新增 AI 默认供应商、默认模型、各供应商模型清单、Ark 地址及 API Key 管理。
- API Key 使用 AES-256-GCM 加密后保存在数据库，密钥由服务端 `AUTH_SECRET` 或 `NEXTAUTH_SECRET` 派生；后台不会回显原始密钥。密钥更新、清除和配置修改均写入审计日志。
- AI 服务可通过受共享令牌保护的 `/api/internal/ai-config` 同步后台设置。要启用同步，Web 服务配置 `AI_CONFIG_SYNC_TOKEN`；AI API 服务配置相同令牌和 `AI_CONFIG_URL=https://cdpc.cc/api/internal/ai-config`。这些是一次性部署连接配置，不需要每次修改模型或 Key 时变更环境变量。
- 如果尚未配置 AI 同步令牌，后台保存的设置会留在数据库中，但独立 AI 服务仍使用它自己的环境变量；后台页面会明确提示这一边界。数据库地址、认证密钥和服务间同步令牌仍属于部署级配置。
- 回归测试曾因登录表单可访问标签与测试断言不一致而失败；已统一标签并新增 `/workbench` 路由浏览器测试。最终结果以本轮 CI 为准。


## 13. 登录默认目标与 AI 服务连接（2026-10-24）

- 默认登录成功页面为 `/account`，管理员可在「系统配置中心」选择 `/account`、`/workbench`、`/studio` 或首页；显式传入的合法站内 callback 目标优先。
- AI 模型配置在管理员后台维护。DeepSeek 作为文本模型单独配置（默认模型 ID：`deepseek-chat`），用于文本/提示词任务，不作为图片生成供应商。
- 独立 AI API 服务默认读取 `https://cdpc.cc/api/internal/ai-config`。为启用跨服务同步，仍需在 Web 与 AI API 服务中各配置一次相同的高强度随机 `AI_CONFIG_SYNC_TOKEN`。令牌不是可公开写死的默认值；后台保存模型或 API Key 后，AI 服务会在后续请求的刷新周期内拉取配置。
- 部署时仅需完成一次共享令牌配置；后续日常更换模型或 API Key 无需修改部署环境变量。OAuth Client Secret、SMTP 密码、数据库连接串等必须由部署平台保护的基础设施密钥仍保留在 Secrets 中。



---

# 原文：`docs/CDPC-UI-OVERHAUL-IMPLEMENTATION.md`

> 原文件 Blob SHA：`006c8bda17f78b3ee6fec4fd2cb4c22f405f3a8e`

# CDPC UI 全面升级实施规范

> 状态：实施基线（与 `feat/cdpc-ui-overhaul-dress-up` 分支配套）  
> 更新日期：2026-10-23  
> 目标：统一 Next.js 主站与 Vite 编辑器的体验；不在缺少素材或业务接口时伪造可用能力。

## 1. 交付目标

- 全站导航、页脚、页面宽度、标题层级、按钮语义、空状态、错误状态和移动端行为统一。
- 使用 Mantine 作为通用交互组件基础，Tailwind CSS v4 处理布局与响应式；shadcn/ui 仅在存在明确缺口时按组件引入，不为同一控件同时维护两套实现。
- 独立的「衣服选装」入口，和像素级编辑工作台分开；选装负责浏览、筛选、搭配，工作台负责导入皮肤、贴图编辑、3D 检查和导出。
- 真实预览优先复用项目已有的 `skinview3d`、`ThreeCapePreview`、`PresetStudio` 和素材清单。
- 保留登录、OAuth 回调、数据库、权限、Blockbench 导入协议及 PNG 导出行为，不把 UI 重构与认证重写混在一起。

## 2. 技术职责边界

| 技术 | 职责 | 约束 |
| --- | --- | --- |
| Mantine | 表单、弹窗、抽屉、通知、菜单、分页、可访问性基础 | 先选定主题和 token；避免全站默认样式覆盖 |
| Tailwind CSS v4 | 网格、间距、断点、布局、状态样式 | 使用 v4 CSS-first 配置；不照搬 v3 的 `@tailwind base/components/utilities` 配置 |
| shadcn/ui | 少量 Mantine 无法满足且可维护的组件 | 组件源代码归项目维护；禁止无理由重复造 Dialog、Select、Tooltip |
| Lucide React | 图标 | 同一功能不混用字符图标与图标库 |
| React Hook Form + Zod | 复杂表单与校验 | 保留现有服务端验证，客户端校验不是安全边界 |
| skinview3d | 角色 3D 预览 | 只使用真实皮肤/贴图；加载失败必须显示错误与重试 |
| Playwright | 主流程回归 | 桌面与移动端均验证；认证测试使用受控测试账号 |

### 安装策略

仓库是双入口：Next.js 主站和 Vite 编辑器；另有独立 `ai-api`。当前 root package 使用 npm lockfile，`ai-api` 也有自己的依赖边界。依赖安装必须在 root 对应工作目录完成，并提交对应锁文件；不得手工伪造锁文件，不得把主站依赖写入 `ai-api`。

推荐分阶段加入：
1. Tailwind CSS v4 与兼容的 PostCSS/Vite 或 Next 集成，按入口分别验证。
2. Mantine core/hooks 与 Emotion 依赖，先在一个隔离页面验证主题、SSR 与 hydration。
3. shadcn/ui 初始化配置及按需组件；不得把 shadcn 的全局 reset 与 Mantine reset 叠加造成全站样式回归。
4. 锁文件、Docker build、Next build、Vite build 全部通过后再扩大迁移范围。

**禁止一次性把 Mantine 与 shadcn/ui 全量铺满所有页面。** 两者在弹窗、下拉、提示、表单等领域重叠，必须遵循单一组件所有权。

## 3. 全站信息架构

主导航建议：
- 首页
- 衣服选装
- 创作工坊
- AI 皮肤
- 创作者中心
- 账户入口（未登录显示登录/注册，已登录显示账户菜单）

页脚统一包含：衣服选装、创作工坊、创作者中心、账户、隐私/条款（页面存在后再显示）、非官方项目声明。

页面级布局统一：页面标题与一句说明、主要操作区、内容区、帮助/错误提示。不要每页再造一套顶部导航。移动端导航使用可访问的菜单按钮与抽屉，支持键盘焦点、Escape 关闭和明确的 aria-label。

## 4. 衣服选装：职责和行为

### 分类
- 上衣
- 外套
- 裤子
- 鞋子
- 帽子
- 披肩
- 披风

「披肩」「外套」「披风」是三个独立分类，不得在 UI 或数据模型里合并。分类可有「全部」筛选，但「全部」不是素材类型。

### 页面区域
1. 素材侧栏：搜索、分类、筛选、排序、素材卡片、加载/空/错误状态。
2. 角色预览：真实 skinview3d 模型、Steve/Alex、前后/旋转、背景、动作控制；WebGL 不可用时给出降级说明。
3. 穿搭清单：每个可叠加槽位的当前选择、移除、清空、冲突提示。
4. 操作区：保存穿搭、加载穿搭、随机搭配、发送到工作台、导出。只有对应 API/数据通路实现并测试后才显示为启用状态。

### 选择规则
- 每个分类的单选槽位只能存在一个当前项；未来支持可叠加饰品时，应显式定义 stackable，而不是靠 UI 猜测。
- 搜索和切换分类不能清空已选素材。
- 清空操作需要可撤销或确认（素材选择清空不影响用户已保存的穿搭）。
- 刷新页面是否保留选择由明确的本地草稿/账号保存策略决定；未接入存储前不显示“已保存”。
- 素材数据必须来自正式 catalog；素材缺失时显示不可用原因，不能用硬编码占位素材冒充真实资产。

### 现有素材映射（第一阶段）
当前 `PresetStudio` 的已知正式预设包括眼眸花、MCC、苦力怕、TikTok、Twitch 的披肩，以及苦力怕、TikTok、Twitch 外套；披风列表包括眼眸花、MCC、苦力怕、TikTok、Twitch。应先复用这份 catalog 和其贴图合成逻辑。
目前尚不能据已读取的代码确认有完整的上衣、裤子、鞋子和帽子 PNG catalog。没有可用资产时显示「素材准备中」，不得伪造一键试穿能力。

## 5. 创作工坊与导出

创作工坊继续承担：
- 导入标准 64×64 PNG 皮肤并验证尺寸/格式；
- Steve / Alex 模型切换；
- 披肩、外套、披风的素材选择与贴图合成；
- 真实 3D 预览、动作切换、背景选择；
- 导出前检查并下载 PNG；
- Blockbench 导入/发送工作流及成功/失败反馈。

衣服选装和创作工坊之间传递明确的数据结构（skin、modelType、各分类 asset id、语言），禁止只通过显示名称拼接猜测素材路径。跨应用通信应验证 origin、source 和消息 schema；任何导入失败都要可见且可重试。

## 6. 组件与设计 token

- 颜色：语义 token（background、surface、text、muted、border、primary、danger、success），不要在页面内散落硬编码色值。
- 间距：以 4px 为基础步长；卡片内边距、网格 gap、标题间距统一。
- 圆角与阴影：建立少量层级，不要同页混用像素风厚边框、玻璃拟态和默认组件圆角。
- 状态：hover、focus-visible、active、disabled、loading 均有明确样式；颜色不能作为唯一状态指示。
- 可访问性：语义 HTML、表单 label、键盘操作、可见焦点、合理对比度、aria-live 仅用于动态反馈。
- 响应式：宽屏三栏；平板两栏并将穿搭摘要移至下方/抽屉；手机单栏，预览优先，素材分类横向滚动或抽屉，触控目标至少 44px。

## 7. 安全与兼容性

- 不修改 OAuth provider 配置、回调 URL、数据库 schema、会话策略或角色权限作为 UI 迁移的一部分。
- 外部图片加载失败、CORS 受限或 WebGL 不可用时必须可恢复；导出前检测画布是否 tainted。
- 用户上传的皮肤只在用户明确操作后处理；不得自动上传到第三方服务。
- 所有保存、导出和权限相关操作必须在服务端重新验证，不能依赖隐藏按钮。
- 版权与 Minecraft 非官方声明在全站统一呈现。

## 8. 分阶段实施顺序

### 阶段 A — 基础设施
- [ ] 检查 root 与 ai-api 的 package manager、Node 版本和锁文件。
- [ ] 加入 Tailwind v4 并在 Next 与 Vite 两入口分别验证。
- [ ] 引入 Mantine，验证 Next SSR/hydration 与 Vite 样式隔离。
- [ ] 配置 shadcn/ui 的组件所有权与按需安装策略。
- [ ] 建立 token、Button、Input、Card、Dialog、Toast 等最小组件基线。

### 阶段 B — 衣服选装
- [ ] 从 PresetStudio 提取共享 catalog 和稳定 asset id。
- [ ] 复用贴图加载/合成逻辑，接入真实 skinview3d。
- [ ] 实现导入皮肤、Steve/Alex、旋转/缩放、动作和背景。
- [ ] 实现分类筛选、单槽位选择、移除、清空和错误恢复。
- [ ] 缺少资产的分类明确显示空状态；待真实素材交付后再启用。
- [ ] 定义穿搭 JSON schema 与本地草稿；账号保存需另行接后端。

### 阶段 C — 全站迁移
- [ ] 导航、页脚、首页与账户页面统一。
- [ ] 登录/注册、创作者中心、管理后台逐页迁移。
- [ ] 保持 URL、表单字段、API 合约和权限行为不变。
- [ ] 清理重复 CSS 与旧组件；每迁移一页执行视觉和功能回归。

### 阶段 D — 验证与发布
- [ ] `npm ci`
- [ ] `npm run build`（Vite/Blockbench）
- [ ] `npm run next:build`
- [ ] `npm test` 与相关 Playwright 测试
- [ ] 桌面/手机导航、选装、导入、导出、登录、OAuth 回归。
- [ ] Docker build 与容器启动健康检查。
- [ ] CI 全绿后再合并；只有镜像构建/发布 workflow 成功，才能宣称新镜像已发布。

## 9. 验收标准

1. 所有页面使用统一导航和页脚，移动端无横向溢出。
2. 选装页不再用 CSS 假人冒充真实 3D；无法初始化时明确说明。
3. 选择素材后真实预览更新，披肩、外套、披风的类型和贴图不混淆。
4. 未实现的素材、保存、随机、导出功能不显示成已可用操作。
5. OAuth、登录注册、Blockbench 导入、PNG 导出回归通过。
6. npm 锁文件一致，CI、Next、Vite、Docker 验证通过。
7. 页面支持键盘操作、可见焦点、错误反馈与加载反馈。



---

# 原文：`docs/DEPLOYMENT.md`

> 原文件 Blob SHA：`8217e7dd6eac55fb2c531b083ba0280e7e163567`

# 部署文档入口

本文件保留为便于查找的部署入口，避免维护重复的部署说明。

- **当前单镜像部署、环境变量、数据库选择与路由：** [SINGLE-IMAGE-PRODUCTION.md](./SINGLE-IMAGE-PRODUCTION.md)
- **独立 Next.js 容器部署（仅在确实使用 Dockerfile.nextjs 时）：** [NEXTJS-CONTAINER-DEPLOYMENT.md](./NEXTJS-CONTAINER-DEPLOYMENT.md)
- **生产迁移、备份、安全检查和回滚：** [PRODUCTION-SECURITY-ROLLOUT.md](./PRODUCTION-SECURITY-ROLLOUT.md)

旧部署说明中有关“纯 Vite 静态站点”的部分不再作为当前生产架构依据。发布状态和多数据库兼容性必须通过当前提交的工作流与真实部署验证，不能只凭文档判断。



---

# 原文：`docs/DEVELOPMENT.md`

> 原文件 Blob SHA：`a6777e888eb7d6c1b5395ed1c8d0251891ebb71c`

# 开发环境与贡献指南

## 1. 技术栈

- React 18
- TypeScript 5.6
- Vite 6
- lucide-react 图标库
- Canvas 2D API
- Docker + Nginx
- GitHub Actions 与 GitHub Container Registry（GHCR）

## 2. 环境要求

建议安装受支持的 Node.js LTS 版本和 npm。Docker 不是本地前端开发的必需条件，但构建容器镜像和验证生产环境时需要 Docker。

## 3. 本地启动

在仓库根目录执行：

```bash
npm install
npm run dev
```

Vite 开发服务器会监听可访问地址。终端会显示本机 URL；如在容器或局域网内测试，应使用终端输出的可访问地址。

## 4. 构建与预览

```bash
npm run build
npm run preview
```

构建命令先执行 TypeScript 项目检查，再生成 Vite 生产文件到 `dist/`。提交前应确认构建成功。

## 5. 主要目录

```text
.
├── .github/workflows/   # CI 与镜像发布工作流
├── docs/               # 项目文档（唯一规范目录）
├── src/
│   ├── App.tsx         # 编辑器交互与像素数据逻辑
│   ├── main.tsx        # React 应用入口
│   └── styles.css      # 工作区样式
├── Dockerfile          # 单镜像生产构建入口
├── nginx.conf          # Nginx 配置
├── docker-compose.yml  # 本地容器运行
├── package.json        # 依赖与脚本
└── vite.config.ts      # Vite 配置
```

## 6. 修改建议

- 保持组件与交互逻辑清晰，避免将不相关的功能耦合在一起。
- 像素数组与 Canvas 渲染应保持一致；涉及绘制操作时测试鼠标/触控指针事件。
- 新增工具时同步更新工具类型、操作逻辑、快捷键和 `docs/USER_GUIDE.md`。
- 修改导入或导出逻辑时，测试透明像素、边缘尺寸与异常文件情况。
- 避免把秘密、访问令牌、私钥或生产凭据提交到 Git。
- 保持 Docker 生产阶段通过 Nginx 提供静态文件，不要将开发服务器当作生产服务。

## 7. 提交前检查

```bash
npm install
npm run build
```

如果修改了容器配置，建议额外执行：

```bash
docker compose up --build -d
```

然后打开本地映射端口测试页面，并在完成后执行：

```bash
docker compose down
```

## 8. Pull Request / 代码审查

提交说明应概括变更内容。PR 描述建议包含：

- 修改目的和主要变更；
- 手动测试步骤及结果；
- UI 修改的截图（如适用）；
- 对文档、Docker、CI 或部署配置的影响。



---

# 原文：`docs/NEXTJS-CONTAINER-DEPLOYMENT.md`

> 原文件 Blob SHA：`5ba4222d1f1d12a923a73a25ba6d924ba6dda38a`

# Next.js 独立容器部署与环境变量指南

更新日期：2026-10-17

## 1. 先确认部署的是哪一个服务

本仓库有两套独立应用入口，环境变量不能混为一谈：

- 根目录 `Dockerfile`：现有 Vite + Nginx 主站，包含 `/blockbench/`。
- `Dockerfile.nextjs`：Next.js Node.js 服务，容器端口为 `3000`，用于账户、创作者和管理员功能。

如果部署现有主站，不要因为 Next.js 文档而改用 `Dockerfile.nextjs`。如果部署账户系统，才选择 `Dockerfile.nextjs`。两者分别配置域名、变量、数据库和健康检查。

## 2. Next.js 必需环境变量

在 Zeabur、Vercel 或其他平台的服务设置中添加以下变量。值请在目标平台的 Secret / Environment Variables 页面填写，不要提交真实值到 Git。

| 变量 | 必需 | 示例 / 默认值 | 用途 |
| --- | --- | --- | --- |
| `DATABASE_PROVIDER` | 是 | `postgresql` | 选择 `postgresql`、`mysql` 或 `sqlite`，必须与构建时选择的 schema/provider 一致 |
| `DATABASE_URL` | 是 | 见数据库章节 | 数据库连接串；密码应 URL 编码，数据库账号遵循最小权限 |
| `NEXTAUTH_SECRET` | 是 | 随机高熵密钥 | NextAuth 会话/令牌签名密钥；生产环境不得使用示例值 |
| `NEXTAUTH_URL` | 是 | `https://你的账户服务域名` | NextAuth 服务的公开根 URL，必须与真实部署域名一致 |
| `AUTH_GITHUB_ID` | 使用 GitHub 登录时必需 | GitHub OAuth Client ID | GitHub OAuth 应用的 Client ID |
| `AUTH_GITHUB_SECRET` | 使用 GitHub 登录时必需 | GitHub OAuth Client Secret | GitHub OAuth 应用的密钥，只放服务端 Secret |
| `LOGIN_RATE_LIMIT_MAX` | 否 | `10` | 每个 IP 在限流窗口内允许的登录尝试次数 |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | 否 | `900` | 登录限流窗口秒数；默认 15 分钟 |
| `LOGIN_RATE_LIMIT_IP_HEADER` | 否 | `x-real-ip` | 从可信反向代理读取客户端 IP 的请求头；仅当代理会覆盖此头时使用 |
| `BOOTSTRAP_ADMIN_EMAIL` | 仅初始化管理员时 | 不设置 | 一次性管理员引导命令所使用的确切邮箱；完成后必须删除 |

`NODE_ENV` 由生产镜像/运行环境设置为 `production`。不要将 `NEXTAUTH_SECRET`、`AUTH_GITHUB_SECRET` 或数据库密码设置成 `NEXT_PUBLIC_*` 变量。不要把 Secret 放进 Docker build args、前端代码、日志或聊天消息。

生成随机密钥示例（在自己的终端运行；不要把生成结果发到聊天中）：

```bash
openssl rand -base64 32
```

将命令输出作为 `NEXTAUTH_SECRET` 的值。

## 3. 数据库连接配置

每个部署环境只选择一种数据库。下面的 URL 是占位示例，必须替换用户名、密码、主机、端口和数据库名。

| 数据库 | `DATABASE_PROVIDER` | `DATABASE_URL` 示例 | Prisma schema | 迁移目录 |
| --- | --- | --- | --- | --- |
| PostgreSQL | `postgresql` | `postgresql://USER:PASSWORD@HOST:5432/pixcape?schema=public` | `prisma/schema.prisma` | `prisma/migrations/` |
| MySQL / MariaDB | `mysql` | `mysql://USER:PASSWORD@HOST:3306/pixcape` | `prisma/schema.mysql.prisma` | `prisma/migrations-mysql/` |
| SQLite | `sqlite` | `file:/data/pixcape.db` | `prisma/schema.sqlite.prisma` | `prisma/migrations-sqlite/` |

切换数据库 provider 后，必须按对应 schema 重新生成 Prisma Client 并重新构建镜像。不能将一种数据库的生成客户端或迁移用于另一种数据库。

SQLite 仅建议单实例、单副本部署。必须将容器 `/data` 挂载到持久化卷，否则容器重建可能丢失数据库文件；多副本或较高写入量场景优先使用 PostgreSQL 或 MySQL/MariaDB。

## 4. GitHub OAuth 配置

1. 在 GitHub Developer Settings 中创建 OAuth App。
2. Homepage URL 填账户服务的公开 HTTPS 根 URL。
3. Authorization callback URL 填：

```text
https://你的账户服务域名/api/auth/callback/github
```

4. 将 OAuth App 的 Client ID 写入 `AUTH_GITHUB_ID`，将 Client Secret 写入 `AUTH_GITHUB_SECRET`。
5. 将 `NEXTAUTH_URL` 设置为同一个账户服务根 URL；不要加上 callback 路径。
6. 部署后测试登录、回调和退出。预览域名和生产域名不同的话，应分别确认 OAuth App 的回调配置。

当前认证配置在未提供 GitHub OAuth ID 和 Secret 时不会注册 GitHub 登录提供方，因此登录功能不会正常可用。

## 5. Zeabur / Vercel Docker 部署步骤

1. 创建独立的 Next.js 预览服务，并选择包含对应代码的提交。
2. Docker 部署时指定仓库根目录下的 `Dockerfile.nextjs`，容器端口设置为 `3000`。
3. 创建隔离的预览数据库，按上表设置 `DATABASE_PROVIDER` 和 `DATABASE_URL`。
4. 在服务的 Variables / Environment Variables / Secrets 设置页逐项添加本节必需变量及需要的可选变量。变量名必须完全一致；修改后按平台要求重新部署。
5. 添加 GitHub OAuth 变量和匹配的 callback URL。
6. 先检查当前提交、数据库 provider 和迁移状态；确认目标数据库与备份策略后，才执行迁移。
7. 验证反向代理会覆盖 `x-real-ip`（或你配置的可信头）。若无法确认代理信任边界，不要把依赖 IP 限流的登录端点直接暴露到公网。
8. 检查健康状态、登录/OAuth 回调、退出、创作者流程、管理员审核/封禁及资源所有权。
9. 生产迁移前先备份数据库，并由维护者明确批准。预览构建成功不等于生产环境已部署或通过安全验收。

## 6. 迁移与初始化管理员

数据库 schema 变更需要使用与 provider 匹配的迁移目录。不要在生产启动时未经审查就自动执行开发迁移。

示例命令（请在有正确环境变量、且指向目标数据库的受控环境执行）：

```bash
# PostgreSQL
DATABASE_PROVIDER=postgresql npm run db:generate
DATABASE_PROVIDER=postgresql npm run db:migrate

# MySQL / MariaDB
DATABASE_PROVIDER=mysql DATABASE_URL='mysql://USER:PASSWORD@HOST:3306/pixcape' npm run db:generate
DATABASE_PROVIDER=mysql DATABASE_URL='mysql://USER:PASSWORD@HOST:3306/pixcape' npm run db:migrate

# SQLite
DATABASE_PROVIDER=sqlite DATABASE_URL='file:/data/pixcape.db' npm run db:generate
DATABASE_PROVIDER=sqlite DATABASE_URL='file:/data/pixcape.db' npm run db:migrate
```

管理员引导仅在受控环境进行：先使用目标邮箱完成 OAuth 登录，然后短暂设置 `BOOTSTRAP_ADMIN_EMAIL` 为该确切邮箱，并运行 `npm run db:bootstrap-admin`。确认成功后立即删除该变量，禁止长期保留或公开管理员引导开关。

## 7. 根目录 `.env.example` 与本地开发

仓库的 `.env.example` 可作为本地开发模板。复制为 `.env.local` 后再填写自己的值；不要把真实的 `.env.local` 提交到仓库。

```bash
cp .env.example .env.local
```

示例文件中的占位数据库凭据、随机密钥提示和空 OAuth 值不能直接用于生产。主站 Vite 环境变量与 Next.js 服务端环境变量应分别管理；不要假设为主站配置的变量会自动传入另一个服务。

## 8. 验收边界

- CI 或镜像构建成功不代表已在 Zeabur/Vercel 完成真实部署。
- 一个数据库 provider 的测试通过，不代表其他 provider 也通过。
- 生产 OAuth 凭据、Secret、代理头、域名、持久化卷、数据库迁移和回滚方案必须在真实环境单独验证。
- 保持根目录 `Dockerfile` 与现有主站入口不变，直到 Next.js 预览、迁移、安全测试和生产切换均经过单独审批。



---

# 原文：`docs/NEXTJS-USER-ROLES-MIGRATION.md`

> 原文件 Blob SHA：`dbf926d19fc96d10d7db3f2f3bbca15d3e9ae7dc`

# Next.js 与用户 / 创作者 / 管理员系统迁移方案

## 当前进度（更新于 2026-10-16）

- [x] 创建隔离迁移分支，保留现有 Vite 生产入口。
- [x] 增加 Next.js App Router 页面骨架：主页、登录、注册、账户、创作者、管理员入口。
- [x] 增加 Prisma PostgreSQL 数据模型草案：用户、角色、创作者资料、项目、审计日志及 Auth.js Adapter 表。
- [x] 增加服务端授权原语与环境变量示例。
- [x] 增加独立 Next.js 构建工作流。
- [x] 接入 Auth.js 数据库会话与条件启用的 GitHub OAuth provider（仍需部署端密钥和数据库）。
- [x] 为 Auth.js 数据库会话设置 8 小时最长有效期、1 小时更新间隔，并在生产环境使用安全 Cookie。
- [x] 增加 PostgreSQL / MySQL provider 选择、独立 Prisma schema 与独立迁移目录，并适配两种数据库的 Prisma driver adapter。
- [x] 为 MySQL 增加初始迁移及并发登录限流集成测试；实际 CI 结果仍需等待本次双数据库工作流完成。
- [x] 添加基础 HTTP 安全响应头，生产环境启用当前主机的 HSTS（不默认覆盖其他子域名）。
- [x] 管理员审核和封禁操作加入条件更新，降低并发重复审核和状态竞争风险。
- [x] 封禁用户时删除其数据库会话并记录审计日志。
- [x] 建立独立的登录限流增量迁移，避免修改可能已执行过的初始 migration。
- [x] 增加 PostgreSQL 持久化限流，按可信反向代理提供的 IP 标识做原子固定窗口计数；默认每 IP 每 15 分钟 10 次，数据库不可用时认证入口失败关闭。
- [x] 增加 Node.js 内置测试运行器的 RBAC / 资源所有权单元测试、PostgreSQL 集成测试和 HTTP 安全 E2E 测试。
- [x] CI 使用真实 PostgreSQL 服务执行 migrate deploy、RBAC/所有权测试、并发限流测试、Vite/Next 构建与 E2E。
- [x] GitHub Actions Run #92（基线验证）与 Run #96（当时验证）：PostgreSQL 迁移、RBAC / 资源所有权单元测试、PostgreSQL 集成测试、Vite / Next.js 构建和 HTTP 安全 E2E 全部通过。
- [x] PR Run #97 暴露 PostgreSQL 时间戳精度边界问题，可能使 Retry-After 超过 900 秒；已在 `lib/login-rate-limit-store.ts` 中将返回值限制在 `1..windowSeconds`。修复后 Preview Security Run #99 全部通过，包括 PostgreSQL 迁移、RBAC/所有权测试、PostgreSQL 集成测试、Vite/Next.js 构建和 HTTP 安全 E2E。
- [ ] 配置 GitHub OAuth 与数据库后端，完成真实登录、会话撤销、审核和封禁端到端测试。
- [x] 增加 RBAC / 资源所有权自动化测试与安全回归测试。
- [x] 将构建运行时切换为 Node.js 24 LTS，并更新 GitHub Actions checkout/setup-node 到稳定主版本。
- [x] 将 Next.js、React、Vite、TypeScript、skinview3d、Three.js、Radix UI、Lucide、PWA 插件和 PostgreSQL 驱动升级到已发布稳定版本。
- [x] 将 Prisma 升级到 7.10 稳定版，增加 prisma.config.ts 与 PostgreSQL driver adapter；需由 CI 验证生成、schema 与构建兼容性。
- [x] 将 NextAuth 从 v5 beta API 迁移到稳定版 v4.24.15，并调整 App Router 会话与退出登录代码。
- [x] 最新 CI Run #247 全部通过：现有 Vite 构建、npm 高危/严重漏洞门禁与完整 Docker 镜像构建。
- [x] 最新 CodeQL Run #72 成功完成静态分析；SARIF 作为 artifact 保存。该方式不向 GitHub Security 页面上传告警，若需要 Security 页面告警，仍需为私有仓库启用 GitHub Code Security。
- [ ] 完成 Next.js 与现有 Vite / Blockbench 的整合、Docker 预览和回归验证。

## 技术路线

Next.js App Router + TypeScript、Auth.js、Prisma；数据库可通过 `DATABASE_PROVIDER=postgresql`（默认）或 `DATABASE_PROVIDER=mysql` 选择。两种数据库分别使用 `prisma/schema.prisma` / `prisma/schema.mysql.prisma` 及各自迁移目录，不能交叉应用迁移。部署仍需保证现有 `/blockbench/` 静态编辑器路径可访问。新 Next.js 入口在完成测试之前不替换当前 Vite 生产入口。

## 角色与权限

角色为 `USER`、`CREATOR`、`ADMIN`。新用户必须默认是 `USER`；创作者由申请和审核流程授予；管理员只能通过受保护的管理操作或一次性受控初始化流程授予。角色来源必须是服务端验证的会话与数据库记录，不可信任客户端传入的 role。

| 能力 | 游客 | 普通用户 | 创作者 | 管理员 |
| --- | --- | --- | --- | --- |
| 浏览公开作品 | 是 | 是 | 是 | 是 |
| 保存个人作品 | 否 | 是 | 是 | 是 |
| 发布创作者作品 | 否 | 否 | 是 | 是 |
| 管理用户与审核作品 | 否 | 否 | 否 | 是 |

## 安全要求

- 默认拒绝访问；每个 Server Action / Route Handler 都必须校验会话、角色和资源所有权。
- 管理操作写入审计日志；封禁用户后删除现存数据库会话，并在每次敏感操作时重新读取角色和状态。
- 密钥只通过部署平台 Secret 或本地未提交的环境文件提供；不得提交真实 OAuth 密钥或数据库凭据。
- 生产环境只在确认 HTTPS 后启用 HSTS；部署到多子域名环境前单独核对 HTTPS 覆盖情况。
- 安全响应头是纵深防御，不替代输入校验、CSRF/Origin 检查、限流、资源所有权检查和安全测试。
- 不在认证和数据库尚未接通时声称登录或角色授权已经生效。

## 验收清单

1. 现有 `npm run build` 仍然通过。
2. `npm run next:build` 通过，页面可打开并刷新。
3. 游客访问受限资源得到登录引导；普通用户不能进入创作者写操作或管理员写操作。
4. 并发重复审核只能成功一次；非管理员无法修改用户状态；封禁后原数据库会话失效。
5. 创作者只能编辑自己的项目；管理员操作有审计记录。
6. 验证皮肤 PNG 导入导出、skinview3d 预览、Blockbench 深层路径、PWA 缓存和 Docker 镜像。

> PostgreSQL 的登录限流和安全测试已有通过的 CI 记录。MySQL provider、独立迁移和并发限流测试现已加入工作流，但必须等待新的 MySQL 服务迁移、集成测试和双镜像构建全部通过后，才能称为已验证兼容。CI 使用的是临时数据库，不是生产数据库。OAuth 真实提供商登录、生产数据库迁移、生产反向代理 IP 头配置，以及生产部署后的 Blockbench/PWA 回归仍需真实环境验证。未完成这些验证前，不应切换生产入口。



---

# 原文：`docs/PRODUCTION-SECURITY-ROLLOUT.md`

> 原文件 Blob SHA：`ea10b6deb971cb0de3b7a4f18a56c5be43acfac9`

# Pixcape 生产安全上线操作手册

更新日期：2026-10-17

> 本文是生产执行清单，不代表已访问或修改生产数据库。PR #16 已合并到 `main`，但代码合并和 CI 通过不等于生产环境已迁移或已启用 Next.js 服务。现有主站入口仍由根目录 `Dockerfile` 提供 Vite 静态应用与 `/blockbench/`；不要未经单独验收就切换生产入口。

## 当前架构

- 根目录 `Dockerfile`：现有 Vite + Nginx 主站，包含 Blockbench Web 资源。
- `Dockerfile.nextjs`：独立账户服务，容器端口 3000。
- 数据库 provider：PostgreSQL、MySQL/MariaDB、SQLite；每种数据库有独立 schema 和迁移历史。
- 部署指南：[Next.js 独立容器部署](./NEXTJS-CONTAINER-DEPLOYMENT.md)。

## 上线前必须满足

- [ ] 创建隔离的预览数据库和最小权限数据库用户。
- [ ] 在部署平台 Secret 中设置 `DATABASE_URL`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`。
- [ ] GitHub OAuth 回调地址与预览 HTTPS 域名完全一致。
- [ ] 独立 Next.js 服务健康检查通过；根目录生产入口保持不变。
- [ ] 登录限流所使用的 IP 头由可信代理/CDN 覆盖，不能允许客户端伪造。未确认前不要向公网开放登录。
- [ ] 对当前发布提交运行自动化测试、依赖漏洞检查和镜像构建，并保存运行链接/结果。
- [ ] 按当前安全工作流要求检查 CodeQL/SARIF 结果；不要仅凭 workflow 名称宣称已启用 GitHub Code Scanning。

## 数据库迁移（必须手动批准）

1. 确认目标数据库实例、数据库名称、迁移身份和备份位置。
2. 使用数据库托管平台创建可恢复备份，记录备份 ID、时间与恢复方式。
3. 使用与发布提交一致的代码和 Secret 检查迁移状态：`npx prisma migrate status`。
4. 操作者再次确认目标库与备份后，执行一次 `npx prisma migrate deploy`。
5. 再次检查迁移状态，并核对 `_prisma_migrations`、表、索引和外键。
6. 迁移成功且烟雾测试通过后才考虑切换流量。失败时停止发布并按托管平台恢复流程处理；不要删除迁移记录或在生产运行 `migrate reset`。

不要将迁移命令放入每个应用副本的启动命令中。

## 上线后安全与功能烟雾测试

- [ ] 未登录访问 `/account`、`/creator`、`/admin` 均被拒绝或重定向到登录。
- [ ] GitHub OAuth 登录、回调、退出和数据库会话创建/删除正常。
- [ ] 超过登录限额返回 HTTP 429、正数 `Retry-After` 与 `Cache-Control: no-store`。
- [ ] 限流数据库故障时认证入口失败关闭，不得绕过限流。
- [ ] 普通用户无法执行管理员操作；创作者不能读取或修改其他用户的私有资源。
- [ ] 账号封禁后，旧会话不能继续访问受保护页面或执行写操作。
- [ ] 管理员审核/封禁产生审计日志；并发重复审核仅允许一次有效状态转换。
- [ ] 主站皮肤 PNG 导入/导出、3D 预览、`/blockbench/`、PWA 缓存与健康检查仍正常。

## 自动化验证状态

仓库记录显示，截至 2026-10-17，PR #16 合并前的安全工作流已对 PostgreSQL、MySQL 和 SQLite 的 schema/migration、数据库限流并发、RBAC/资源所有权、集成测试、Vite/Next.js 构建、独立 Next.js 镜像构建和 HTTP 安全 E2E 进行检查；另有主站构建、依赖漏洞门禁、包含 Blockbench 的 Docker 构建与 CodeQL 分析记录。请在发布时针对当前 `main` 提交重新核对对应 workflow run，不能把旧提交的成功结果自动视为当前提交结果。

自动化结果不代表真实生产 OAuth、生产代理配置、部署平台 Secret、生产数据库迁移或生产域名验收已经完成。

## 上线记录模板

每次发布至少记录：

- 发布提交 SHA 与镜像标签：
- 预览环境 / 生产环境：
- 数据库 provider 与迁移状态（不得记录密码或完整连接串）：
- CI / 安全工作流链接：
- OAuth 与可信代理验证结果：
- 备份标识与恢复验证：
- 烟雾测试结果：
- 执行人、时间与回滚决定：

在真实环境证据补齐前，保持现有生产入口不变。



---

# 原文：`docs/PROJECT-MASTER-TECHNICAL-DOCUMENT.md`

> 原文件 Blob SHA：`92c36f084e8b000fc1ba0d736da20ab2182a816a`

# CDPC / Pixcape 项目总技术与文档总纲

- **文档版本：** V1.0
- **整理日期：** 2026-10-25
- **主仓库：** https://github.com/maoyiren/Pixcape
- **产品域名目标：** https://cdpc.cc
- **用途：** 将产品目标、技术架构、功能规格、认证与数据库、部署运维、UI 重构、测试、安全、合规和待办事项汇总为单一主参考文档。
- **重要边界：** 本文是项目主索引与技术总纲，不替代代码、环境变量、迁移文件和具体运行日志。所有功能状态区分“代码/文档已记录”“需要部署配置”“尚待最新 CI 或生产验证”。不得把规划写成已上线事实。

---

## 1. 项目定位与产品原则

CDPC（仓库历史名称 Pixcape）是面向 Minecraft 角色皮肤、像素服装与配饰设计、搭配预览、创作管理和原创内容分享的平台。它首先是一个创作工具与素材平台，不是单纯的 AI 图片展示站。

核心产品能力：
1. 皮肤/服装贴图导入、像素编辑、预制合成和 PNG 导出。
2. Steve / Alex 角色及服装的 3D 预览。
3. 独立的衣橱选装流程：单件试穿、整套搭配、保存、继续编辑和适用格式导出。
4. AI 文本生成与参考图转换，具体模型以服务端真实配置为准。
5. 个人作品、创作者资料、素材发现与社区发布能力。
6. 统一的登录、角色权限、管理员配置、审计与健康检查能力。

产品术语必须准确：
- **披肩、外套、披风**是三个不同类别，不能在 UI、数据模型、预览、兼容性或授权信息中混为一类。
- 皮肤 PNG、站内 3D 预览配饰、需要独立模型/模组/服务器支持的物品是不同的交付形态。
- 标准 Minecraft 皮肤 PNG 并不原生承载所有披风、披肩、外套模型。不可兼容的素材必须明确提示，不能声称所有物品都可合并导出为标准皮肤。
- “保存、下载、导出、发布、分享、使用素材、继续编辑”含义不同，每个按钮必须有真实行为和状态反馈。
- 只有真实接入的功能、模型、动画、登录提供商与数据持久化能力才能显示为可用。

## 2. 仓库与文档治理

正式代码仓库：`maoyiren/Pixcape`。正式文档目录为 `docs/`，不再创建第二套旧 `doc/` 文档目录。

关键文档（具体内容仍以各文件与代码为准）：
- [项目概览](PROJECT_OVERVIEW.md)
- [技术架构](ARCHITECTURE.md)
- [编辑器使用指南](USER_GUIDE.md)
- [开发与贡献](DEVELOPMENT.md)
- [部署入口说明](DEPLOYMENT.md)
- [单镜像生产部署与环境变量](SINGLE-IMAGE-PRODUCTION.md)
- [登录/OAuth/邮箱魔法链接/管理员初始化](AUTHENTICATION-SETUP.md)
- [用户角色与数据库迁移](NEXTJS-USER-ROLES-MIGRATION.md)
- [独立 Next.js 容器部署](NEXTJS-CONTAINER-DEPLOYMENT.md)
- [AI 模型架构](AI-MODEL-ARCHITECTURE.md)
- [生产安全上线清单](PRODUCTION-SECURITY-ROLLOUT.md)
- [发布与回滚清单](RELEASE.md)
- [PWA、SEO 与分享元数据](PWA-SEO-DEPLOYMENT.md)
- [全站 UI 与功能重构实施计划](UI-FUNCTION-REFACTOR-PLAN.md)
- [第三方许可证](../THIRD_PARTY_NOTICES.md)

维护规则：
1. 代码、路由、环境变量、Docker 入口或 UI 行为变化时，在同一 PR 更新本总纲和相关专项文档。
2. 以代码、`.env.example`、Prisma schema/migrations、Dockerfile、entrypoint、GitHub Actions 最新 run 为准。
3. 文档写了配置方法不等于生产已经配置；CI 通过不等于部署完成；镜像构建成功不等于线上功能通过。
4. 不在文档、日志、截图或提交中放置真实密码、API Key、OAuth Secret、数据库连接串或魔法登录链接。
5. 本文记录的状态如与最新 main/CI/生产证据冲突，先更新状态和证据，不以旧记录覆盖新事实。

## 3. 当前技术栈

以当前根目录 `package.json` 与部署文件为准，记录的主要组件包括：

| 层级 | 技术/职责 |
|---|---|
| 像素编辑器 | React、TypeScript、Vite |
| 3D 角色预览 | Three.js、skinview3d |
| 内置模型编辑器 | Blockbench Web，服务路径为 `/blockbench/` |
| 主站、账户与 API | Next.js、React、NextAuth v4 |
| 数据访问 | Prisma，多数据库 provider 适配 |
| 数据库候选 | PostgreSQL、MySQL/MariaDB、SQLite |
| UI 体系 | Mantine 为主要交互组件；Tailwind CSS v4 负责布局与响应式；shadcn/ui 只作为精选补充；Radix/Lucide 等现有依赖按需保留 |
| 表单与验证 | React Hook Form、Zod |
| 邮件 | Nodemailer/SMTP |
| 容器与路由 | Docker、多阶段构建、Nginx |
| PWA | vite-plugin-pwa、Workbox |
| 测试 | Node test runner、Playwright 浏览器测试、集成/安全测试 |
| CI 与依赖维护 | GitHub Actions、Dependabot（具体工作流以仓库为准） |

### 3.1 前端与服务架构原则

目标架构是 Next.js 承担主站、账户、创作者/管理员页面与 API；Vite 编辑器继续承担像素编辑和已有创作引擎；Blockbench 保持独立静态入口；在单镜像方案中由 Nginx 统一对外路由。不要把 Vite 编辑器当作另一套主站导航，也不要让用户通过没有实际价值的旧页面来回跳转。用户可见的核心页面应由 Next.js 统一承载，并通过受控入口进入 Vite 编辑器。

部署文档描述的预期路由包括：
- Next.js 主站与页面：`/`、`/login`、`/account`、`/creator`、`/admin`
- API：`/api/`，AI API：`/api/ai/`
- Vite 工作台/编辑器：`/studio/`
- Blockbench：`/blockbench/`

以上是目标/文档路由，必须通过当前镜像与生产环境实测确认可达。不要混用根目录 Dockerfile、`Dockerfile.nextjs` 和不同部署文档的端口/启动假设。

### 3.2 现有像素画布模型（架构文档记录）

- 画布是 64×64，共 4096 个像素槽位，以字符串数组表示。
- 空字符串表示透明；颜色字符串表示像素颜色；索引使用 `y * SIZE + x`。
- 已记录工具类型包括 Pencil、Eraser、Fill、Eyedropper、Line。
- 撤销/重做基于像素数组快照，历史在浏览器内存中，刷新不会自动保留。
- 图片导入通过临时 Canvas 缩放/居中到 64×64；低于透明度阈值的像素保持透明，其他像素转为 RGB 十六进制色。因此半透明像素会失去原始 alpha 精度。
- PNG 导出使用透明 Canvas。
- 当前编辑器运行时画布状态本身不等于云端项目持久化格式。跨设备同步、自动云保存等能力必须有真实后端实现后才能宣传。

## 4. 产品信息架构与路由约定

规范路由基线来自 UI 重构计划；具体实现需逐项验收：

| 路径 | 页面职责 |
|---|---|
| `/` | 首页、产品能力介绍、主要创作入口 |
| `/ai` | AI 文本生成/图片转换入口 |
| `/editor` | 单品编辑器/像素编辑入口 |
| `/wardrobe` | 独立衣橱选装 |
| `/dress-up` | 独立 3D 选装页面；不要未经验证将其降级为简单重定向 |
| `/workbench` | 创作工作台、最近作品与创作入口 |
| `/workbench/ai` | 工作台内 AI 创作入口 |
| `/workbench/edit` | 工作台内单品编辑入口 |
| `/workbench/dress` | 工作台内衣橱选装入口 |
| `/account` | 账户摘要与账户操作 |
| `/creator` | 当前用户创作者中心 |
| `/creator/:id` | 创作者公开资料（公开/审核状态须校验） |
| `/admin` | 管理后台；子页面按真实实现开放 |
| `/studio/` | Vite 编辑器承载入口 |
| `/blockbench/` | Blockbench Web |

旧路径仅在有明确兼容需求时做重定向，例如计划中记录的 `/AI`、`/bench`；不要在没有核对现有链接和真实业务行为前批量删除。素材库、社区若尚无完整正式路由，不应显示成已上线一级导航。

全站导航应统一 Logo、主要入口、搜索、语言切换、用户菜单和登录/注册入口。PNG 导出、管理员操作和具体服装分类应放在对应页面内部，而不是堆进顶栏。登录用户的账户入口指向真实的 `/account`；创作入口指向 `/workbench` 或相应工具，不要把二者混为同一路径。

## 5. UI 与交互规范

### 5.1 组件职责

- **Tailwind CSS v4：** 布局、Grid/Flex、断点、间距、尺寸、排版和设计 token 使用。
- **Mantine：** 默认按钮、输入框、选择器、弹窗、抽屉、Tabs、通知、Tooltip、Popover、表格、分页、表单状态和管理面板。
- **shadcn/ui：** 仅作为精选补充（例如命令面板或确有必要的 Radix 交互），不能与 Mantine 同时成为全站默认组件体系。
- **业务引擎：** 像素画布、skinview3d/Three.js 和 Blockbench 保留为专门引擎；组件库负责外围 UI，不替换绘图/3D 引擎。

同类业务组件只维护一个默认实现。共享主题、按钮尺寸、圆角、焦点、状态提示、暗色 token 和响应式规则必须统一。

### 5.2 按钮、表单与状态

所有可见按钮必须具备真实行为。适用的异步操作应提供默认、加载、成功、失败、禁用和权限不足状态；避免重复提交。删除、覆盖、下架、封禁等危险操作需要说明对象/影响、必要时二次确认，并由后端执行权限检查。成功提示必须由真实操作结果触发。

统一术语：
- 保存：写入当前草稿或账号数据。
- 下载：将文件保存到本地。
- 导出：按指定格式生成文件。
- 发布：向社区提交内容并应用可见性/授权规则。
- 分享：真实打开分享能力或生成链接。
- 使用素材：将素材载入当前选装/创作流程。
- 继续编辑：将正确的作品、贴图、分类、格式与素材引用传入编辑器。
- 恢复默认不等于全部脱下；重置视角不修改作品数据。

### 5.3 响应式与可访问性

桌面、平板、手机共用设计规范；验证 320–420px 窄屏、键盘焦点、触摸操作、表单错误提示、横向溢出、减少动态效果和可读性。管理后台桌面端采用固定分区导航，小屏折叠/换行，表格在窄屏容器内横向滚动。

## 6. 核心功能规范

### 6.1 创作工坊

建议工具栏顺序：返回、作品名、撤销、重做、保存、导入 PNG、导出、更多操作。左侧为绘图工具，中间为 2D 贴图与 3D 预览，右侧为颜色、图层、工具参数、素材属性、兼容性和导出设置。当前编辑对象必须清晰可见。导入时校验格式/尺寸并提示是否替换；导出失败应保留编辑状态。

### 6.2 衣橱选装（独立一级功能）

桌面布局为左侧素材分类/搜索/筛选，中间 3D 角色预览，右侧当前穿搭清单和操作。手机使用抽屉或底部面板。至少支持：
- 单件试穿、同类替换、脱下、随机搭配、全部脱下、恢复默认。
- 360° 旋转、缩放、重置视角、真实存在的动作切换、背景切换、单件显示/隐藏。
- 保存穿搭、继续编辑、预览和适用格式导出。
- 未登录时允许与产品设计一致的临时体验；保存到账户时要求登录，并尽可能保留可恢复状态。
- 保存穿搭应包含名称、封面、基础皮肤/角色引用、素材清单、分类、格式/兼容性、所属用户、可见性与时间戳。
- 继续编辑要传递完整穿搭数据，不得静默覆盖原件；提供更新原件或另存为新版本的明确选择。

素材分类至少保持独立：皮肤、上衣、外套、裤子、鞋子、帽子、披肩、披风、其他配饰、整套穿搭和模板。素材元数据应包含格式、模型/贴图、兼容性、许可与署名要求。

### 6.3 3D 预览

保留 skinview3d/Three.js。预览需验证角色模型、服装覆盖关系、视角、动作、背景、截图和不同设备性能。用户已指出的专项问题包括：披风/鞘翅模糊或错位、披风摆动方向错误、与胸背位置关系不正确、鞘翅展开角度过大、飞行动作不自然，以及旋转在约 180° 附近受阻。验收目标是无不必要阻尼的连续 360° 旋转、相机与模型变换分离、披肩/披风使用独立配置，且按钮对应真实动画。尚未逐项通过实际浏览器验收前，均视为待办而非已解决。

### 6.4 AI 创作

支持两个明确流程：
1. 文本描述 → 选择服务端可用模型 → 提交任务 → 状态/进度 → 查看结果 → 继续编辑/保存/下载。
2. 上传参考图 → 文件预览与替换 → 格式/大小检查 → 选择模型 → 提交 → 查看结果 → 继续编辑。

模型候选与环境变量中记录的供应商包括 Gemini、OpenAI、OpenRouter，以及火山引擎 Ark / Seedream 相关配置。具体可用性由服务端配置和模型 API 决定；不得因环境变量模板存在就宣称模型已经接通。API Key 只存服务端 Secret；必须限制上传大小、请求频率、超时、来源、重复任务和错误输出；失败时保留用户输入，不能向浏览器泄露密钥或内部堆栈。AI 结果要经过 Minecraft 皮肤贴图映射/尺寸/格式校验，支持 Classic/Slim（若实现），并接入 3D 预览、继续编辑和 PNG 下载。

### 6.5 个人中心与创作者

个人中心负责资料、作品、穿搭、AI 生成记录、收藏、最近编辑、账户安全和登录方式。作品支持打开、继续编辑、重命名、复制、导出/下载、删除、公开状态管理；穿搭应作为独立数据类型，不与单张皮肤贴图混称。

项目产品方向采用“注册即创作者”的低门槛思路，但创作者公开资料、发布权限、内容审核和账户状态仍须由服务端规则控制。普通注册用户不自动获得管理员权限。

### 6.6 社区与素材库

社区/素材库是产品目标，但必须按实际路由、数据模型、API 和审核链路确认是否完整上线。规划能力包括搜索、分类、标签、排序、详情、作者、格式兼容性、授权/署名、收藏/点赞/评论/分享/举报、草稿与发布。保存草稿不等于发布；发布失败保留草稿；用户只能管理自己有权操作的资源；审核和重要管理操作要有审计记录。

### 6.7 管理后台

管理后台目标是 WordPress 风格的信息架构：左侧固定分区导航、顶部工具栏、主体内容、面包屑、通知与统一表单。规划模块：
- 系统总览与健康检查
- 用户管理、账户状态、角色权限
- 素材管理、授权信息与下架
- 社区作品/评论/举报审核
- AI 服务与模型配置
- 认证提供商配置状态
- 系统设置
- 操作审计

安全规则：管理员权限在服务端校验；前端隐藏菜单不构成安全控制；普通用户不能调用管理 API；密钥写入时通过安全服务端机制，读取时脱敏；健康检查不得暴露数据库密码、完整环境变量或凭据。必须区分公开业务设置、管理员可编辑的非敏感设置、部署 Secret 和只读运行状态。管理后台中若 OAuth/SMTP 配置仍是占位 UI，不可声称能保存这些 Secret。

## 7. 认证、账户与权限

当前文档记录使用 NextAuth v4。计划/配置支持的方式包括 GitHub、Google、Microsoft Entra ID、Apple 与邮箱魔法链接，但只有环境变量成对配置且真实验证通过的方式才可展示为可用。邮箱魔法链接记录的有效期为 15 分钟，邮件通过 SMTP/Nodemailer 发送。

生产主域名目标固定为 `https://cdpc.cc`，认证 URL 应与之匹配。文档记录的 OAuth 回调：
- GitHub：`https://cdpc.cc/api/auth/callback/github`
- Google：`https://cdpc.cc/api/auth/callback/google`
- Microsoft：`https://cdpc.cc/api/auth/callback/azure-ad`
- Apple：`https://cdpc.cc/api/auth/callback/apple`

OAuth 控制台的协议、域名和路径必须完全匹配。此前已报告过 OAuth redirect_uri 未与应用关联的问题，因此生产验收必须实际测试登录发起、提供商回调、会话创建、数据库持久化、退出与受保护页面跳转。

管理员初始化是受控的一次性操作：先让目标用户正常登录并生成数据库记录，再按认证文档使用 `BOOTSTRAP_ADMIN_EMAIL` 执行 `npm run db:bootstrap-admin)，核验后立刻删除该变量。不得把新注册用户默认升级为管理员。

认证安全至少包括登录限流、可信代理 IP 头、失败关闭、角色隔离、资源所有权、封禁后旧会话失效、CSRF/回调地址检查、错误信息脱敏和审计。不要让客户端传入的 role/admin 参数授予权限。

## 8. 数据库与数据持久化

部署文档记录三种 provider：
- PostgreSQL：`DATABASE_PROVIDER=postgresql`
- MySQL/MariaDB：`DATABASE_PROVIDER=mysql`
- SQLite：`DATABASE_PROVIDER=sqlite`

三者都需要匹配的 `DATABASE_URL`、schema/client 与 migration。SQLite 仅适合单实例，并需将数据库文件放在持久化卷（文档示例 `file:/data/pixcape.db`）；不能让多个副本共享同一 SQLite 文件。PostgreSQL/MySQL 需要预先创建数据库和最小权限用户。

运行脚本以当前 package.json 为准，已记录：
- `npm run db:generate:all`：生成各 provider Prisma client
- `npm run db:migrate`：部署迁移
- `npm run db:bootstrap-admin`：受控管理员初始化
- `npm run db:push`：项目封装的 db push 脚本

数据库上线规则：
1. 生产迁移前确认目标实例并创建可恢复备份。
2. 检查迁移状态后，由操作者确认再执行迁移。
3. 不在生产执行 `migrate reset`，不手工删除迁移记录。
4. 每种 provider 都需独立集成/运行测试；生成客户端或编译成功不等于兼容性验证完成。
5. 验证写入、读取、重启后数据仍存在，以及资源所有权和并发安全。

## 9. Docker、Zeabur 与生产环境

目标部署是把 `cdpc.cc` 指向 Zeabur 上的 Pixcape 应用，而不是继续把独立 home 项目作为主入口。根目录 Dockerfile、Next.js 独立 Dockerfile、entrypoint 和历史部署文档可能对应不同阶段，发布前必须以当前 main 文件核对实际入口。

单镜像文档记录的预期流程：启动时在配置数据库时应用 Prisma migration，然后启动 AI API、Next.js 与 Nginx；但实际启动顺序、端口、健康检查必须从当前 `docker-entrypoint-single.sh` 和镜像日志确认。

关键环境变量（名称以代码和 `.env.example` 为准）：
- 数据库：`DATABASE_PROVIDER`、`DATABASE_URL`
- NextAuth：`NEXTAUTH_SECRET`、`NEXTAUTH_URL`
- OAuth：`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`；Google/Microsoft/Apple 对应变量见认证文档
- SMTP：`EMAIL_SERVER`、`EMAIL_FROM`
- 登录限流：`LOGIN_RATE_LIMIT_MAX`、`LOGIN_RATE_LIMIT_WINDOW_SECONDS`、`LOGIN_RATE_LIMIT_IP_HEADER`
- AI 通用：`AI_ALLOWED_ORIGINS`、`AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MAX_UPLOAD_MB`、`AI_RATE_LIMIT_PER_MINUTE`、`AI_TIMEOUT_MS`
- AI 供应商：Gemini、OpenAI、OpenRouter、Ark/Seedream 对应的 API Key、模型名、尺寸和兼容别名
- 管理员 bootstrap：`BOOTSTRAP_ADMIN_EMAIL` 仅用于受控初始化，不应长期存在
- 通用运行环境：`NODE_ENV=production`；Compose 示例端口变量为 `PIXELCAPE_PORT`

所有 Secret 只能放在 Zeabur 或其他部署平台的 Secret/环境变量配置中。不要放进 `VITE_*`、`NEXT_PUBLIC_*`、源代码、构建参数或公开日志。改动 Secret 后按平台要求重启/重新部署，并实际验证。

发布验收最少检查：
- 镜像 tag/digest 与发布提交 SHA 一致。
- 容器健康、启动日志与迁移状态正常。
- `/`、`/studio/`、`/blockbench/`、`/login`、`/api/auth/providers`、`/api/ai/models`、`/health` 按当前实现可达。
- 登录/OAuth/邮件、普通用户/创作者/管理员权限、限流和资源隔离通过。
- PNG 导入/导出、3D 预览、Blockbench、PWA 缓存与移动端基本功能无回归。
- 重启后数据库持久化，失败时有可执行回滚方案。
- GitHub Actions 对最新提交的 CI、安全、浏览器与 Docker 工作流结果通过。旧提交的成功记录不能替代当前 head 验证。

## 10. 测试与质量门禁

当前 package scripts 记录的主要测试命令：
```bash
npm run build
npm run next:build
npm run test
npm run test:e2e
npm run test:browser
npm run test:mysql-rate-limit
npm run test:sqlite-rate-limit
```
具体命令是否适用于当前工作分支应以 package.json 为准；执行前确认所需数据库、浏览器和环境变量已准备。

质量门禁：
- TypeScript 与构建成功。
- 单元测试、集成/安全测试、浏览器 E2E 按改动范围执行。
- 三种数据库分别进行真实运行验证。
- OAuth/SMTP/AI 在真实预览环境测试，不仅看静态配置。
- RBAC、资源所有权、封禁与会话、限流失败关闭、重复提交、审计日志覆盖。
- 320–420px 窄屏、键盘焦点、触摸、无横向溢出。
- Docker 镜像构建、容器启动、健康检查与路由检查。
- 对第三方依赖和许可证进行检查。

如果 GitHub Actions 因账户计费/额度问题无法运行，应明确标记“未验证/被环境阻塞”，不得伪报通过。PR 合并、CI 通过、镜像发布、生产部署、生产验收是五件不同的事。

## 11. UI 重构进度快照（2026-10-25）

以下状态来自仓库 `docs/UI-FUNCTION-REFACTOR-PLAN.md` 当日记录，须继续以当前 main、PR 和 Actions 最新结果复核。

### 已有记录的实现/代码迁移
- 根项目引入 Mantine 与 Tailwind CSS v4，Next.js 与 Vite 入口共享主题/Provider。
- 登录、注册首批迁移 Mantine，保留 React Hook Form、Zod、认证与校验流程。
- 核心入口 `/ai`、`/editor`、`/wardrobe`、`/workbench` 与编辑器 mode 参数已建立。
- 工作台、AI/编辑器/衣橱入口页、账户摘要、创作者中心、Studio 入口有 Mantine 迁移记录。
- 主导航区分工作台、AI 创作、衣服选装、单品编辑器、创作者中心和个人中心。
- 管理后台已有共享暗色 token、导航、表格和窄屏布局改造记录。
- 浏览器导航与部分移动端测试已补充记录。
- UI 计划记录：第二阶段某一提交的 CI、安全测试和 Docker 工作流成功；该结果只对记录中的特定 SHA 有效，不能外推到后续提交。

### 仍未整体结项
- 全站旧式按钮、表单、服装卡片、素材列表和编辑器外围尚需逐页迁移。
- 管理后台所有模块需要逐页确认真实业务链路和组件迁移。
- 最新增量的 CI、Next.js 构建、安全测试、浏览器回归和 Docker 构建需重新核验。
- 生产 OAuth、SMTP、AI 真生成、数据库迁移、cdpc.cc 部署后验收仍需真实环境测试。
- 3D 披风/鞘翅、360° 旋转、动画、素材兼容性和导出必须逐项回归。
- PR #25 的原始分支曾存在冲突；计划记录采用从最新 main 切分支并只迁移安全增量的方式处理。PR 当前状态必须重新查询 GitHub，不能从历史记录推断。
- 主分支是否已包含每一项后续增量，须按最新提交/PR diff 逐项确认。

## 12. 外部集成与许可证

### 12.1 Blockbench
项目内置 Blockbench Web，服务入口记录为 `/blockbench/`。必须保留对应 GPL-3.0-or-later 许可声明与第三方通知；升级、构建或裁剪资源时不能移除许可证要求。

### 12.2 Blessing Skin Server
产品架构方向是**独立部署、可替换的皮肤托管/游戏集成服务**，而不是把 Blessing Skin Server 的 PHP/Laravel 代码直接合并进 CDPC 的 Next.js 主应用。此前项目记录提到过集成方案 PR #21，但该计划是否仍存在、是否合并或实施须重新核对。阶段目标可按本地导入/导出 → 独立皮肤服务器 → 游戏端兼容逐步推进；账号映射、资源模型、安全边界、备份和回滚需先设计并验证。

### 12.3 AI 服务
AI 供应商 API 通过服务端代理调用，密钥不可进入浏览器。必须验证服务商的当前 API、模型许可、图像输出能力、上传/生成限制、成本控制和失败处理。Seedream/Ark 是候选集成方向，不能在实际生成与贴图校验未通过前标记为正式功能。

### 12.4 品牌与素材合规
- 产品名展示方向为 CDPC（域名为 cdpc.cc）；代码仓库仍名 Pixcape，清理旧品牌需逐处核对。
- 产品是非官方 Minecraft 社区项目，不得暗示 Mojang Studios、Microsoft 或其他发行方背书。
- 素材须记录作者、许可、署名要求、兼容性与来源；项目历史署名要求为“外套&披肩素材：邹陈云飞”与“外套&披肩素材：Th千”，按素材实际来源和现行文案展示。
- 不把 Minecraft 官方账号披风能力与站内贴图导出混淆；对用户说明站内导出的 PNG 不等于官方账号披风。
- 维护第三方代码/资源声明，按许可证履行分发要求。

## 13. 已知问题与高优先级待办

以下是需要继续核实/解决的已知问题与项目风险清单；不是声称它们都仍然复现。

### P0：生产可用性与安全
- [ ] 核实 `cdpc.cc` 当前指向的服务、镜像 tag/digest、commit SHA 与健康状态。
- [ ] 验证 OAuth redirect_uri，尤其 GitHub 回调 `/api/auth/callback/github`，并回归所有启用的提供商。
- [ ] 验证邮箱魔法链接 SMTP、15 分钟有效期、链接一次性使用与错误脱敏。
- [ ] 确认数据库 provider、持久卷、备份与迁移策略；生产迁移必须先备份并人工确认。
- [ ] 确认管理员登录、普通用户/创作者/管理员角色隔离与服务端 API 权限。
- [ ] 验证 AI API Key 只在服务端，上传大小/限流/超时/成本门禁生效。
- [ ] 检查 GitHub Actions 账户计费/额度是否阻塞最新验证。

### P1：UI 与主流程
- [ ] 按 UI 重构计划完成登录、注册、账户、创作者中心、工作台、AI、衣橱、单品编辑器和管理员后台逐页验收。
- [ ] 移除无用的中间跳转；Next.js 承担用户可见主站，Vite 只作为编辑器引擎入口。
- [ ] 衣橱选装与创作工坊的数据传递、保存、继续编辑、导出完整闭环。
- [ ] 所有按钮具备真实行为、状态反馈、权限与错误处理。
- [ ] 素材库/社区只在后端功能和正式路由完整时展示为已上线。

### P1：编辑器与 3D
- [ ] 修复/回归披风、披肩、外套与鞘翅的模型位置、贴图清晰度、朝向、动画和遮挡。
- [ ] 验证 360° 连续旋转、无 180° 卡点、触控操作与动作切换。
- [ ] 核对 Classic/Slim 皮肤、64×64 PNG、透明像素、导入缩放和导出结果。
- [ ] Blockbench 导入桥接历史报错包括 `Cannot read properties of undefined (reading 'initEdit')` 与 `Cannot read properties of undefined (reading 'includes')`；须以当前代码复测，不能假设仍存在或已修复。

### P2：AI、生态与体验
- [ ] 文生皮肤、图生皮肤在真实模型 API 下端到端验证，并检查输出贴图映射、3D 预览、继续编辑与下载。
- [ ] 管理后台 AI 模型配置明确区分可编辑业务配置与部署 Secret；未实现 Secret 安全写入时只显示配置状态/操作指南。
- [ ] 完善素材授权、作者署名、举报、审核、审计与侵权处理流程。
- [ ] 完成桌面、平板、手机、键盘、焦点和减少动态效果验收。

## 14. 推荐发布流程与回滚

1. 确认当前 main SHA、目标 PR、改动范围与依赖。
2. 阅读当前变更涉及的专项文档和 `.env.example`。
3. 执行类型检查、构建、相关单元/集成/安全/E2E 测试。
4. 对数据库改动先在隔离环境验证 migration，生产变更前做备份。
5. 创建并构建镜像，记录 commit SHA、tag、digest 和工作流 URL。
6. 在预览环境验证核心路由、登录、数据库、AI、3D、导入/导出和权限。
7. 发布到 Zeabur 后确认实际镜像与域名路由，运行生产烟雾测试。
8. 观察日志、健康状态、认证错误与 AI 错误。
9. 若失败，停止进一步变更，按发布文档回滚应用镜像；数据库回滚必须使用已验证的恢复方案，不能随意重置 migration。
10. 更新本文件、专项文档和发布记录，标记通过/失败/未验证及证据链接。

## 15. 项目状态的统一标记方式

每个功能/任务统一采用以下状态之一：
- **已实现（代码证据）**：代码已存在，但不自动代表生产可用。
- **已通过自动化验证**：附对应最新 commit SHA 和 workflow/test 证据。
- **已通过预览环境验证**：附环境、时间和测试结果。
- **已在生产验证**：附域名、镜像 digest、时间与烟雾测试记录。
- **需要部署配置**：代码存在但依赖 Secret、供应商控制台或平台配置。
- **计划中**：需求/文档已定义，尚无足够代码证据。
- **被阻塞**：说明具体外部条件，如计费、权限、第三方配置。
- **未知/待核实**：历史记录不足或状态可能已变化。

禁止把“PR 已合并”“构建成功”“镜像已推送”“生产已部署”“用户流程通过”写成同一件事。

---

## 附录 A：根目录常用命令

以当前 `package.json` 为准，常见命令包括：

```bash
npm install
npm run dev
npm run build
npm run next:dev
npm run next:build
npm run next:start
npm run test
npm run test:e2e
npm run test:browser
npm run db:generate:all
npm run db:migrate
npm run db:bootstrap-admin
```

先检查当前分支与脚本是否适用；需要数据库/浏览器/Secret 的命令必须在安全环境执行。

## 附录 B：关键路径速查

- 根 `package.json`：依赖与脚本事实来源
- `Dockerfile`、`Dockerfile.nextjs`、`docker-entrypoint-single.sh`：部署入口与服务启动事实来源
- `.env.example`：环境变量名称事实来源（不是生产密钥）
- `prisma/`：schema 与迁移
- `src/`：Vite/React 编辑器
- Next.js app/router 与 API 目录：主站、账户、管理员及服务端接口（以当前树结构为准）
- `tests/`：单元、集成、安全和 E2E 测试
- `.github/workflows/`：CI、构建、安全和镜像发布
- `docs/UI-FUNCTION-REFACTOR-PLAN.md`：UI 重构详细实施记录
- `THIRD_PARTY_NOTICES.md`：第三方许可证和署名

**维护责任：** 每次跨模块改动完成后，先更新本总纲的状态/证据，再更新专项文档索引，确保新加入项目的人能从这一份文件理解产品、架构、风险和下一步工作。



---

# 原文：`docs/PROJECT_OVERVIEW.md`

> 原文件 Blob SHA：`ae3b10f064b3220b4b7cb6e415d001c08a22e5ba`

# Pixcape 项目说明

更新日期：2026-10-17

Pixcape 是面向 Minecraft 皮肤的预制与编辑工作台。仓库当前包含两个独立应用入口：Vite 主站与 Next.js 账户服务。它们共用代码仓库，但应分别构建、配置和部署。

## 架构与运行边界

| 入口 | 技术 | 用途 | 生产状态原则 |
| --- | --- | --- | --- |
| 根目录 `Dockerfile` | Vite + Nginx | 皮肤工作台、静态资源、`/blockbench/` | 现有主站入口，保持独立 |
| `Dockerfile.nextjs` | Next.js Node 服务，端口 3000 | 账户、创作者、管理员功能 | 独立预览与验收；切换生产需另行审批 |

不要用 `Dockerfile.nextjs` 覆盖根目录 `Dockerfile`。代码合并、CI 通过、镜像构建成功和真实生产部署成功是不同状态，文档与发布说明必须分别记录。

## 技术栈

- React 19 + TypeScript：主站界面与交互。
- Vite 8：主站开发服务器与前端构建；项目没有 Webpack 构建配置。
- Three.js + skinview3d：Minecraft 角色 3D 预览。
- Lucide React、Radix UI Tabs / Tooltip：图标、分类切换与操作提示。
- vite-plugin-pwa + Workbox：Web App Manifest、Service Worker 与静态资源缓存。
- Nginx + Docker：主站静态托管与 Blockbench Web 编辑器资源。
- Next.js 16 + NextAuth + Prisma 7：独立账号服务、GitHub OAuth、数据库会话、角色与资源授权。
- 数据库 provider：PostgreSQL、MySQL/MariaDB、SQLite。各 provider 使用独立 Prisma schema 和迁移历史，禁止跨 provider 复用迁移目录。
- GitHub Actions：构建、测试和安全检查；依赖更新由 Dependabot 管理。

依赖的具体版本以 `package.json` 与 lockfile 为准。版本号会持续更新，不应把本文中的技术栈摘要视为精确的锁定版本清单。

## 主要功能

- 披肩、外套、披风分类分离；选择分类后只展示该类素材。
- 导入标准 64 × 64 PNG 皮肤，预制合成并导出 PNG。
- Steve / Alex 角色 3D 预览与动作预览。
- 将预制传递到完整 Blockbench Web 编辑器。
- PWA 安装、Service Worker 更新和 Open Graph 分享元数据。
- 独立账户服务规划与实现账号、创作者、管理员角色、会话、资源所有权和安全限流。

功能是否在生产域名启用，应以部署配置与线上验收为准，不能仅依据仓库中存在代码作判断。

## UI 设计约定

- 采用 Minecraft Java 物品栏的视觉语言：石头灰色面板、凸起/凹陷边框、方形物品槽、紧凑文字层级和高对比选中态。
- 草方块绿用于选中与重点交互，避免普通 SaaS 圆角卡片和大面积渐变。
- 当前皮肤与角色预览应优先展示；分类内容随当前选项切换。
- `src/minecraft-inventory.css` 维护主要物品栏风格。
- 窄屏采用纵向布局，关键操作保持易触控；桌面与移动端均需回归测试。
- Radix Tooltip 组件必须置于 `Tooltip.Provider` 内，避免运行时异常造成工作台白屏。

## 加载错误处理与排查

- 远程模板素材失败时，应有备用纹理或明确错误提示，不应无限加载。
- React 运行时错误应显示可诊断信息与重新加载入口。
- 线上白屏时先检查浏览器控制台、部署镜像版本、路由与资源路径，再判断是否为 PWA / Service Worker 旧缓存；清缓存不能代替代码修复。
- `/blockbench/` 必须指向编辑器资源，不应被 SPA 离线导航回退规则吞掉。

## PWA 与分享预览

- `vite.config.ts` 配置 `vite-plugin-pwa`。
- 图标：`public/pixcape-icon.svg`。
- 分享预览图：`public/pixcape-og.svg`。
- Open Graph / Twitter 元数据在根目录 `index.html` 中维护。
- 正式域名应使用绝对 HTTPS 分享图 URL；需验证目标平台是否支持 SVG，否则提供 PNG/JPEG 版本。

## 本地开发与构建

```bash
npm install
npm run dev
npm run build
npm run test
npm run test:e2e
npm run preview
```

`npm run build` 包含 Blockbench Web 资源与主站构建。账户服务可通过 `npm run next:dev`、`npm run next:build`、`npm run next:start` 独立运行；运行数据库迁移前必须确认当前 provider、目标数据库和备份。

## 安全与上线边界

- 不在仓库、聊天、Docker 镜像层或日志中保存密钥。
- OAuth 登录必须使用 HTTPS、正确回调地址和高熵 Secret。
- 登录限流依赖可信代理提供的客户端 IP 头；未确认代理会覆盖该头前，不应公开开放登录。
- 生产迁移必须先备份并由操作者明确批准；不要在每个应用容器启动时自动迁移。
- 生产启用前检查会话撤销、RBAC、资源所有权、封禁行为、审计日志与并发状态转换。
- 详细执行清单见 [生产安全上线操作手册](./PRODUCTION-SECURITY-ROLLOUT.md)。



---

# 原文：`docs/PWA-SEO-DEPLOYMENT.md`

> 原文件 Blob SHA：`cdddc2c9afec23cc33cb8161c8e0ccaf9577acc6`

# PWA、Open Graph 与部署检查清单

## PWA

- Manifest 由 `vite-plugin-pwa` 根据 `vite.config.ts` 生成。
- `registerType: autoUpdate` 启用 Service Worker 更新机制。
- `public/pixcape-icon.svg` 用作应用图标。
- 部署后使用浏览器开发者工具的 Application / Manifest 与 Service Workers 页面确认安装信息和 Service Worker 状态。
- 首次访问需要联网下载应用资源；远程托管的服装纹理不保证离线可用。
- 不要让 Service Worker 把 `/blockbench/` 导航请求回退到 Pixcape 的 `index.html`。

## 页面白屏 / 资源加载故障排查

1. 确认 Docker 镜像发布完成，并确认托管平台已经拉取最新 `ghcr.io/liseezn/pixcape:latest`；仅发布镜像不代表线上服务已经更新。
2. 在手机浏览器中重新加载页面；若旧版 PWA 仍被缓存，可在浏览器站点设置中清除 Pixcape 的站点数据后重新打开。
3. 如果工作台能打开但模板缩略图缺失，检查对 `raw.githubusercontent.com` 的网络访问。第三方素材失败时页面应显示备用皮肤，而不是无限停留在加载中。
4. 检查 `/` 返回的 HTML、`/assets/` 下 JS/CSS 是否为同一构建版本；不要让 CDN 或代理把旧 HTML 与新 JS 混用。

## Open Graph

根目录 `index.html` 维护以下元数据：

- 页面标题与描述。
- `og:type`、`og:site_name`、`og:title`、`og:description`。
- `og:image`、宽度和高度。
- Twitter/X 的 `summary_large_image` 分享卡片字段。

当前分享图位于 `public/pixcape-og.svg`。部分社交平台只稳定支持 PNG/JPEG；如果预览抓取器不接受 SVG，应转换并发布 1200 × 630 的 PNG/JPEG。部署到真实域名后，将 `og:image` 与 `twitter:image` 改为绝对 HTTPS URL，并通过相应平台的分享预览调试器重新抓取缓存。

## Vite 与 Webpack

项目现有构建链为 Vite：`npm run build` 会执行 `tsc -b && vite build`。当前没有 Webpack 配置，也没有必要为了添加 PWA 再并行引入 Webpack。PWA 已通过 Vite 插件集成。若未来要求迁移至 Webpack，需要同步替换开发服务器、构建脚本、PWA 集成和 Docker 构建，并单独验证。

## 发布前验证

1. 执行 `npm install`。
2. 执行 `npm run build`，检查 TypeScript 与 PWA 生成步骤。
3. 检查 `dist/manifest.webmanifest`、Service Worker 文件及应用图标是否生成。
4. 执行 Docker 构建，确认 `/` 与 `/blockbench/` 均能正常访问。
5. 在手机浏览器检查添加到主屏幕、横竖屏布局和触控操作。
6. 在社交平台预览调试器检查 Open Graph 标题、描述和分享图。



---

# 原文：`docs/RELEASE.md`

> 原文件 Blob SHA：`123a49cfb56a5e9cce113c7656ee6e7629dab098`

# 发布与运维清单

## 1. 发布流程概览

```text
修改代码
  ↓
本地 npm run build
  ↓
提交并推送到 main
  ↓
GitHub Actions：CI 检查
  ↓
GitHub Actions：构建并发布 GHCR 镜像
  ↓
确认镜像标签存在
  ↓
Zeabur 部署新镜像
  ↓
验证默认域名、页面和自定义域名
```

## 2. 发布前

- [ ] 检查改动范围与代码差异。
- [ ] 执行 `npm install`。
- [ ] 执行 `npm run build` 并确认成功。
- [ ] 新增或变更的功能已更新 `docs/USER_GUIDE.md`。
- [ ] 变更构建或部署配置时已更新 `docs/SINGLE-IMAGE-PRODUCTION.md`。
- [ ] 未提交任何令牌、密码或其他机密信息。

## 3. GitHub Actions

推送到默认分支后，打开仓库的 Actions 页面，确认相关工作流已完成。若失败，先查看失败步骤和日志，修复后再发布。

- 仓库 Actions：<https://github.com/liseezn/Pixcape/actions>
- CI 工作流：`.github/workflows/ci.yml`
- 镜像发布：`.github/workflows/docker-publish.yml`

## 4. 镜像确认

- 镜像名称：`ghcr.io/liseezn/pixcape`
- 推荐标签：`latest`
- 生产容器端口：`80`

在 GHCR 包页面确认新镜像标签已出现。不要仅凭 Actions 成功就推断 Zeabur 一定能拉取镜像；还需确认包可见性、标签和访问权限。

## 5. Zeabur 发布后验证

- [ ] 部署状态为成功。
- [ ] 日志中没有镜像拉取失败或容器启动错误。
- [ ] 默认域名可以打开编辑器。
- [ ] 绘图、撤销/重做、导入图片和 PNG 导出等关键功能正常。
- [ ] 如果使用自定义域名，确认 DNS、域名验证和 HTTPS 均正常。

## 6. 回滚思路

若新版本发布后出现问题：

1. 查看 Zeabur 当前部署与上一可用部署记录。
2. 如平台提供历史部署回滚功能，可回退到已知可用版本。
3. 如需指定镜像标签，应选择 GHCR 中实际存在且已验证的标签。
4. 回滚后再次验证页面加载和关键编辑功能。
5. 记录故障原因，并在修复后重新发布。

避免删除仍在使用或用于回滚的镜像标签。



---

# 原文：`docs/SINGLE-IMAGE-PRODUCTION.md`

> 原文件 Blob SHA：`31c213180e2b7701b99aa249ed2ac1e83f4ec223`

# Single-image production deployment

Updated: 2026-10-18

## Production layout

The root `Dockerfile` produces the deployable Pixcape image. The intended routes are:

- Next.js application at `/` (including account, creator/admin, and authentication routes)
- Vite editor at `/studio/`
- Blockbench at `/blockbench/`
- Next.js account and creator/admin pages, including `/login`, `/account`, `/creator`, and `/admin`
- Next.js authentication/API routes under `/api/`
- AI API under `/api/ai/`

The container entrypoint is `docker-entrypoint-single.sh`. It applies Prisma migrations when `DATABASE_URL` is configured, then starts the AI API, Next.js, and Nginx. Check the actual container logs and health endpoints after deployment; a successful image build alone does not prove that all services are reachable.

## Database configuration

Set `DATABASE_PROVIDER` and `DATABASE_URL` together:

| Provider | `DATABASE_PROVIDER` | Example `DATABASE_URL` |
|---|---|---|
| PostgreSQL | `postgresql` | `postgresql://USER:PASSWORD@HOST:5432/pixcape?schema=public` |
| MySQL | `mysql` | `mysql://USER:PASSWORD@HOST:3306/pixcape` |
| SQLite | `sqlite` | `file:/data/pixcape.db` |

The application contains provider-specific Prisma clients under `generated/prisma-postgresql`, `generated/prisma-mysql`, and `generated/prisma-sqlite`. Select the matching provider at runtime. PostgreSQL and MySQL require a provisioned database and a least-privilege user. SQLite is intended for a single instance and requires persistent storage mounted at `/data`; do not share a SQLite database file between replicas.

Back up the database before deploying a release that changes migrations. Startup migration failures must be treated as a deployment failure and investigated before routing traffic.

## Required environment variables

- `DATABASE_PROVIDER`: `postgresql`, `mysql`, or `sqlite`.
- `DATABASE_URL`: connection URL for the selected provider.
- `NEXTAUTH_SECRET`: unique, high-entropy production secret.
- `NEXTAUTH_URL`: the public HTTPS URL used by the authentication service.

GitHub OAuth (optional unless GitHub sign-in is enabled):

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

Login rate limiting:

- `LOGIN_RATE_LIMIT_MAX`: maximum attempts per window.
- `LOGIN_RATE_LIMIT_WINDOW_SECONDS`: window length in seconds.
- `LOGIN_RATE_LIMIT_IP_HEADER`: proxy header used to determine the client IP. Trust it only when the reverse proxy overwrites the header.

General runtime:

- `NODE_ENV`: use `production`.
- `PIXELCAPE_PORT`: host port mapped to container port 80 when using Compose.

AI API variables (optional unless the corresponding provider is used):

- `AI_ALLOWED_ORIGINS`
- `AI_DEFAULT_PROVIDER`
- `AI_DEFAULT_MODEL`
- `AI_MAX_UPLOAD_MB`
- `AI_RATE_LIMIT_PER_MINUTE`
- `AI_TIMEOUT_MS`
- `GEMINI_API_KEY`, `GEMINI_IMAGE_MODELS`, and legacy alias `GEMINI_IMAGE_MODEL`
- `OPENAI_API_KEY`, `OPENAI_IMAGE_MODELS`, and legacy alias `OPENAI_IMAGE_MODEL`
- `OPENROUTER_API_KEY`, `OPENROUTER_IMAGE_MODELS`, `OPENROUTER_IMAGE_TO_IMAGE_MODELS`, `OPENROUTER_SITE_URL`, and legacy aliases `OPENROUTER_IMAGE_MODEL`, `OPENROUTER_IMAGE_TO_IMAGE_MODEL`
- `ARK_API_KEY` or `VOLCENGINE_ARK_API_KEY`, `ARK_BASE_URL`
- `SEEDREAM_IMAGE_MODELS`, legacy alias `SEEDREAM_IMAGE_MODEL`, and `SEEDREAM_IMAGE_SIZE`

Admin bootstrap is an explicit operator action: `BOOTSTRAP_ADMIN_EMAIL` is used by `npm run db:bootstrap-admin`; it is not required for normal startup. Remove it immediately after the controlled bootstrap operation.

Never put database passwords, OAuth secrets, or `NEXTAUTH_SECRET` in `VITE_*`/`NEXT_PUBLIC_*` variables, source control, or image build arguments.

## Compose deployment

Set environment variables in the deployment platform or a private `.env` file, then run:

```bash
docker compose build
docker compose up -d
docker compose logs -f pixcape
```

For SQLite, preserve the persistent `/data` volume. For PostgreSQL/MySQL, create the database and a least-privilege database user before starting the service.

## Deployment verification checklist

Run these checks against the actual image and deployment:

1. Confirm the container stays healthy and logs show successful database migration.
2. Verify `/`, `/studio/`, `/blockbench/`, `/login`, `/api/auth/providers`, `/api/ai/models`, and `/health`.
3. Verify sign-in and role-based access for ordinary users, creators, and administrators.
4. Test rate limiting and confirm protected resources cannot be accessed by another user's account.
5. For each database provider, verify migration status, create/read-back persistence, and data survival after a container restart.
6. Confirm the published image tag and digest in the registry before treating a release as deployed.

Do not claim PostgreSQL, MySQL, or SQLite runtime compatibility based only on generated clients or a successful build. Each provider needs a matching integration/runtime test against a disposable database. CI can only run those checks after GitHub Actions billing and runner availability are restored.



---

# 原文：`docs/TECH-STACK-ADDITIONS-PLAN.md`

> 原文件 Blob SHA：`5fac9ac1358e5a46b7154c23158c180313881c9e`

# CDPC 新增技术库选型与接入规划

- 版本：V1.0
- 规划日期：2026-10-23
- 项目：CDPC（原 Pixcape）
- 依据：docs/UI-FUNCTION-RESTRUCTURE-PLAN.md
- 状态：选型提案；不代表依赖已安装或功能已实现

## 1. 选型原则

1. 先盘点现有依赖、组件导入和路由，再决定是否安装。
2. 保留 React + TypeScript + Vite 编辑器、Next.js 账户服务、Prisma 数据层。
3. UI 组件体系只设一个主体系，不叠加多个完整设计系统。
4. 保护 Three.js、skinview3d、Blockbench Web、皮肤 PNG 导入/导出及现有账号数据。
5. 每个新增库必须对应具体功能、测试和维护责任。
6. 安装时核对当前版本兼容性、许可证、Node/Docker 环境及锁文件，不凭文档声称已使用最新版。

## 2. 当前已有能力：优先复用

| 领域 | 已有依赖/能力 | 规划 |
|---|---|---|
| UI 原语 | Radix UI（Tabs、Tooltip、Select 等） | 盘点实际使用后保留必要原语 |
| 图标 | lucide-react | 全站统一，不再加第二套图标库 |
| 前端 | React、TypeScript、Vite | 保留编辑器架构 |
| Web/账户 | Next.js、NextAuth | 明确 Vite 与 Next.js 页面及部署边界，不新增 Web 框架 |
| 数据层 | Prisma、PostgreSQL/MySQL/MariaDB/SQLite 适配 | 延续现有方案，迁移需可回滚 |
| 3D | Three.js、skinview3d | 保留，不替换渲染引擎 |
| 邮件 | Nodemailer | 复用，优先修复现有配置与流程 |
| PWA | vite-plugin-pwa | 审计当前 Service Worker 和缓存策略 |
| 测试 | Node test runner、现有单元/集成/E2E 脚本 | 先完善已有测试，再补缺口 |

## 3. 建议新增或评估的库

| 优先级 | 库/方案 | 对应功能 | 接入边界 |
|---|---|---|---|
| P0 | Mantine（主 UI 体系候选） | 导航、页脚、表单、弹窗、Tabs、后台界面、响应式布局 | 先与 Radix 做组件盘点。若选 Mantine 为主体系，只保留必要 Radix 原语；先迁移一个试点页面再决定推广 |
| P0 | React Hook Form | 登录/注册、资料、投稿、管理设置等复杂表单 | 复杂和重复表单优先；简单表单不必强制改写 |
| P0 | Zod | 表单、API 输入、AI 请求和配置校验 | 服务端必须再次校验；客户端校验不代替授权 |
| P0（按需） | Vitest | UI/编辑器工具函数单元测试 | 先评估 Node 内建测试；只有需要与 Vite 集成及 React 组件测试时再引入，避免两套重复入口 |
| P0（按需） | Testing Library（React） | 登录、导航、表单、权限提示交互测试 | 与组件测试框架配套，按用户可见行为测试 |
| P0（按需） | Playwright | 登录流程、权限、关键编辑流程、桌面/移动端冒烟测试 | 先核对现有 E2E 是否已有浏览器自动化；缺失时再引入。外部 OAuth 需区分模拟与真实线上验证 |
| P1（按需） | TanStack Query | 素材、社区、收藏、个人中心和后台数据刷新/缓存 | 仅管理客户端服务器状态；避免与 Next.js 服务端取数/缓存重复 |
| P1（按需） | TanStack Table | 用户、审核、AI 任务、审计日志等复杂表格 | 只用于确有排序、筛选、列控制需求的后台表格 |
| P1（按需） | Recharts 或现有图表方案 | 后台趋势和统计 | 只选一个；真实数据接口准备好后再接入 |
| P1（二选一） | Mantine Notifications 或 Sonner | 保存、导出、登录、投稿等操作反馈 | 若 Mantine 提供能力足够就复用，不再另装通知库 |
| P1（可选） | Sentry SDK | 前后端异常和发布版本追踪 | 先评估隐私、采样、保留和成本；过滤密钥、令牌、邮箱及上传内容 |
| P1（可选） | i18next + react-i18next | 中英文界面与错误提示 | 先盘点现有翻译方案；已有则扩展，不维护两套 |
| P2（按需） | Sharp | 素材缩略图、上传图片预处理 | 不得破坏原始 64×64 皮肤纹理；保留无损原件并检查 Docker 原生依赖兼容性 |
| P2（按需） | Redis 服务及客户端（如 Upstash Redis） | 多实例限流、AI 配额和滥用控制 | 先审计现有数据库限流；只有多实例或性能瓶颈明确时再加 |
| P2（按需） | S3 兼容对象存储 SDK | 上传、作品图、AI 生成文件 | 先定义权限、生命周期、删除与备份；现有存储足够时不急于迁移 |
| P2（按需） | AI SDK 或供应商官方 SDK | 文字生成皮肤、图片转皮肤、模型路由 | 先定义统一内部接口，再按实际供应商选择；API 密钥只能在服务端 |
| P2（可选） | Pino | 结构化服务日志 | 先审计现有日志；运行日志与管理审计分离，严禁记录秘密值 |
| P2（按需） | axe-core / @axe-core/playwright | 键盘、焦点、标签和无障碍回归 | 与关键页面测试配套，自动化不能替代人工键盘检查 |

## 4. 按功能模块规划

### 4.1 全站 UI 和布局
- 主组件体系只选择一套；Mantine 是候选方案，须先做现有 Radix 使用盘点。
- 图标继续用 Lucide React。
- 使用 CSS variables 统一颜色、间距、圆角、层级和焦点样式，不额外引入设计系统框架。
- 在项目内建立共享的 AppShell、MarketingLayout、BrowseLayout、EditorLayout、AuthLayout、AccountLayout、AdminLayout。
- 通知、加载、空、错误、无权限状态集中维护，避免各页面重复实现。

### 4.2 登录、注册与权限
- React Hook Form + Zod 改善复杂表单体验。
- 认证继续以当前 NextAuth 和身份模型为准，不新增另一套认证框架。
- 每个受保护 API/Server Action 都要检查会话、账号状态、角色及资源所有权。
- 对登录、注册、邮件发送、密码恢复、OAuth 回调和高风险操作实施限流与审计。
- UI 库不能修复 OAuth 控制台回调 URL 配置错误。

### 4.3 创作工坊和 3D
- 保留 Three.js、skinview3d 与现有 Blockbench Web 入口。
- 撤销/重做先审计现有编辑器状态模型；只有复杂度确实难以维护时再单独评估 Zustand。
- 不在没有明确需求前同时引入 Redux、Zustand、Jotai 等多套状态库。
- 对 PNG 校验与导出建立测试，保护 64×64 纹理、透明度、Classic/Slim 与配件分类。
- 3D 回归覆盖连续旋转、动作切换、披风/鞘翅预览及窗口尺寸变化。

### 4.4 AI 创作
- 先定义供应商无关的生成服务接口，再选择 AI SDK。
- 统一任务状态、超时、重试、配额、成本记录和错误处理。
- 用 Zod 校验输入和结果；校验生成文件的 PNG 格式、尺寸和可编辑性。
- 所有模型密钥只在服务端，不能进入浏览器 bundle。

### 4.5 素材库、社区和个人中心
- TanStack Query 只用于需要客户端缓存、刷新或乐观更新的服务器状态。
- TanStack Table 只用于后台复杂表格。
- Sharp 与对象存储根据真实上传和容量需求再决定。
- 收藏、投稿、发布、评论和举报必须有实际 API、数据模型、权限检查及集成测试；组件库不代替业务逻辑。

### 4.6 管理后台
- 复用统一 UI、表单校验、复杂表格；图表和异常追踪按需启用。
- 统计与健康卡片必须来自真实数据和真实检查。
- 高风险操作需服务端授权、确认、审计及明确的失败反馈。
- 密钥只展示“已配置/未配置”或脱敏状态，不能回传原始值。

## 5. 推荐接入顺序

### 第 0 步：依赖审计，不安装新库
1. 检查 package.json、锁文件、UI 导入、重复组件和现有测试。
2. 明确 Vite 页面与 Next.js 页面各自职责及部署入口。
3. 记录每个库是否已安装、是否真实使用、是否与其他方案重复。
4. 检查第三方许可证清单及新增依赖许可证。
5. 运行现有构建、单元、集成、E2E 测试，保存基线结果。

### 第 1 步：公共 UI 和表单
1. 确定唯一主 UI 体系，先迁移导航或登录页试点。
2. 建立设计令牌、公共布局与状态组件。
3. 确认缺失后再为复杂表单引入 React Hook Form + Zod。
4. 只保留一套通知方案。

### 第 2 步：测试体系
1. 优先完善现有 Node 测试。
2. 有组件测试需求再引入 Vitest + Testing Library。
3. 现有 E2E 不具备浏览器自动化时再引入 Playwright。
4. 覆盖登录/权限、PNG 导入导出、编辑器关键路径和响应式布局。

### 第 3 步：数据密集页面
1. 明确 Vite 与 Next.js 数据获取边界。
2. 有明确缓存需求时引入 TanStack Query。
3. 复杂后台表格使用 TanStack Table。
4. 统计 API 可用后再加入唯一图表库。

### 第 4 步：AI、上传和可观测性
1. 定义 AI provider adapter 与任务模型，再选 SDK。
2. 根据存储需求评估 Sharp 和对象存储。
3. 根据部署实例数与现有限流性能决定是否引入 Redis。
4. 根据隐私与成本要求决定是否启用 Sentry/Pino。

## 6. 依赖治理与安全要求

- 新依赖必须提交锁文件，并由 CI 执行安装、构建、测试及许可证检查。
- 核对 Node、React、Next.js 兼容性、ESM/CJS 形式和 Docker 原生依赖。
- 使用现有依赖更新流程检查安全更新，不盲目升级生产依赖。
- 不将密钥写入前端 bundle、浏览器存储、日志或错误追踪事件。
- 上传文件须检查大小、MIME、真实格式和像素尺寸。
- 管理后台 API 必须服务端鉴权；隐藏前端菜单不是安全措施。
- 记录每个依赖的用途、许可证、维护责任、风险和移除方式。
- 检查新增依赖对 bundle 体积、首屏、移动端与 3D 性能的影响。
- 不在同一模块混用多套表单、通知、图标、缓存或全局状态方案。

## 7. 暂不引入

除非审计证明存在明确缺口，暂不加入第二套完整 UI、第二套图标库、多套状态管理库、第二套认证框架或 ORM、多个并行的表单校验/通知/图表库，以及没有实际规模需求的复杂工作流系统。

## 8. 验收清单

- [ ] 已盘点依赖和实际 import。
- [ ] UI 主体系唯一，导航/页脚/表单/状态组件可复用。
- [ ] 认证、权限与数据所有权在服务端验证。
- [ ] 皮肤 PNG、64×64、Classic/Slim、Blockbench 与 3D 预览回归通过。
- [ ] AI 密钥仅在服务端，任务失败、配额和成本有记录。
- [ ] 后台统计和健康状态来自真实数据。
- [ ] 手机端、键盘导航、焦点和错误反馈通过测试。
- [ ] 新依赖已锁版本、核许可证、CI 通过。
- [ ] Docker 构建和数据库迁移未被破坏。
- [ ] 文档、环境变量说明、回滚方法与测试结果已更新。

## 9. 结论

建议按“审计现状 → 确定唯一 UI 体系 → 统一表单与校验 → 补齐测试 → 按需引入数据表格/图表/缓存 → 最后扩展 AI、上传和监控”推进。

本文是选型规划，不表示相关依赖已经安装，也不表示功能已经实现。每个阶段只引入当前真正需要的依赖，并以可构建、可测试、可回滚为完成标准。


## 10. 细化功能库清单：尽量复用成熟实现

本节补充全站实际功能可能用到的工具。它们全部是候选项；安装前必须搜索仓库现有实现与依赖，确认缺口后再采用。**不要求把清单里的每个库全部安装。**

### 10.1 编辑器与画布交互

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| 快捷键与组合键 | `tinykeys` 或 `hotkeys-js`（二选一） | 撤销/重做、保存、切换工具、预览快捷键 | 忽略输入框、文本编辑和浏览器保留快捷键；显示可发现的快捷键帮助 |
| 拖放上传 | `react-dropzone` | 拖入皮肤 PNG、图片和素材文件 | 前后端都检查真实格式、尺寸和文件大小；不能信任扩展名/MIME |
| 颜色选择 | Mantine ColorInput 或现有颜色选择组件 | 像素绘制、调色、颜色替换 | 若像素编辑器需要精确色值/透明度，必须验证 alpha 通道和 HEX/RGBA 往返无损 |
| 虚拟列表 | `@tanstack/react-virtual` | 大量素材、社区作品、管理日志列表 | 只有列表量或滚动性能确有问题时引入；虚拟列表须兼顾键盘和屏幕阅读器 |
| 复杂画布状态 | 先用现有 reducer/命令模型；必要时 Zustand | 工具状态、选择区、图层、历史记录 | 不让状态库承载每个像素的高频逐帧状态；画布渲染性能单独测量 |
| 动画/过渡 | CSS transitions；必要时 `motion` | 页面过渡、弹层、轻量反馈 | 3D 预览和编辑器不加无意义动画；遵守 prefers-reduced-motion |
| 图像差异回归 | Playwright 截图或项目现有视觉测试工具 | 防止布局/预览意外变化 | 截图测试要固定字体、视口和渲染环境；像素纹理导出仍需二进制/像素级断言 |

### 10.2 文件上传、图片与导出

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| 文件上传体验 | `react-dropzone` | 拖放区、文件选择、拒绝原因提示 | 不把客户端验证当安全边界 |
| 浏览器端图片处理 | 原生 Canvas / `pngjs`（仅 Node 场景按需） | 读取像素、检测 PNG 尺寸、生成预览 | 不要用有损压缩；必须验证透明度、调色板、64×64、Classic/Slim |
| 服务端图片变体 | `sharp` | 社区缩略图和非原始素材预览 | 不处理/覆盖原始 Minecraft 皮肤纹理；注意容器平台二进制兼容 |
| 对象存储 | S3 兼容 SDK（选定供应商后确定） | 大文件与生成结果的持久化 | 私有对象使用短期签名 URL；检查访问控制、生命周期和删除 |
| 下载/压缩包 | 浏览器原生 Blob；多文件打包时评估 `JSZip` | 导出单文件或多个素材 | ZIP 导出验证文件名、内容、路径，避免路径穿越及内存峰值 |

### 10.3 社区、内容和富文本

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| Markdown 预览 | `react-markdown` | 投稿说明、帮助文档、教程内容 | 默认禁用危险 HTML；需要 HTML 时配合严格清洗 |
| HTML 清洗 | `isomorphic-dompurify` 或服务端等效方案 | 防止富文本 XSS | 依据实际渲染链路选用；不能仅在客户端清洗后就信任数据库内容 |
| 日期/相对时间 | `date-fns` | “刚刚”、日期筛选、时间格式 | 全站统一时区和本地化策略，避免混用多套日期库 |
| 国际化 | `i18next` / `react-i18next`（先审计已有方案） | 中文/英文、错误信息、日期格式 | 文案使用稳定 key；不要把业务错误和翻译文案耦合在 API 中 |
| 无限滚动 | TanStack Query 的 infinite query 或现有分页 | 素材库、社区列表 | 优先服务端分页与可恢复的 URL 查询参数；避免无上限加载 |
| 搜索与筛选 | 现有数据库查询；复杂全文搜索以后再评估专用引擎 | 素材、用户和社区检索 | 先用数据库索引、分页和受控过滤；不要提前引入 Elasticsearch 类基础设施 |

### 10.4 后台管理、数据与任务

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 表格 | `@tanstack/react-table` | 排序、过滤、列显示、批量操作 | 由服务端强制执行权限和分页；前端过滤不能当授权 |
| 图表 | `recharts`（或已用图表库） | 注册趋势、生成任务、审核队列等 | 图表不允许用随机/演示数据伪装生产统计 |
| 后台表单 | React Hook Form + Zod | 环境配置、内容审核、角色管理 | 敏感值只允许设置/轮换，不回显原始 secret |
| 任务队列 | 先用数据库任务表；规模明确后评估 BullMQ + Redis | AI 图片生成、耗时导出、重试与并发控制 | 需要持久任务状态、幂等键、超时、取消、重试上限和失败队列；不要在没有 Redis/worker 运维能力时直接加 BullMQ |
| 任务可观测性 | Pino + 关联 ID；可选 Sentry | 排查 AI 失败、OAuth 和后台操作 | 过滤 PII、令牌、提示词中的敏感内容与密钥；设置日志保留期限 |
| 数据校验 | Zod + 数据库约束 | API 输入和数据完整性 | 应用层 schema 与数据库约束互补，不以单层校验代替另一层 |
| 数据迁移 | 现有 Prisma Migrate | Schema 变更与部署升级 | 每个变更需考虑 SQLite 与 PostgreSQL/MySQL 差异、备份和回滚；生产启动迁移需可观测 |

### 10.5 认证、邮件和安全

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 认证 | 继续用当前 NextAuth | OAuth、会话、登录回调 | 不再平行引入 Clerk/Auth.js 之外的第二套认证；先修复 provider ID、回调 URL、cookie 与生产域名 |
| 表单/API 校验 | Zod | 登录、注册、管理员操作、AI API | 身份认证、角色检查、资源所有权、CSRF 和限流仍要单独实现 |
| 限流 | 当前持久化方案；多实例时评估 Redis 方案 | 登录、注册、魔法链接、AI 生成防滥用 | 对邮箱/IP/账号维度设不同策略，防止攻击者利用请求耗尽邮件/AI 费用 |
| 安全响应头 | Next.js headers / 当前反向代理配置 | CSP、HSTS、frame、MIME 等安全头 | 先盘点 nginx/Cloudflare/Next.js 现有策略，避免重复或冲突；CSP 需实测 OAuth 和图片资源 |
| 安全审计 | npm audit / GitHub Dependabot / 现有 CI | 依赖漏洞与更新 | 审核升级变更和兼容性；不盲目使用 force 更新 |
| 邮件模板 | 先复用现有 Nodemailer；若需组件化再评估 React Email | 魔法链接、通知、密码/安全提示 | 邮件模板需移动端兼容、纯文本版本、链接域名验证和发送失败监控 |
| 权限库 | 暂不新增；必要时评估 CASL | 复杂资源权限矩阵 | 若仅 ADMIN/USER 与资源所有权，手写清晰的服务端 policy 通常更轻；权限复杂度增长时再引入 CASL |
| 机器人防护 | Turnstile（若部署环境采用 Cloudflare） | 注册、邮件发送和公开表单滥用控制 | 服务端验证 token；仅加前端挑战不具备保护作用 |

### 10.6 可观测性、错误边界和性能

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 前端错误边界 | React Error Boundary 或项目现有方案 | 页面局部故障时显示恢复 UI | 编辑器崩溃不能吞掉导出失败或丢失未保存状态；提供重试/恢复入口 |
| 服务端日志 | Pino（可选） | JSON 日志、请求关联、错误上下文 | 不记录密码、Cookie、OAuth code、Authorization header 或 API key |
| 错误追踪 | Sentry（可选） | 版本关联、错误聚合 | 上传源码映射前审查构建和访问权限；配置数据脱敏 |
| 性能分析 | Web Vitals / Next.js 内建指标 | 首屏、交互延迟和移动端体验 | 只采集必要指标，建立性能预算；不默认追踪用户输入 |
| Bundle 分析 | Vite/Next.js 现有分析工具或对应插件 | 检查新增依赖是否增大首屏 | 对编辑器、3D、后台分别分析；重型模块按需加载 |
| 无障碍测试 | axe-core、Playwright 辅助 | 语义、标签、对比度和焦点检查 | 自动化结果需人工复核；所有核心功能应支持键盘操作 |

## 11. 库选择决策表

- **马上优先评估：** React Hook Form、Zod、测试覆盖工具，以及单一 UI 体系。
- **页面实现时再引入：** TanStack Table、TanStack Query、react-dropzone、react-markdown、date-fns。
- **生产需求出现后再引入：** Redis/BullMQ、对象存储、Sharp、Sentry、Pino、Turnstile。
- **先不引入：** 第二套认证、ORM、UI 体系、状态管理体系；没有业务需求的搜索集群或微服务编排。

每项依赖的 PR 应包含：
1. 为什么当前代码无法低成本完成该功能；
2. 依赖与替代方案的比较；
3. 许可证、维护状态、Node/React 兼容性和包体积；
4. 最小接入范围；
5. 测试与验收方式；
6. 回滚/移除方法。

## 12. 参考文档

实施时应优先核对官方文档及当前版本的安装要求：
- Mantine: https://mantine.dev/
- Radix UI: https://www.radix-ui.com/
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- Vitest: https://vitest.dev/
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/
- TanStack Query: https://tanstack.com/query/latest
- TanStack Table: https://tanstack.com/table/latest
- TanStack Virtual: https://tanstack.com/virtual/latest
- React Dropzone: https://react-dropzone.js.org/
- React Markdown: https://github.com/remarkjs/react-markdown
- Sharp: https://sharp.pixelplumbing.com/
- Recharts: https://recharts.org/
- Sentry: https://docs.sentry.io/
- Pino: https://getpino.io/
- React Email: https://react.email/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/


## 13. 基于当前主分支 package.json 的初步依赖盘点

本盘点仅依据当前可读取的 `package.json`，不能证明某个库完全没有被源码间接使用；真正安装前仍需搜索 import、锁文件、CI 和 Dockerfile。

### 13.1 当前已声明的关键依赖

| 已声明依赖 | 当前用途/意义 | 行动 |
|---|---|---|
| React 19、React DOM、TypeScript | UI 与类型系统 | 保留 |
| Vite、@vitejs/plugin-react | 现有 SPA/编辑器构建 | 保留 |
| Next.js 16、NextAuth 4 | Next.js 页面、认证与会话 | 保留并优先检查版本兼容和认证配置 |
| Prisma 7、PostgreSQL/MariaDB/SQLite adapters | 多数据库持久化 | 保留；测试不同 provider 的迁移与启动路径 |
| Radix Tabs/Tooltip/Select | 基础交互组件 | 已有使用价值；先盘点，不立即整体替换 |
| lucide-react | 图标 | 全站统一使用 |
| Three.js、skinview3d | 3D 角色预览 | 保留并针对披风、鞘翅、旋转和动作做回归 |
| Nodemailer | 邮件发送 | 保留并检查邮件发送错误、配置和限流 |
| vite-plugin-pwa | PWA 能力 | 保留并审计缓存更新、登录态页面缓存和离线行为 |
| Node 内建测试 | 当前 unit/integration/E2E 命令基础 | 先扩展现有测试，避免无必要地替换测试入口 |

### 13.2 package.json 中尚未直接声明、可优先评估的依赖

| 依赖候选 | 当前建议 | 理由 |
|---|---|---|
| React Hook Form | 优先评估 | package.json 未见声明，适合复杂登录、注册、管理员配置和投稿表单 |
| Zod | 优先评估 | package.json 未见声明，可统一 API 输入、表单、AI 参数和环境配置 schema |
| Mantine | 先做试点，不立即全面安装 | 当前已有 Radix；先比较组件覆盖、样式冲突、包体积和迁移成本，决定主体系后再推广 |
| Vitest + Testing Library | 按测试缺口评估 | 当前 scripts 使用 Node 内建测试；先确认现有测试是否难以覆盖组件交互 |
| Playwright | 按现有 E2E 缺口评估 | scripts 存在 test:e2e，但命令使用 Node test runner；先确认是否已有浏览器级测试，不要把它误认为真实浏览器 E2E |
| TanStack Query / Table / Virtual | 随素材库和后台页面落地时评估 | 当前 package.json 未见声明；先有真实列表、缓存或复杂表格需求再加入 |
| react-dropzone | 编辑器上传体验需要时评估 | 可复用拖放上传体验，但必须保留服务端文件校验 |
| react-markdown + isomorphic-dompurify | 社区支持 Markdown/富文本时评估 | 在确定内容模型与渲染策略后使用；避免危险 HTML/XSS |
| date-fns | 时间格式需求统一时评估 | 先确认当前代码是否已使用原生 Intl 或其他日期工具 |
| Recharts | 后台真实统计 API 准备后评估 | 不在真实数据接口前先做演示图表 |
| Sentry / Pino | 有隐私策略和运维方案后评估 | 先统一日志字段、脱敏和保留期限 |
| Redis / BullMQ | 暂缓 | 需先明确是否多实例、是否有独立 worker、队列失败恢复和 Redis 运维能力 |
| Sharp / 对象存储 SDK | 按实际上传和存储规模评估 | 不应为了缩略图直接覆盖原始 64×64 皮肤纹理 |

### 13.3 特别需要先澄清的架构事项

1. **Vite 与 Next.js 双入口：** 当前 package.json 同时存在 Vite build 与 Next.js build/start。新增 UI、表单和数据请求库前，必须明确哪些路由属于哪一个应用，以及 Docker/Zeabur 实际启动哪个入口。
2. **NextAuth 版本：** 当前声明的是 NextAuth 4 系列；新代码必须使用与实际安装版本兼容的 API，不可照抄其他主版本文档。
3. **E2E 名称：** 当前 `test:e2e` 使用 Node test runner 执行 `tests/e2e/*.test.mjs`，这不自动代表已配置浏览器驱动。应先检查测试内容，再决定是否引入 Playwright。
4. **数据库兼容：** 新 schema、限流、队列和后台查询必须考虑 PostgreSQL、MariaDB/MySQL 与 SQLite 的差异，不能只验证一种数据库。
5. **皮肤像素精度：** 图片缩略图/格式处理库不得介入原始纹理导出链路，除非有像素级测试证明不会改变尺寸、颜色和透明度。

### 13.4 建议的第一批实际接入范围

先不同时安装十几个库。建议第一批最多做三类工作：

- **表单和输入校验：** React Hook Form + Zod，前提是审计确认当前表单没有统一方案。
- **组件测试：** 先补现有 Node 测试；仅在 UI 行为难以覆盖时加入 Vitest + Testing Library。
- **浏览器回归：** 检查现有 E2E 内容；只有缺少真实浏览器交互验证时才加入 Playwright。

Mantine 主体系决策应单独完成试点和视觉验收，避免与认证修复、业务页面迁移同时大范围改动，增加故障定位难度。



---

# 原文：`docs/UI-FUNCTION-REFACTOR-PLAN.md`

> 原文件 Blob SHA：`a3336f257bc1985e78fd56d39a59fd1c10f041a0`

# CDPC 平台 UI 与功能全面重构实施文档

- **文档版本：** V1.0
- **规划日期：** 2026-10-23
- **项目名称：** CDPC
- **主仓库：** https://github.com/maoyiren/Pixcape
- **文档性质：** 产品需求、UI 设计规范、技术实施与验收基线
- **状态说明：** 本文档是实施基线，不代表所列功能已经全部实现或通过测试。

## 一、项目目标

CDPC 是面向 Minecraft 像素皮肤、服装饰品设计、搭配预览和原创素材分享的平台。本次工作不只是更换 UI 样式，而是统一全站导航、操作按钮、创作流程、衣服选装、3D 预览、AI 创作、素材社区和管理后台。

### 1.1 核心目标

1. 建立统一、专业、清晰、响应式的 CDPC 设计系统。
2. 使用 Mantine、Tailwind CSS v4 和 shadcn/ui，明确三者职责，避免重复实现同类组件。
3. 将「衣服选装」设置为独立一级功能，支持单件试穿、整套搭配、保存、编辑与导出。
4. 打通衣服选装与像素创作工坊，实现从选装到继续编辑的完整流程。
5. 保留并完善现有登录、注册、OAuth、保存、导入、导出和管理功能。
6. 统一 Next.js 主应用与 Vite 编辑器的界面风格、组件规则和响应式行为。
7. 优先复用现有业务逻辑，避免 UI 重构破坏已有功能。
8. 建立可验证的构建、功能、安全和发布验收标准。

### 1.2 设计原则

- 功能优先于装饰，不用无意义视觉元素填充页面。
- 一个区域只保留明确的主操作，次要操作进入菜单或工具面板。
- 所有可见按钮都必须有真实、明确的行为。
- 保存、下载、发布、分享是不同操作，不得混用。
- 服装分类、素材格式和导出兼容性必须明确。
- 桌面端与移动端共用设计规范。
- UI 重构不得擅自删除已有业务能力或绕过认证权限。
- 不将未实现的页面、假数据和演示按钮当成正式功能。

## 二、全站信息架构

### 2.1 一级导航

| 导航 | 路径建议 | 核心用途 |
|---|---|---|
| 首页 | `/` | 平台介绍、快捷入口、最近作品 |
| AI 生成 | `/ai` | 文本生成、图片生成皮肤 |
| 单品编辑器 | `/editor` | 原 Blockbench 编辑入口，像素编辑与模型预览 |
| 衣橱选装 | `/wardrobe` | 选择服装、搭配角色、保存穿搭 |
| 素材库 | 待核对现有路由 | 搜索和使用服装、配饰与模板 |
| 社区 | 待核对现有路由 | 浏览、发布、收藏、评论和分享 |
| 创作工作台 | `/workbench` | 最近作品、穿搭、AI 记录和账户入口 |
| 管理后台 | `/admin` | 仅授权管理员访问；分区 `/admin/audit`、`/admin/user`、`/admin/stat` |

正式路由约定：`/` 首页；`/ai` AI 生成；`/editor` 单品编辑器（原 Blockbench 编辑入口）；`/wardrobe` 衣橱选装；`/workbench` 创作工作台；`/creator` 创作者中心；`/admin` 管理后台。工作台内的快捷流程为 `/workbench/ai`、`/workbench/edit`、`/workbench/dress`，分别进入 AI 生成、单品编辑和衣橱选装。`/creator/:id` 用于展示通过审核的创作者公开资料。管理后台分区路由为 `/admin/audit`（审计日志）、`/admin/user`（用户列表）、`/admin/stat`（平台统计），每个分区必须在服务端执行管理员权限校验。旧 `/AI` 和 `/bench` 作为兼容入口重定向到小写规范路径；素材库和社区尚未确认有独立正式路由，因此不作为已上线入口展示。路由存在不等于底层功能全部完成，仍须验证实际编辑、生成、数据读写和权限。

### 2.2 全站顶栏

顶栏只保留 CDPC Logo、主要导航、全站搜索、语言切换、用户头像菜单，以及未登录时的登录/注册入口。用户菜单包括个人中心、我的作品、我的穿搭、我的收藏、账户安全和退出登录。只有服务端确认有管理员权限后，才显示管理后台入口。

不得把 PNG 导出、AI 生成、所有服装分类或管理员操作堆在全站顶栏；这些操作应放在对应页面内部。

### 2.3 全站页脚

统一包含品牌介绍、产品功能入口、帮助与使用指南、隐私政策、服务条款、社区规范、素材授权与版权说明、反馈入口及 Minecraft 非官方关联声明。页脚使用共享组件，不允许各页面分别维护不同版本。

## 三、UI 技术栈与组件治理

### 3.1 Tailwind CSS v4

负责页面布局、Flex/Grid、响应式断点、间距、尺寸、页面排版和设计 token 的使用。避免每个页面自行定义颜色、间距和字体规范。

### 3.2 Mantine

作为主要基础交互组件体系，优先用于按钮、输入框、文本域、选择器、复选框、开关、弹窗、抽屉、标签页、通知、加载覆盖层、Tooltip、Popover、表格、分页和设置面板。主题统一配置，避免页面大量覆盖默认样式。

### 3.3 shadcn/ui

作为精选补充来源，可用于 Command 命令面板、特定 Dropdown Menu 或确有价值的 Radix 交互组件。不把 shadcn/ui 全套与 Mantine 全套同时作为默认体系。所有补充组件都应与 CDPC 的主题、焦点、圆角、尺寸和状态保持一致。

### 3.4 组件治理原则

| 组件类别 | 默认方案 |
|---|---|
| 普通按钮与表单 | Mantine |
| 弹窗与抽屉 | Mantine |
| 页面布局 | Tailwind CSS v4 |
| 命令搜索面板 | 可使用 shadcn/ui |
| 全站导航 | 复用共享导航组件；交互控件优先 Mantine |
| 服装卡片 | Mantine `Card`、`Image`、`Badge`、`Checkbox`、`ActionIcon`、`Menu` 组合 |
| 3D 预览容器与控制栏 | Mantine `Paper`、`Group`、`ActionIcon`、`SegmentedControl`、`Tooltip`、`Menu`；渲染器沿用现有实现 |
| 像素画布外围 | Mantine `Paper`、`ScrollArea`、`Group`、`Tooltip`；绘图引擎沿用现有实现 |
| 编辑器工具栏 | Mantine `Group`、`Button`、`ActionIcon`、`SegmentedControl`、`Tooltip`、`Divider` 组合 |
| 属性面板与图层面板 | Mantine `Accordion`、`Tabs`、`Stack`、`NumberInput`、`ColorInput`、`Slider`、`Switch` |
| 状态提示 | 统一封装后的 Mantine `Alert`、`Notifications`、`LoadingOverlay` 等组件 |

同类业务组件只保留一个默认实现来源。开始迁移前盘点现有组件，能复用的先复用，不为单个组件问题引入重复的完整组件库。

### 3.5 全局设计规范

统一定义主色、辅助色、背景色、文字色、状态色、字体、字号、行高、圆角、阴影、边框、间距、按钮尺寸、表单状态、卡片密度、弹窗宽度及移动端行为。视觉方向采用简洁、偏工具型的像素创作平台风格，突出作品与角色预览，避免过度渐变、装饰性卡片和无意义的 AI 风格图形。

## 四、全站按钮与操作规范

### 4.1 按钮分级

- **主操作：** 每个主要内容区域原则上只有一个最突出的主操作，例如使用这套搭配、保存穿搭、导出 PNG、生成皮肤或发布作品。
- **次操作：** 预览、编辑、收藏、重命名、查看详情。
- **更多菜单：** 复制、下载其他格式、查看版本、移动到收藏夹、删除和举报。

危险操作不得与主操作使用相同的视觉权重。

### 4.2 按钮状态

适用的异步操作必须具有默认、加载中、成功、失败、禁用和权限不足状态。重复提交时防止重复保存、重复生成或重复发布。

### 4.3 操作语义

- **保存：** 保存到用户账户或当前草稿。
- **下载：** 下载到本地设备。
- **导出：** 按选定格式生成文件。
- **发布：** 提交到社区并应用公开范围。
- **分享：** 生成或打开分享入口。
- **使用素材：** 将素材载入当前选装或创作流程。
- **继续编辑：** 打开创作工坊并传入正确作品或穿搭数据。

这些操作必须有独立实现和结果提示。

### 4.4 危险操作

删除作品、删除穿搭、覆盖现有作品、取消发布等操作应明确显示对象和影响，必要时二次确认；完成后刷新相关状态；后端执行权限校验；管理后台重要操作记录审计信息。

## 五、独立一级功能：衣服选装

### 5.1 产品定位

衣服选装是 CDPC 的核心一级功能，不是简单的素材浏览页，也不是像素编辑器中的一个小标签。用户可以不懂像素绘画，直接使用现有服装素材搭配角色；需要时再进入创作工坊修改细节。

### 5.2 桌面端页面布局

**左栏：服装与素材**
- 分类、搜索、筛选、排序。
- 素材卡片网格。
- 已选、已收藏和不兼容状态。

**中栏：角色预览**
- Minecraft 风格 3D 角色。
- 360° 旋转、缩放和视角重置。
- 动作切换、背景切换、显示/隐藏单件服装。
- 截图或预览图生成。

**右栏：当前穿搭**
- 当前已选服装清单。
- 各分类已选素材。
- 单件替换、脱下。
- 兼容性与冲突提示。
- 保存穿搭、继续编辑、导出或应用穿搭。

三栏宽度应可在合理范围内调整；小屏幕通过抽屉或底部面板承载素材列表与属性面板。

### 5.3 服装分类

| 分类 | 定义 | 选装行为 |
|---|---|---|
| 上衣 | 基础上身服装 | 替换当前上衣 |
| 外套 | 叠加或替换式外层服装 | 按素材格式处理覆盖关系 |
| 裤子 | 腿部服装 | 替换当前裤子 |
| 鞋子 | 脚部服装 | 替换当前鞋子 |
| 帽子 | 头部装饰或服装 | 根据模型与格式适配 |
| 披肩 | 肩部或颈肩区域装饰 | 使用披肩对应素材与预览规则 |
| 披风 | 独立披风类饰品 | 使用披风对应模型、贴图和导出规则 |
| 其他配饰 | 后续扩展的饰品类型 | 按元数据和目标格式决定支持方式 |

**披肩、外套、披风不得在数据层合并成一个模糊分类。** 即使素材占用区域重叠，也必须保留独立分类、名称、预览配置和兼容性元数据。

### 5.4 核心交互

**单件试穿：** 点击素材后立即更新选择、角色预览和穿搭清单；展示加载、成功或不兼容状态；不强制跳转页面。

**替换和脱下：** 选择同类新素材时默认替换同类选项；脱下只移除对应项目；若有依赖关系则提示；不允许无提示覆盖不兼容素材。

**随机搭配：** 只从符合目标格式的素材中选择；尊重用户禁用分类；无可用素材时给出提示；不覆盖已保存穿搭；支持重新随机和恢复之前搭配。

**全部脱下与恢复默认：** 全部脱下清除当前临时搭配；恢复默认回到预定义的基础角色状态。对未保存修改提供保护，两种操作不可混为一个含义不清的按钮。

**保存穿搭：** 至少保存穿搭名称、封面、基础角色/皮肤引用、已选素材清单、各分类素材引用、必要版本标识、目标格式、兼容性状态、所属用户、可见性和创建/更新时间。保存时校验素材存在性、使用权限与组合兼容性。

**继续编辑：** 读取完整穿搭数据，验证素材引用和兼容性，将作品、贴图、分类和目标格式传入创作工坊，保留原穿搭，不静默覆盖原始数据。用户可选择更新原穿搭或另存为新版本。

### 5.5 素材冲突和兼容性

素材必须区分原版 Minecraft 皮肤 PNG、需要独立模型或运行环境支持的配饰、仅用于站内 3D 预览的素材、适用于特定模组或服务器的素材，以及需要转换的素材。

校验贴图尺寸与像素格式、模型结构、占用区域、叠加规则、素材许可、目标导出格式和运行环境兼容性。标准皮肤 PNG 并不天然支持所有独立披风、披肩或外套功能。不能直接合并的素材应明确提示可用的预览、保存或专用导出方式，不得假装所有服装都能合并成标准 PNG。

### 5.6 空状态与登录

未选择素材时显示默认角色、推荐素材、浏览素材库、随机搭配和创作新服装入口。可允许临时试穿；保存到个人账户时要求登录，并尽可能保留可恢复的临时状态。

## 六、创作工坊

### 6.1 定位

创作工坊用于从零设计、导入和修改皮肤或服装素材。衣服选装强调搭配，创作工坊强调编辑，两者使用不同的页面结构和操作流程。

### 6.2 顶部工具栏

建议顺序：返回、当前作品名称、撤销、重做、保存、导入 PNG、导出、更多操作。按钮根据作品状态决定是否可用。不要在顶栏重复放置所有全站导航和无关管理操作。

### 6.3 分类导航

包括皮肤、上衣、外套、裤子、鞋子、帽子、披肩、披风和其他配饰。每个分类必须映射对应数据模型、贴图区域与导出能力。

### 6.4 编辑器布局

**左侧工具栏：** 选择与移动、像素绘制、橡皮擦、填充、取色、图层操作、辅助线、对称绘制（仅在实现支持时显示）。

**中央区域：** 2D 贴图编辑、3D 角色预览、视角控制、缩放、动作切换、背景切换、画布与模型同步；明确显示当前编辑对象。

**右侧属性面板：** 颜色、工具参数、当前图层、素材属性、分类信息、兼容性提示和导出设置。面板随当前工具和对象动态变化，不始终展示大量无关参数。

### 6.5 导入、导出、撤销和重做

导入时校验类型与尺寸，提供预览，明确是否替换当前画布，并说明不兼容原因。导出时显示目标格式、尺寸、兼容性和文件用途；失败时保留编辑状态。仅在存在可撤销/重做操作时启用对应按钮；大型贴图操作要控制内存；保存和页面切换不应意外清空历史记录。

## 七、3D 角色与服装预览

### 7.1 预览能力

支持顺滑 360° 旋转、缩放、视角重置、前后左右和常用斜角视图、项目实际支持的站立/行走/奔跑/跳跃/飞行动作、多种背景、单件服装显示开关、选装前后对比和截图。

动作必须有真实动画实现；不能只添加没有效果的按钮。

### 7.2 控制体验

避免不必要的旋转阻尼，完整支持 360° 旋转，不能在 180° 附近卡住。明确区分相机旋转与模型变换；鼠标、触摸和键盘不能冲突；切换工具栏或动作时不应无故重置视角。

### 7.3 披风与鞘翅专项

验证披风贴图清晰度、模型位置、朝向与摆动方向、躯干和背部关系、鞘翅展开角度、飞行动作及不同视角下的穿模和遮挡。披肩和披风使用各自模型、贴图和动画配置，不能为代码复用而错误共享参数。

### 7.4 背景

提供浅色、深色和 Minecraft 风格环境背景。背景只影响预览环境，不改变贴图数据或导出文件。

## 八、AI 创作

### 8.1 页面与流程

提供文生皮肤、图生皮肤两个入口，共享一致的布局、生成状态、结果管理与错误处理。

**文本生成：** 输入描述 → 选择服务端实际可用模型 → 配置支持选项 → 提交任务 → 展示进度/状态 → 查看结果 → 进入创作工坊 → 下载、保存或另存为作品。

**图片生成：** 上传参考图 → 预览/替换/移除 → 检查大小和格式 → 选择可用模型 → 提交任务 → 展示状态 → 查看结果并继续编辑。

### 8.2 错误处理

API 不可用时给出明确提示；模型不可用时禁用选择；超时支持合理重试；防止重复任务；失败不丢失输入；不向普通用户暴露密钥或内部堆栈；记录必要的服务端日志。模型列表必须来自实际配置与服务端能力。

## 九、素材库

### 9.1 页面功能

提供搜索、分类、标签、作者、格式筛选、排序、素材卡片以及分页或合理的加载更多机制。

### 9.2 分类

基础皮肤、上衣、外套、裤子、鞋子、帽子、披肩、披风、其他配饰、整套穿搭、模板和编辑资源。

### 9.3 卡片和详情

卡片展示预览图、名称、分类、作者、兼容格式、必要授权信息和收藏状态。单件素材主操作为「使用素材」，整套穿搭为「预览搭配」，模板为「使用模板」，其他操作放入更多菜单。

详情页展示大图/3D 预览、名称、作者、分类、使用说明、兼容性、授权与署名要求、收藏、使用素材和适用的举报入口。

## 十、社区

### 10.1 首页

支持推荐、最新、热门、分类、标签、搜索。排序必须有真实的数据规则，不得只改变前端标签。

### 10.2 作品详情

展示作品预览、作者、说明、分类与标签、使用格式、收藏/点赞、评论、分享、举报，以及在授权与兼容时使用素材的入口。

### 10.3 发布流程

选择作品/穿搭 → 上传或生成封面 → 填标题与描述 → 设置分类和标签 → 检查授权与署名 → 选择公开范围 → 预览 → 发布或保存草稿。

保存草稿不等于发布；发布失败时保留草稿。

### 10.4 社区治理

用户只能管理自己有权操作的内容；评论、点赞、收藏应处理重复请求；举报进入审核流程；提供侵权内容处理机制；重要审核操作记录操作人与结果。

## 十一、个人中心

### 11.1 模块

个人资料、我的作品、我的穿搭、AI 生成记录、我的收藏、最近编辑、账户安全和登录方式管理。

### 11.2 作品和穿搭

作品支持打开、继续编辑、重命名、复制、下载/导出、删除和管理公开状态。穿搭支持预览、继续选装、编辑、复制、重命名、分享和删除。穿搭记录与单张皮肤贴图必须有类型区分。

### 11.3 账户安全

保持现有认证体系与会话行为兼容。GitHub、Google、Microsoft、Apple、邮箱等入口仅在真实配置可用时显示；未配置的提供商不能假装接通。

## 十二、管理后台

### 12.1 模块

| 模块 | 功能 |
|---|---|
| 系统总览 | 运行状态、关键统计、异常提示 |
| 用户管理 | 查询用户、账户状态和权限 |
| 角色权限 | 角色、权限分配和访问控制 |
| 素材管理 | 审核、分类、下架、授权信息 |
| 社区管理 | 作品审核、举报和评论治理 |
| AI 服务 | 模型状态、服务配置和错误统计 |
| 认证设置 | 登录提供商配置状态 |
| 系统设置 | 可安全修改的非敏感设置 |
| 操作审计 | 重要管理操作记录 |
| 健康检查 | 数据库、认证、AI 服务及关键依赖状态 |

### 12.2 安全要求

管理员权限必须在服务端校验；前端隐藏菜单不等于安全控制；密钥只能通过安全的服务端机制管理并在读取时脱敏；普通用户不能访问管理 API；不能通过客户端参数赋予管理员权限；关键操作记录审计日志；健康检查不得泄露数据库密码、完整环境变量或内部凭据。

将设置分为公开业务设置、管理员可维护的非敏感设置、必须通过部署环境或安全密钥系统配置的秘密、只读运行状态。不得把 OAuth Secret、数据库密码等暴露给浏览器。

## 十三、登录、注册与认证回归

UI 重构不得绕过现有 NextAuth 或其他已接入认证逻辑。必须检查登录/注册、邮箱验证、魔法链接、OAuth 回调、登录失败提示、受保护页面跳转、登录后返回原目标、退出登录与角色隔离。

对生产环境重点回归 GitHub 授权后返回 `cdpc.cc` 的 Access Denied 问题。核对 OAuth 应用配置、生产环境变量、回调 URL、账户绑定、用户权限和会话设置。仅修改按钮样式不能视为修复。

## 十四、响应式与无障碍

### 14.1 桌面端与平板端

桌面端采用稳定多栏布局，为画布与 3D 预览留足空间；长列表使用合理滚动区域。平板端允许收起次要侧栏，属性面板可使用抽屉，主要操作保持可见。

### 14.2 移动端

导航折叠为菜单或移动端导航；服装分类横向滚动或进入抽屉；选装列表和属性面板使用底部面板；3D 预览优先；避免按钮过小、横向溢出和弹窗越界；输入法打开时不遮挡关键操作；支持触摸旋转、缩放并处理手势冲突。

### 14.3 无障碍

交互按钮有可识别名称；表单错误与输入项关联；键盘可操作菜单、弹窗和主要功能；焦点状态清晰；颜色不作为唯一状态表达方式；弹窗合理管理焦点；适当支持减少动画偏好。

## 十五、数据模型与接口边界

本节为建议模型，实施前对照现有数据库和 API，优先扩展已有结构，避免重复建表。

### 15.1 素材

建议包含唯一标识、名称、描述、分类、作者、贴图/资源引用、模型引用（如适用）、目标格式、尺寸与格式元数据、兼容规则、授权信息、版本、审核状态、创建与更新时间。

### 15.2 穿搭

建议包含唯一标识、所属用户、名称、基础角色/皮肤引用、分类到素材的关联清单、预览图、目标格式、兼容性结果、可见性、版本信息和创建/更新时间。穿搭不能只保存在浏览器临时状态中，必须可持久化和恢复。

### 15.3 创作作品

区分作品类型、原始资源、当前编辑资源、版本历史（如支持）、目标导出格式、所属用户、保存状态和公开状态。

### 15.4 前后端职责

前端负责页面状态、选择与预览交互、表单反馈；服务端负责权限、素材使用权限、持久化、导出约束、公开范围、审计、敏感配置与可信兼容性判断。权限和最终导出校验不能只放在客户端。

## 十六、依赖、构建与部署

### 16.1 开发前检查

盘点根目录包管理器与锁文件、`ai-api` 的包管理器与锁文件、Next.js 应用结构、Vite 编辑器入口、Mantine 使用情况、Tailwind 版本、shadcn/ui 与 Radix 组件、全局 CSS/主题、Dockerfile、生产启动命令、CI 工作流、数据库迁移和运行时配置。

### 16.2 依赖治理

根项目与 `ai-api` 分别遵循已确定的包管理方式；不混用多个包管理器的锁文件；不为解决单个组件问题引入重复的完整组件库；依赖版本需与现有框架兼容；记录依赖新增、删除和升级原因。

### 16.3 构建要求

验证根项目和 `ai-api` 可按锁文件重复安装；Next.js、Vite、TypeScript、现有测试通过；Docker 镜像构建通过；容器启动命令符合生产架构；数据库迁移可执行；生产入口、环境变量和静态资源路径正确。

若 CI 或镜像发布因账户付款、预算限制或外部原因失败，应单独报告阻塞原因。代码构建通过不等于镜像发布成功。

## 十七、分阶段实施计划

### 阶段 0：现状审计

读取仓库结构与路由；清点组件和 CSS；核对依赖与锁文件；梳理登录、保存、导入、导出、AI 和社区功能；列出可复用模块与风险点。

**交付：** 现状清单、重复组件清单、依赖治理方案、路由映射表、功能回归基线。

### 阶段 1：统一设计系统

建立设计 token、配置 Tailwind CSS v4 和 Mantine 主题、选定少量 shadcn/ui 补充组件、建立共享组件、统一顶栏/页脚/移动导航。

**验收：** 新旧页面视觉统一；同类组件没有多套默认实现；构建正常；登录和导航不回退。

### 阶段 2：导航与基础页面

重构首页、登录注册、个人中心、页脚、搜索入口、空/加载/错误状态。

**验收：** 导航可达；用户菜单正确；权限页面受保护；桌面和移动端布局正常。

### 阶段 3：衣服选装

创建独立入口；建立分类、筛选和素材卡片；实现角色预览、单件试穿、替换、脱下、穿搭清单、兼容性提示、保存、恢复和继续编辑。

**验收：** 分类独立；选择素材能更新预览；不兼容素材不静默覆盖；穿搭可保存并重新加载；工坊接收正确数据；移动端可完成主要流程。

### 阶段 4：创作工坊与 3D

重组工具栏；优化 2D 画布与 3D 预览；整理属性面板；核对 PNG 导入导出；优化视角和动作；专项修复披肩、披风与鞘翅。

**验收：** 编辑能力不回退；撤销重做正确；导入导出行为明确；角色可完整旋转；受支持动作真实可用；专项预览测试通过。

### 阶段 5：AI 创作

统一文生与图生页面；接入真实模型配置；处理上传、生成状态、失败恢复和重试；将结果传入创作工坊。

**验收：** 仅可用模型能提交；失败不丢输入；不泄露密钥；结果可预览、编辑和保存。

### 阶段 6：素材库与社区

实现分类搜索、详情、使用素材、作品详情、发布草稿、收藏点赞评论和举报。

**验收：** 操作清晰；草稿与发布分离；服务端权限有效；授权和兼容性信息准确。

### 阶段 7：管理后台

整理后台导航、表格与筛选；完善用户/素材管理、AI 配置、认证状态、健康检查与审计。

**验收：** 非管理员无法访问管理 API；敏感配置脱敏；危险操作确认；关键操作可审计。

### 阶段 8：全量回归与发布

验证依赖安装、Next.js/Vite 构建、认证、选装、保存、导入导出、移动端、Docker、生产冒烟测试，并记录发布结果与剩余问题。

**验收：** 阻断问题有明确结论；镜像对应实际提交；生产站点确认加载新版本；未解决问题明确记录。

## 十八、测试矩阵

### 18.1 核心业务

| 测试项 | 通过标准 |
|---|---|
| 登录与注册 | 已配置的登录方式按预期工作 |
| GitHub OAuth | 回调正确，登录后会话与权限正确 |
| 保存作品 | 可持久化并重新加载 |
| PNG 导入 | 合法文件正确载入，错误文件有提示 |
| PNG 导出 | 格式、尺寸和内容符合声明 |
| 衣服选装 | 单件选择、替换和脱下正常 |
| 穿搭保存 | 保存后可恢复相同组合 |
| 兼容性检查 | 不兼容组合有明确提示 |
| 继续编辑 | 工坊接收正确作品与素材数据 |
| 3D 预览 | 旋转、缩放和已实现动作正常 |
| AI 生成 | 成功、失败、重试状态正确 |
| 社区发布 | 草稿、发布和权限逻辑正确 |
| 管理后台 | 角色权限和敏感操作校验正确 |

### 18.2 UI 测试

顶栏与页脚一致；按钮有明确行为；表单有验证和错误反馈；弹窗不超出视口；无意外横向溢出；选装页面三栏可在小屏幕折叠；工具栏不挤占画布；加载、空数据、失败状态完整；键盘焦点和触摸操作正常。

### 18.3 工程测试

锁文件一致且可重复安装；TypeScript 无新增错误；lint 与测试按项目配置执行；Next.js、Vite、Docker 构建通过；数据库迁移可执行；环境变量缺失时有明确诊断；CI 与镜像版本可追溯。

## 十九、交付物

1. 本文档与实际执行状态。
2. 路由与新信息架构对照表。
3. UI 组件清单及来源。
4. 全局设计 token 与主题配置。
5. 独立衣服选装页面。
6. 创作工坊与 3D 预览调整。
7. AI、素材库、社区和后台重构结果。
8. 认证与核心业务回归结果。
9. 根项目与 `ai-api` 依赖安装结果。
10. Next.js、Vite、Docker 构建结果。
11. PR、合并提交和镜像版本信息。
12. 未完成事项、外部阻塞和已知问题清单。

## 二十、完成定义

- [ ] 全站导航和页脚统一。
- [ ] Mantine、Tailwind CSS v4、shadcn/ui 职责明确。
- [ ] 没有无意义的重复组件体系。
- [ ] 衣服选装作为独立一级功能可用。
- [ ] 披肩、外套、披风等分类分别管理。
- [ ] 选装、保存穿搭和继续编辑形成完整流程。
- [ ] 创作工坊核心编辑功能没有回退。
- [ ] 3D 预览和实际支持的动作正常。
- [ ] AI 创作调用真实可用服务。
- [ ] 素材库与社区主要流程正常。
- [ ] 管理后台服务端权限校验有效。
- [ ] 已配置的登录方式通过回归测试。
- [ ] 根项目与 `ai-api` 可按锁文件重复安装。
- [ ] Next.js、Vite 和 Docker 构建通过。
- [ ] 生产环境完成冒烟验证。
- [ ] PR、合并状态和发布镜像有可核实记录。

**最终原则：** 先审计现有实现，再按最小风险逐步迁移；优先保留可用业务逻辑，不以单纯更换视觉样式作为完成标准。所有未实际实现、未测试或未发布的功能，都必须明确标记状态。


---

## 十四、实施进度记录（2026-10-24）

本节记录当前开发分支的真实状态，不代表尚未完成的功能已经交付。

### 14.1 已写入开发分支

- 建立独立实施分支：`feat/cdpc-full-ui-implementation`。
- 衣服选装使用现有 `skinview3d` 真实 3D 模型，不以 CSS 假人替代。
- 添加随机搭配，范围仅限当前已接入的披肩、外套和披风素材。
- 添加保存到当前设备、恢复本地穿搭和恢复默认角色；本地保存不等于账户云同步。
- 添加真实预览画布截图下载。
- 添加标准 64×64 皮肤 PNG 导出；独立披风不会伪装成可嵌入标准皮肤 PNG 的内容。
- 首页主操作优先进入衣服选装，导航加入账户快捷入口。
- 添加共享样式覆盖，统一首页、账户、创作者和管理页面的基础表面、按钮、表单及焦点状态。

### 14.2 尚未完成的主要工作

1. **组件库迁移：** 当前根项目没有安装 Mantine 或 Tailwind CSS v4；当前改动只完成共享 CSS 视觉收敛，不能称为 Mantine/Tailwind v4 迁移完成。必须先确定 Next.js 与 Vite 两个前端的依赖边界，再同步更新 package manifest 与锁文件。
2. **穿搭数据模型：** 当前已支持多套命名穿搭的浏览器本地保存、载入与删除；尚无账号云同步、封面、版本管理和跨设备恢复。
3. **编辑器交接：** 生产 Docker 镜像已将 Vite 工作台打包到 `/studio/`，未设置 `NEXT_PUBLIC_EDITOR_URL` 时，`/ai`、`/editor`、`/wardrobe` 默认进入同源工作台并传递 `mode`；如配置外部地址，仅允许 HTTPS（本地开发可用 localhost）。AI 入口已直达 AI 工坊，衣橱入口默认选中外套分类。向 Blockbench 的桥接目前导入合成皮肤 PNG，不代表完整图层/可编辑服装工程已可靠传输，仍需端到端验证。
4. **素材适配：** 当前可试穿的真实素材限于目录中已有的披肩、外套和披风。上衣、裤子、鞋子、帽子仍需接入经过验证的贴图及 UV 规则，不能显示虚构素材。
5. **3D 动作与披风专项：** 仍需验证动作切换、披风摆动方向、鞘翅位置、遮挡、纹理清晰度和各角度穿模。
6. **AI、素材库与社区：** 尚未完成端到端页面、真实后端能力、权限校验及错误状态的统一迁移。
7. **构建与发布：** 当前提交触发了 CI、Next.js Preview Build/Security 和 Docker 构建/发布工作流；需等待工作流结果。尚未人工运行测试，也尚未合并或确认新镜像发布。

### 14.3 本轮验收原则

- 以 GitHub 工作流结果和实际应用行为为准，不以按钮存在或页面渲染代替功能验收。
- 未接入的能力必须显示为未接入，不使用假数据或成功提示。
- 只有合并后确认 Docker 发布工作流成功，才将新镜像标记为已发布。


## 十五、后续实施进度（2026-10-24，阶段二与阶段三）

### 已写入代码（尚未等同于测试通过）

- [x] 增加穿搭 JSON 备份导出：包含可移植的穿搭项目 ID、角色模型、背景、名称，以及用户导入的 64×64 PNG 皮肤数据（仅当皮肤为本地 PNG Data URL 时）。
- [x] 增加穿搭 JSON 备份导入：校验格式版本、文件大小（最大 12 MB）、可识别素材 ID、背景颜色与皮肤 PNG 尺寸；导入后另存为一条本地穿搭，不直接覆盖已有存档。
- [x] 修正文案：标准皮肤 PNG 导出已存在，明确披风不包含在标准皮肤 PNG 中；账号云同步仍未接入。
- [x] 增强移动端素材卡片、操作按钮、预览区和穿搭管理面板的响应式布局及键盘焦点样式。
- [x] 在 Vite 创作工坊增加 CDPC JSON 穿搭备份导入，可映射现有披肩、外套、披风 ID，并恢复模型、背景和备份内的 64×64 PNG 皮肤；不支持的分类不会伪装成已接入素材。

### 仍需继续实现

- [ ] 选装结果与独立 Vite 编辑器之间的一键自动交接尚未完成；当前已提供 JSON 备份导出/导入的人工交接路径。
- [ ] Mantine + Tailwind CSS v4 的依赖、锁文件和组件级迁移；需要先核对当前包管理器及锁文件，不能仅修改依赖声明。
- [ ] 扩充并验证上衣、裤子、鞋子、帽子等真实素材目录；无素材的分类继续明确显示未接入。
- [ ] 披风/鞘翅动画、动作切换、账号云端穿搭、服务端素材管理与权限控制。
- [ ] 完整构建、浏览器回归、安全测试及生产镜像验证。当前这批提交未宣称通过测试。


## 二十一、阶段四实施记录（2026-10-24）

### 已提交到开发分支

- [x] 衣服选装页面新增“导出并前往创作工坊”入口：先下载标准 CDPC JSON 穿搭备份，再打开工坊入口；用户需在编辑器中手动选择备份文件，避免跨站自动传输或未经授权上传。
- [x] Next.js 选装页与 Vite 创作工坊采用相同的 `cdpc-outfit` v1 JSON 格式，编辑器支持导入已知披肩、外套、披风 ID、角色模型、背景色与可嵌入的 64×64 PNG 皮肤。
- [x] Vite 创作工坊增加反向 JSON 备份导出，便于在两套前端之间迁移当前搭配。
- [x] 工坊入口页说明文件交接步骤，并明确该过程使用本地文件，不等于账号云同步。

### 交接边界与注意事项

- 目前交接仍是“下载文件 → 在编辑器手动导入”，不是无文件的一键实时同步。
- 仅能恢复编辑器已知的素材 ID；未知 ID 会被忽略。缺少内嵌皮肤 PNG 时使用默认皮肤。
- 从远程来源加载的皮肤可能因浏览器跨域限制而无法嵌入导出文件；导出状态会提示用户另行保留原始皮肤 PNG。
- 上衣、裤子、鞋子、帽子尚未有验证过的真实素材和 UV 规则，仍不显示为可用假素材。
- 本阶段没有声明构建、浏览器回归或生产验证通过；仍需 CI 和后续测试确认。


### 15.2 阶段四补充（2026-10-24）

- [x] Vite 创作工坊增加穿搭 JSON 备份导出，使用与 Next.js 衣服选装一致的 `cdpc-outfit` v1 格式，包含已选披肩/外套/披风 ID、角色模型、背景色和皮肤名称。
- [x] 如果当前基础皮肤能安全绘制到本地 canvas，导出备份会嵌入 64×64 PNG；若远程图片受跨域限制，则仍导出穿搭数据并明确提示皮肤图片不会随文件迁移。
- [x] Vite 工坊已具备穿搭 JSON 导入与导出入口，支持通过文件完成选装页与工坊之间的人工数据交接；这不是自动跳转传参，也不是账号云同步。
- [ ] 需要在浏览器实际验证 JSON 往返、远程皮肤跨域行为、动作/披风纹理和不同模型下的合成结果；尚未宣称通过测试。


## 15.3 阶段四补充：导航、页脚与窄屏可用性（2026-10-24）

本轮在共享覆盖样式中补充了跨页面的导航和页脚适配：

- 小屏幕下一级导航改为可横向滚动的单行链接区，避免导航项挤压主品牌或账户入口。
- 账户名称限制最大宽度并显示省略号，避免邮箱或长用户名撑破导航。
- 为站点导航、账户链接和页脚链接统一补充键盘焦点可见样式。
- 页脚改为共享暗色工作台样式，并在窄屏下切换为单列布局；链接可换行。
- 动画过渡只作用于颜色属性，减少布局抖动；系统减少动态效果偏好仍由既有规则处理。

**边界与状态：** 这是 CSS 层面的响应式与可访问性补强，不代表 Mantine/Tailwind CSS v4 迁移已经完成，也不代表已在真实设备上完成视觉验收。当前尚未执行浏览器回归测试。

## 二十二、阶段一续：跨应用共享设计基础（2026-10-24）

本轮直接提交到 `feat/cdpc-full-ui-implementation`：

- `src/design-system.css` 增加共享语义样式原语：页面容器、面板、堆叠/横向组合、主/危险按钮、表单字段、统一间距、触控尺寸和焦点环。
- `app/layout.tsx` 引入同一份设计系统 CSS，使 Next.js 主应用与 Vite 编辑器共享同一组 CDPC token 和 opt-in 组件类。
- 新增类以 `cdpc-page`、`cdpc-panel`、`cdpc-control`、`cdpc-field` 等语义命名，采用渐进式迁移方式，不要求一次性重写所有现有业务页面。
- 补充窄屏触控尺寸和减少动态效果规则。

**边界与待办：** 这一步是共享设计 token 与样式原语，不等于 Mantine 或 Tailwind CSS v4 已安装，也不等于现有页面已经迁移到组件库。当前 `package.json` 与 `package-lock.json` 均未包含 Mantine / Tailwind CSS v4；不能仅编辑依赖清单宣称安装成功，后续需要在可执行 npm 安装与 lockfile 更新的环境中完成依赖迁移，并逐页面替换旧控件。当前尚未执行构建、浏览器或无障碍回归测试。

### 22.1 共享原语开始进入实际页面（2026-10-24）

- 账户页、创作者中心、登录页、创作工坊入口已采用共享 `cdpc-page` 页面容器和 `cdpc-panel` 面板语义类；创作工坊未连接时的提示卡也采用共享面板原语。
- 这是对真实页面的渐进式迁移，而非仅添加未使用的 CSS 类。现有业务 class 保留，降低改动对身份验证和表单行为的影响。
- 下一步继续逐个迁移导航、表单和按钮，检查旧 CSS 的优先级覆盖；之后再在可运行 npm 的环境里决定并完成组件库依赖安装。尚未执行构建或视觉回归。

## 二十三、阶段一续：开始在真实页面消费共享原语（2026-10-24）

本轮继续将共享设计基础用于页面，而不只保留为未使用的 CSS：

- 首页 `app/page.tsx`：主容器接入 `cdpc-page`；首页主操作、次操作、功能卡链接和账户快捷入口接入共享控制样式。
- 创作工坊入口 `app/studio/page.tsx`：页面容器、顶部栏、主内容面板及主要操作接入共享页面/面板/按钮语义类。
- 既有业务类仍保留，避免在本轮一次性删除原样式造成页面大面积回归；后续按页面逐步去除重复定义。
- 本轮没有安装新依赖，也没有改动认证、数据库或导出逻辑。构建与视觉回归尚未运行，因此仍需后续验证新旧 CSS 叠加后的实际效果。

## 二十三、阶段一续：登录与创作者表单渐进式迁移（2026-10-24）

- 登录/注册入口所用的认证表单控件开始采用共享 `cdpc-input`、`cdpc-control`、`cdpc-control-primary` 语义类；早期方案曾保留普通用户/管理员切换；后续已统一为用户名或邮箱单输入框，当前实现以第二十五节为准。
- 创作者申请表单开始复用共享输入控件和间距原语；原有 Server Action、字段限制与审核流程不变。
- 创作工坊入口与登录页继续使用共享 `cdpc-page` / `cdpc-panel` 页面布局类。
- 本轮只调整呈现层 className 与共享 CSS，没有改动认证 provider、回调地址、数据库查询或权限逻辑。

**尚未完成：** 仍未完成 Mantine/Tailwind CSS v4 安装及 lockfile 更新，也没有执行 TypeScript、Next build、Vite build 或浏览器回归；当前是渐进式语义样式迁移，不能宣称组件库迁移或功能验收完成。

## 二十四、阶段一续：账户与创作者页面采用共享原语（2026-10-24）

继续将共享设计原语接入实际页面：

- 登录页：共享顶部栏、返回操作、面板与纵向间距。
- 注册页：共享页面容器、顶部栏、返回操作和内容面板。
- 账户页：共享顶部栏与账户/创作者入口操作。
- 创作者中心：共享顶部栏、返回操作及申请提交主操作。
- 仅增加语义类，保留原页面逻辑、表单校验、认证与权限判断；本轮没有更改登录流程或服务端行为。

尚未完成：旧式 `pixel-button`、`inventory-panel` 等样式尚未彻底移除，CSS 仍有渐进迁移期间的新旧规则叠加。后续应继续统一输入框和表单状态，再针对窄屏、键盘操作和页面视觉进行回归检查。当前仍未运行构建或浏览器测试。

## 二十四、阶段一续：注册与账户操作控件（2026-10-24）

- 注册页姓名、邮箱、密码输入框接入 `cdpc-input`；注册按钮接入共享主按钮样式。
- 退出登录按钮接入共享控件样式。
- 保留 React Hook Form、Zod 校验、密码长度限制、注册 API、NextAuth 登出回调与现有权限边界。
- 这轮是实际页面逐步采用共享语义类，不触碰登录流程与服务端行为。

组件库依赖和锁文件仍未迁移；尚未执行构建与浏览器验收，继续按“先完成主要代码，再统一验证”的顺序推进。

## 二十五、登录入口统一：邮箱/用户名单框登录（2026-10-24）

- 按产品要求移除“普通用户 / 管理员”切换按钮，不再要求用户先选择账户类型。
- 登录表单统一为“用户名或邮箱地址”输入框与密码输入框。
- 输入值包含 `@` 时使用普通用户邮箱密码 provider，登录成功后进入 `/account`；否则在管理员登录已启用时使用配置的管理员用户名 provider，成功后进入 `/admin`。
- 为避免一次错误登录触发两次凭据校验和两次限流计数，按标识符类型只请求对应 provider；管理员权限仍只由服务端 provider 决定，前端不授予权限。
- 第三方 OAuth 与邮箱魔法链接入口保留不变。

**未验证事项：** 代码已提交，但尚未运行构建或真实登录回归；需要验证普通邮箱、管理员用户名、错误凭据、管理员未配置以及第三方登录场景。



## 二十六、生产文案与账户界面一致性（2026-10-24）

本轮已提交到 `feat/cdpc-full-ui-implementation`：

- 登录页保持单一用户名/邮箱入口，说明聚焦登录方式和账户权限，不引导用户选择账户类型。
- 注册页改为简洁的邮箱、密码要求和账户权限说明；错误提示以用户可执行的下一步为中心。
- 个人中心明确展示登录账户、账户类型和账户状态，未知状态不再显示含糊的“未知”。
- 创作者中心统一申请状态、审核提示和资料填写说明。
- 创作工坊入口描述实际 JSON 文件交接步骤，明确本地文件边界。
- 首页功能卡片围绕用户任务组织，避免用内部实现状态作为主要卖点。
- 管理后台健康检查说明轻量探测范围，避免将可达性检测表述成完整服务验证。
- 在共享设计系统中补齐账户页表单间距、输入状态、成功/错误反馈和移动端操作按钮换行规则。

### 本轮未完成的验收项

- 尚未执行安装依赖、生产构建、浏览器视觉检查或登录回归测试。
- Mantine 与 Tailwind CSS v4 的正式依赖迁移仍未开始；现阶段是共享语义 CSS 的渐进迁移。
- 账户中心仍是账户资料视图，作品、穿搭云端同步与账户安全管理等功能必须在后续接入真实数据后才能作为正式能力展示。


## 二十七、注册后创作引导与当前验证记录（2026-10-24）

### 已提交的注册体验

- 未开启邮箱验证时，注册 API 返回 `requiresVerification: false`；前端使用 `email-password` provider 自动登录，成功后进入 `/workbench` 并刷新会话。
- 开启邮箱验证时，注册页展示验证提示，不尝试自动登录或绕过邮箱验证。
- 自动登录失败时保留账户并提示用户前往登录，不会把注册成功误报成失败。
- 修复注册页未初始化 `useRouter` 导致的 TypeScript 构建错误，修复提交：`4a5fa0daa9604eec87450a924af09d1bd813b6e0`。

### 最近一次代码提交的 CI 结果

针对代码提交 `4a5fa0daa9604eec87450a924af09d1bd813b6e0` 的 GitHub Actions 检查结果：

- [x] CI build 成功。
- [x] Next.js Preview Build / Security Tests 成功。
- [x] Playwright 浏览器回归 5 项通过。
- [x] Docker smoke-test 成功，运行时启动检查覆盖 PostgreSQL、MySQL、SQLite。
- [ ] Docker 镜像发布未执行：PR 触发的 workflow 将 publish job 跳过，因此不能据此声称新镜像已发布。
- [ ] PR #20 仍为 Draft、未合并；生产 OAuth、SMTP 与真实部署行为仍需部署后验收。

后续文档变更会触发新一轮 CI；最终以最新 PR head 的 workflow 结果为准。以上结果只代表该代码提交的自动化检查，不代表所有规划功能已完成，也不代表生产站点已更新。

## 二十八、管理后台重构规范：WordPress 经典后台交互（2026-10-25）

> 本节是 CDPC 管理后台的产品与工程实施基线。这里描述的是目标行为，不代表所有路由或功能已实现。实施前必须核对现有 Next.js 路由、认证、Prisma Schema 和已有管理页面，优先复用现有实现，避免重复建表或破坏生产数据。

### 28.1 目标与技术决策

管理后台采用 WordPress `wp-admin` 的经典 CMS 交互模型：固定可折叠的左侧导航、顶部 Admin Bar、面包屑、页面标题与主操作、Notice 通知、筛选和搜索、批量操作、列表分页、分组表单及简洁页脚。

CDPC 继续使用项目现有的 Next.js / TypeScript / 认证与数据库技术栈，不为模仿 WordPress 而引入 PHP。后台以服务端渲染和完整页面导航为主；主导航使用普通链接发起完整页面请求，不将管理后台实现为以客户端路由切换为核心的 SPA。允许在确有价值的局部交互中使用客户端组件，但不得改变经典后台的页面跳转和表单提交语义。

### 28.2 统一后台外壳

所有 `/admin/*` 页面共享一个 Admin Layout，至少包含以下区域：

1. **顶部 Admin Bar：** CDPC 品牌入口、查看站点、通知入口、当前管理员头像/用户名和账户菜单。账户菜单包含个人资料、安全设置及退出登录。
2. **左侧固定导航：** 桌面端约 230px 宽，可折叠为图标栏；当前一级/二级菜单有明确选中状态；支持二级菜单展开；折叠状态通过 Cookie 等服务端可读取的方式保留。
3. **面包屑：** 根据路由生成，例如“管理后台 > 审核中心 > 作品审核”。面包屑不取代页面标题。
4. **页面头部：** 页面标题、简短说明和最多一个明确的主操作，例如“新增作品”。
5. **Notice 区：** 成功、警告、错误和普通提示；表单校验错误应关联到对应字段；重要错误不能只靠颜色表达。
6. **主体内容：** 按页面类型使用统一列表、详情、表单或仪表盘模板。
7. **页脚：** CDPC 版权、应用版本和必要的环境信息；不得泄露密钥或内部部署细节。

桌面端保持固定侧栏与内容区；移动端侧栏改为可关闭抽屉，确保表格、表单、弹窗和主要操作不发生横向溢出。所有后台页面共享相同的主题、字体、间距、焦点状态和按钮规则。

### 28.3 完整后台路由清单

以下为目标路由。落地时需与仓库已有路径对照；已有路径如 `/admin/user`、`/admin/stat` 应优先通过兼容别名、重定向或逐步迁移处理，不得造成旧链接无故失效。

| 模块 | 路由 | 用途 |
|---|---|---|
| 仪表盘 | `/admin` | 后台默认首页、核心指标和待办 |
| 运营统计 | `/admin/stat` | 平台整体运营指标 |
| AI 统计 | `/admin/stat/ai` | 生成量、成功率、模型用量与错误率 |
| 创作者统计 | `/admin/stat/creators` | 注册、活跃与作品贡献 |
| 内容统计 | `/admin/stat/content` | 发布、收藏、下载及审核趋势 |
| 作品管理 | `/admin/posts` | 全部作品、搜索、筛选、排序和批量操作 |
| 新增作品 | `/admin/posts/new` | 创建后台作品或素材条目 |
| 作品详情 | `/admin/posts/[id]` | 作品详情、作者、状态和关联素材 |
| 编辑作品 | `/admin/posts/[id]/edit` | 修改作品元数据与发布状态 |
| 待处理作品 | `/admin/posts/pending` | 待审核/待发布快捷列表 |
| 作品回收站 | `/admin/posts/trash` | 恢复或永久删除作品 |
| 分类标签 | `/admin/taxonomy` | 作品分类、标签管理 |
| 素材库 | `/admin/media` | 素材网格/列表、搜索和筛选 |
| 上传素材 | `/admin/media/upload` | 上传并校验素材文件 |
| 素材详情 | `/admin/media/[id]` | 文件信息、尺寸、格式、来源及引用 |
| 编辑素材 | `/admin/media/[id]/edit` | 修改标题、说明、分类和授权信息 |
| 素材回收站 | `/admin/media/trash` | 恢复素材或执行受控删除 |
| 创作者管理 | `/admin/users` | 用户及创作者查询、状态管理 |
| 新增账号 | `/admin/users/new` | 管理员创建账号或发送邀请 |
| 用户详情 | `/admin/users/[id]` | 资料、作品、任务和账号状态 |
| 编辑用户 | `/admin/users/[id]/edit` | 修改允许由管理员维护的资料 |
| 角色权限 | `/admin/users/roles` | 角色与授权策略 |
| 创作者列表 | `/admin/users/creators` | 创作者专属筛选视图 |
| 受限账号 | `/admin/users/suspended` | 已停用或受限制账号 |
| 审核总览 | `/admin/audit` | 待处理数量、队列与审核统计 |
| AI 内容审核 | `/admin/audit/ai` | AI 生成内容审核 |
| 作品审核 | `/admin/audit/posts` | 披肩、披风、皮肤、服装作品审核 |
| 搭配审核 | `/admin/audit/wardrobe` | 衣橱搭配审核 |
| 举报投诉 | `/admin/audit/reports` | 举报、版权和侵权投诉 |
| 审核历史 | `/admin/audit/history` | 审核决定、理由和操作人记录 |
| AI 总览 | `/admin/ai` | AI 服务状态与整体配置入口 |
| 服务商设置 | `/admin/ai/providers` | AI 服务商列表与连接状态 |
| 服务商详情 | `/admin/ai/providers/[id]` | 编辑单一服务商的安全配置 |
| 模型管理 | `/admin/ai/models` | 模型能力、默认值和启用状态 |
| 生成配额 | `/admin/ai/quotas` | 全站、用户及创作者生成限制 |
| 生成任务 | `/admin/ai/tasks` | 任务状态、失败原因与受控重试 |
| AI 调用日志 | `/admin/ai/logs` | 延迟、错误、模型和用量诊断 |
| 衣橱搭配 | `/admin/wardrobe` | 全部搭配和状态管理 |
| 搭配详情 | `/admin/wardrobe/[id]` | 查看搭配内容与作者 |
| 编辑搭配 | `/admin/wardrobe/[id]/edit` | 修改搭配元数据和可见性 |
| 推荐搭配 | `/admin/wardrobe/featured` | 管理首页推荐 |
| 搭配分类 | `/admin/wardrobe/categories` | 分类和标签管理 |
| 设置总览 | `/admin/settings` | 配置入口和运行状态 |
| 常规设置 | `/admin/settings/general` | 站点名称、Logo、语言等 |
| AI 设置 | `/admin/settings/ai` | 默认模型与 AI 行为策略 |
| 上传限制 | `/admin/settings/uploads` | 文件类型、大小和上传策略 |
| 安全设置 | `/admin/settings/security` | 会话、安全策略和限流参数 |
| 权限策略 | `/admin/settings/permissions` | 角色与操作权限 |
| 邮件设置 | `/admin/settings/email` | SMTP 状态及邮件策略 |
| 登录集成 | `/admin/settings/integrations` | OAuth 提供商配置状态 |
| 存储设置 | `/admin/settings/storage` | 存储后端与资源状态 |
| 维护模式 | `/admin/settings/maintenance` | 维护开关与维护提示 |
| 健康检查 | `/admin/system/health` | 数据库、AI、存储、邮件等依赖状态 |
| 后台任务 | `/admin/system/jobs` | 队列和失败任务 |
| 系统日志 | `/admin/system/logs` | 受控查看应用错误摘要 |
| 操作审计 | `/admin/system/audit-log` | 管理员重要操作记录 |
| 管理员资料 | `/admin/profile` | 当前管理员资料 |
| 管理员安全 | `/admin/profile/security` | 密码、会话和安全设置 |

路由表是目标范围，并非要求一次性生成大量空白页面。每个已开放路由必须连接真实数据或明确显示“尚未接入”，不得用演示数据冒充生产能力。

### 28.4 菜单结构与业务分类

主菜单顺序建议为：仪表盘、作品管理、素材库、创作者管理、审核中心、AI 生成、衣橱搭配、系统设置、系统工具。当前模块默认展开二级菜单；未授权用户不能通过直接访问 URL 或后台 API 绕过权限。

作品类型至少区分皮肤、上衣、外套、裤子、鞋子、帽子、披肩、披风、其他配饰和衣橱搭配。**披肩、外套、披风是独立业务分类**，应保留各自的模型、贴图、预览和导出兼容性元数据，不能因为视觉上相近而在数据层合并。

### 28.5 仪表盘与统计口径

`/admin` 默认显示以下指标：今日 AI 生成任务、新增作品、注册创作者、待审核数量，以及近期趋势和最近待处理事项。指标必须来自真实数据库或可验证的服务端统计；尚未接入的指标显示“未接入”，不能填入静态数字。

每个指标应明确统计时间范围、时区、状态口径和数据来源。AI 生成任务数量不能等同于成功生成数量；创作者数应遵循实际账号/角色规则；待审核数应基于当前待处理状态，而非历史总量。统计查询需分页或聚合，避免在请求首页时读取全部业务记录。

### 28.6 WordPress 风格列表页规范

作品、素材、用户、审核和 AI 任务列表共用统一列表组件：

- 页面标题与主操作位于顶部；标题下可放说明与 Notice。
- 支持搜索、状态筛选、类型筛选、排序、分页和批量操作。
- 默认每页 20 条；允许在合理范围内切换每页数量。
- 搜索、筛选和分页条件写入 URL 查询参数，刷新或复制链接后可恢复。
- 表格提供明确的空状态、加载状态、错误状态和无搜索结果状态。
- 每行操作包含查看、编辑以及符合权限的其他动作；危险操作放入独立菜单。
- 批量操作仅作用于明确选择的记录；跨页全选必须明确告知范围。
- 保存、审核或删除后使用服务端重定向及 Notice 反馈，避免刷新导致重复提交。
- 批量操作允许部分失败，必须展示成功数、失败数和每条失败原因。

批量审核需要验证每条记录当前状态、操作者权限和业务规则；批量驳回必须要求理由；删除优先进入回收站；永久删除应单独授权并再次确认。

### 28.7 WordPress 风格表单与 Notice

表单采用分组面板：基础信息、分类与状态、文件/素材、版权授权、发布选项和高级设置（仅适用时显示）。每个字段有标签、必要时有说明、服务端校验和可读错误。保存、取消、预览和危险操作的视觉优先级必须明确。

Notice 类型：
- **成功：** 操作已完成，说明结果。
- **警告：** 操作完成但有注意事项，或配置尚未生效。
- **错误：** 保存/操作失败，保留输入内容并提供可执行的下一步。
- **信息：** 解释功能限制、兼容性或待配置状态。

Notice 不能掩盖字段级错误；重要状态不能仅依赖颜色；任何成功提示都必须由真实服务端结果触发。

### 28.8 权限与安全边界

当前角色基线：

| 角色 | 权限 |
|---|---|
| 游客 | 仅可访问公开前台内容，不可进入管理后台 |
| 注册用户/创作者 | 使用授权的前台创作、作品和衣橱功能，只能管理自己有权操作的资源 |
| 管理员 | 可访问已授权的管理后台功能 |

CDPC 采用“注册即创作者”的产品方向：普通注册不需要额外申请创作者身份；管理员权限必须通过可信的管理流程授予，不能由用户自助升级。

安全规则：
1. 每个管理页面在服务端验证登录状态与管理员角色；未登录按既有认证策略引导登录，已登录但非管理员返回 403。
2. 所有管理 API、Server Actions 和写操作独立执行授权，不依赖前端菜单隐藏。
3. 验证资源归属、角色授权、CSRF 防护、输入参数和状态转换。
4. 管理员不得通过修改 URL 或提交其他用户 ID 访问无权资源。
5. 角色变更、封禁、删除、审核、密钥变更和配额变更写入审计记录。
6. 健康检查与日志不能返回完整环境变量、密码、Token、OAuth Secret 或数据库连接凭据。
7. 对管理员会话、限流和高风险操作应用项目现有安全策略，不另建互相冲突的认证体系。

### 28.9 AI 与系统配置中心

后台配置分为三类：

**A. 可动态维护的业务配置：** 默认 AI 模型、启用状态、生成配额、上传限制、站点展示设置、审核策略等。写入数据库或现有持久化配置层，并明确生效时间。

**B. 敏感凭据：** AI API Key、SMTP 密码、OAuth 客户端密钥等。通过服务端加密或现有密钥管理机制保存；页面只显示掩码，修改需重新输入；日志中不得记录明文。提供连接测试时必须在服务端执行。

**C. 部署级配置：** 数据库连接、认证加密密钥、基础 URL、端口等。继续由环境变量或部署密钥管理；后台可以显示只读状态和配置来源，但不能把任意键值写入运行中进程环境并声称已持久化。

配置详情至少显示配置来源、是否生效、是否需要重启、最后修改人和时间。对支持的配置提供安全回滚。环境变量强制覆盖的值应标记为只读并解释来源。修改 AI 配额必须具备审计和一致性保护，避免重复扣减或越权修改。

### 28.10 建议数据实体（实施前核对现有 Schema）

| 实体/模型职责 | 关键要求 |
|---|---|
| User、Role、Permission | 复用现有认证用户与权限模型；管理员权限服务端授予 |
| Post/现有作品模型 | 作者、类型、标题、发布状态与时间 |
| MediaAsset | 存储键、MIME 类型、大小、来源、授权和引用 |
| Category、Tag | 可复用分类标签，不按显示名关联 |
| ReviewRecord | 目标对象、决定、理由、审核人、时间；保留历史 |
| Wardrobe | 搭配数据、作者、可见性和素材引用 |
| AIProviderConfig、AIModelConfig | 配置状态、模型能力与安全凭据引用 |
| AITask | 任务状态、模型、耗时、错误摘要和关联用户 |
| UsageLedger | 配额扣减、退款/冲正和防重复处理记录 |
| SiteSetting | 可安全动态修改的业务设置 |
| AdminAuditLog | 操作人、动作、目标对象、结果、时间和必要上下文 |

这张表是逻辑模型建议，不代表必须新建同名表。开发前先检查 Prisma Schema 和已有服务，优先扩展现有结构，采用迁移脚本和可回滚部署流程，保护现有数据。

### 28.11 页面与代码组织建议

按仓库实际 App Router 结构落地，可采用以下组织方向：

```text
app/admin/
  layout.tsx
  page.tsx
  posts/
  media/
  users/
  audit/
  ai/
  wardrobe/
  settings/
  system/
  profile/

components/admin/
  admin-bar
  admin-sidebar
  admin-breadcrumbs
  admin-notice
  admin-page-header
  admin-list-table
  admin-list-filters
  admin-pagination
  admin-form-section
  admin-confirm-dialog

lib/admin/
  authorization
  audit
  settings
  pagination
  validation
```

这是组织建议，不是要求机械创建全部目录。Mantine 作为主要交互组件来源，Tailwind CSS v4 负责布局和设计 token，shadcn/ui 仅在明确需要时作为补充；避免同类组件维护两套完整实现。必须先检查现有依赖与锁文件，不能只修改 package manifest 就宣称依赖安装成功。

### 28.12 页面跳转、提交与状态恢复

- 主导航和面包屑使用标准链接，点击后执行完整页面导航。
- GET 请求用于搜索、筛选、排序和分页，状态放在 URL 查询参数中。
- 修改操作通过已验证的 Server Action 或服务端 POST 处理；根据项目架构统一选型。
- 成功提交后使用 Post/Redirect/Get，防止浏览器刷新重复提交。
- 侧栏折叠状态可使用 Cookie 持久化；筛选状态以 URL 为准。
- 局部交互可使用客户端组件，但不得将客户端状态当作权限或持久化依据。

### 28.13 实施顺序

1. **审计阶段：** 核对现有路由、认证、Prisma Schema、管理 API、UI 组件和部署约束，列出复用、冲突与缺失项。
2. **后台骨架：** 建立共享 Admin Layout、侧栏、Admin Bar、面包屑、Notice、列表与表单原语；补齐服务端权限守卫。
3. **第一条真实业务链：** 完成作品列表、详情、编辑、审核、审计记录的端到端流程。
4. **创作者与素材管理：** 接入真实用户和素材数据、回收站、分类、版权与资源引用保护。
5. **配置中心：** 实现 AI 配置持久化、密钥脱敏、配额、配置来源和生效状态。
6. **衣橱与运维：** 补齐搭配管理、健康检查、日志、后台任务和统计。
7. **验收与发布：** 执行构建、自动化测试、权限与安全回归、Docker 验证；确认最新提交的 CI 与发布结果后再宣称交付。

各阶段可先完成代码再集中测试，但不能将未测试功能标记为已验证。路由存在、页面能渲染或按钮可点击都不等同于业务链已完成。

### 28.14 管理后台验收清单

- [ ] 所有后台页面共享统一 Admin Layout，菜单与面包屑正确。
- [ ] 桌面端侧栏固定可折叠，移动端抽屉可用，状态可恢复。
- [ ] 页面主导航采用完整页面导航，不依赖 SPA 路由切换。
- [ ] 列表支持真实搜索、筛选、排序、每页 20 条分页及批量操作。
- [ ] 表单包含服务端校验、字段错误、Notice 和重复提交保护。
- [ ] 游客和创作者无法访问管理页面及管理 API；越权写入被拒绝。
- [ ] 作品、素材、披肩、外套、披风和衣橱搭配按正确类型管理。
- [ ] 审核决定保留理由、操作人、时间和历史记录。
- [ ] AI 配置能安全持久化；密钥脱敏；环境变量覆盖状态可见。
- [ ] 删除、角色变更、配额和敏感配置变更有审计记录。
- [ ] 健康检查与日志不泄露秘密；失败状态真实反映服务结果。
- [ ] 现有登录、OAuth、用户数据、编辑器和业务 API 未被破坏。
- [ ] Next.js、Vite、数据库迁移和 Docker 构建按项目要求完成验证。
- [ ] 最新 PR/提交的 CI 结果、合并 SHA 与镜像发布状态可追溯。

**本节完成定义：** 本文档为目标规格；只有相应功能实际实现并通过对应验收后，才能把检查项标记为完成。未接入的页面或服务必须显示明确状态，不允许用静态数字、假成功提示或无操作按钮代替正式功能。

## 二十九、页面结构、组件复用与全站术语规范（2026-10-25）

### 29.1 组件策略：不再新建重复的 CDPC 通用 UI

CDPC 的业务界面优先通过现有组件库组合实现，不再为 3D 预览控制条、服装卡片、像素画布外围和编辑器工具栏重复实现按钮、提示、菜单和分段选择器。

| 区域 | 默认组件组合 | 保留的专用能力 |
|---|---|---|
| 3D 预览区 | Mantine \`Paper\`、\`Stack\`、\`Group\`、\`ActionIcon\`、\`SegmentedControl\`、\`Tooltip\`、\`Menu\` | 现有 skinview3d、模型渲染、相机控制、动画与贴图合成 |
| 像素画布区 | Mantine \`Paper\`、\`ScrollArea\`、\`Group\`、\`Tooltip\`、\`ActionIcon\` | 现有绘图、坐标映射、缩放、选区、像素精度与撤销历史 |
| 服装素材卡片 | Mantine \`Card\`、\`Image\`、\`Badge\`、\`Checkbox\`、\`ActionIcon\`、\`Menu\` | 真实素材缩略图、分类、兼容性和授权信息 |
| 编辑器工具栏 | Mantine \`Group\`、\`Button\`、\`ActionIcon\`、\`SegmentedControl\`、\`Tooltip\`、\`Divider\` | 连接现有编辑器命令与状态 |
| 属性与图层面板 | Mantine \`Tabs\`、\`Accordion\`、\`Stack\`、\`NumberInput\`、\`ColorInput\`、\`Slider\`、\`Switch\` | 现有图层数据、素材属性、UV 与格式校验 |
| 页面布局 | Tailwind CSS v4 的容器、Grid/Flex、断点和间距 | 页面信息架构，不承担业务状态 |
| 特殊补充交互 | 仅在 Mantine 不适合时按需选 shadcn/ui | 不复制 Mantine 已有的默认组件 |

组件名称须按仓库实际安装版本核对；如版本不支持，应选同库等价组件，不要为单个控件引入整套新库。Mantine 负责通用 UI，Tailwind 负责布局，shadcn/ui 只作补充。3D 渲染器和像素画布是功能引擎，不因复用 UI 库而替换或伪造。

### 29.2 正式页面与路径命名

| 正式中文名 | 正式路径 | 页面目标 | 统一规则 |
|---|---|---|---|
| 首页 | \`/\` | 介绍平台并引导进入创作 | 不称为工作台 |
| AI 生成 | \`/ai\` | 文生皮肤、图生皮肤、管理生成结果 | 统一使用小写路径，避免大小写冲突 |
| 单品编辑器 | \`/editor\` | 精细编辑皮肤/贴图、查看模型、导入导出 | “Blockbench 编辑入口”可作说明，不替代页面名称 |
| 衣橱选装 | \`/wardrobe\` | 试穿、搭配、保存穿搭、继续编辑 | 与单品编辑器分开；披肩、外套、披风分别定义 |
| 创作工作台 | \`/workbench\` | 进入 AI、编辑器和衣橱选装流程 | 不与公开的创作者中心混称 |
| 创作者中心 | \`/creator\` | 公开创作者资料与创作者相关设置 | 不等于创作工作台 |
| 素材库 | 待核对 | 搜索、筛选、查看授权并使用素材 | 不暗示素材一定可交易 |
| 社区 | 待核对 | 浏览、发布作品、互动和举报 | 不与纯素材库混称 |
| 管理后台 | `/admin` | 系统配置、审核、权限与审计 | 仅展示给授权管理员；分区为 `/admin/audit`、`/admin/user`、`/admin/stat` |

旧路径如 \`/studio\`、\`/dress-up\`、\`/account\` 若需保留，只作为兼容入口并指向明确的正式路径。当前通过 rewrite 进入共享 studio 的方案必须验证 mode 真正传递到目标编辑器；URL 可访问不代表模式功能已完成。

### 29.3 全站按钮词汇表

| 中文用词 | 英文建议 | 使用规则 |
|---|---|---|
| 新建作品 | Create project | 创建编辑项目，不等于 AI 生成 |
| 导入 PNG | Import PNG | 从本地载入皮肤贴图 |
| 导入穿搭 | Import outfit | 从 CDPC JSON 备份恢复穿搭 |
| 保存草稿 | Save draft | 保存未公开内容 |
| 保存穿搭 | Save outfit | 若仅保存在本地，明确写“保存到此设备” |
| 保存作品 | Save project | 说明是账户保存还是本地保存 |
| 导出 PNG | Export PNG | 生成指定格式 PNG |
| 导出备份 | Export backup | 导出可移植 JSON，不称为 PNG 导出 |
| 使用素材 | Use asset | 将素材载入当前选装或编辑流程 |
| 继续编辑 | Continue editing | 传入正确数据并打开编辑器 |
| 开始生成 | Generate | 仅在服务端有可用模型时启用 |
| 重新生成 | Regenerate | 创建新任务，不静默覆盖旧结果 |
| 发布作品 | Publish project | 提交公开内容并执行授权检查 |
| 分享作品 | Share project | 打开真实分享功能或生成链接 |
| 收藏 | Add to favorites | 收藏当前素材或作品 |
| 移除收藏 | Remove from favorites | 取消收藏 |
| 删除作品 | Delete project | 危险操作，说明删除对象并按需确认 |
| 恢复默认 | Reset to default | 恢复默认角色/视图，不等于脱下所有服装 |
| 全部脱下 | Remove all items | 清空当前临时穿搭，不删除素材或已保存穿搭 |
| 视角重置 | Reset view | 只重置相机视角，不修改作品数据 |

避免使用缺少对象的“确定”“处理”“应用一下”“提交”等按钮。使用“保存穿搭”“应用到当前角色”等可预测的短语。

### 29.4 核心数据术语

| 中文术语 | 英文术语 | 定义 |
|---|---|---|
| 皮肤 | Skin | 角色皮肤及对应贴图/模型配置，不与穿搭存档混称 |
| 贴图 | Texture | 供模型渲染或像素编辑的图像资源 |
| 服装素材 | Clothing asset | 单件服装/配件资源，含分类、格式、授权与兼容性 |
| 穿搭 | Outfit | 多个已选素材、基础皮肤/角色与显示配置组成的组合 |
| 作品 | Project / Work | 用户保存的创作项目，具体类型必须明确 |
| 素材库 | Asset library | 可搜索、可复用的资源集合，不暗示一定存在交易 |
| 创作工作台 | Workbench | 登录后组织个人创作和账户入口的空间 |
| 编辑器 | Editor | 精细编辑皮肤、贴图或受支持服装资源的工具 |
| AI 生成结果 | Generated result | AI 任务产生的候选结果，保存为作品前仍是生成结果 |
| 保存到此设备 | Save to this device | 仅本地持久化，不承诺账号同步或跨设备恢复 |
| 账号云同步 | Cloud sync | 服务端持久化并跨设备恢复，只有真实实现后才能展示 |

### 29.5 文案规范与验收

- 中文优先使用短而具体的任务名称；英文使用常见产品术语，不逐字硬译。
- 导航名、页面标题、按钮、空状态、错误提示与文档必须使用同一词汇表。
- 错误提示说明发生了什么和下一步如何处理；不展示堆栈、密钥或内部路径。
- “已保存”“已发布”“已同步”“已导出”等成功提示必须由真实操作结果触发。
- 只有真实接入的素材分类、模型、动画和导出能力才显示为可用；未接入能力须明确标注。
- 披肩、外套、披风必须在 UI、数据模型、素材详情和预览配置中保持独立定义。

验收清单：
- [x] 导航、首页按钮、页脚和登录后跳转已开始统一到 `/ai`、`/editor`、`/wardrobe`、`/workbench`；仍需端到端验证。
- [x] 为 `/ai`、`/editor`、`/wardrobe` 配置内置 Vite 工作台默认地址和 `mode` 参数；AI 工坊直达、衣橱默认选中外套分类，并补充浏览器验收用例。
- [ ] 在 Docker 生产镜像中实测三个入口、AI API 代理与 Blockbench 导入桥接；浏览器测试和新提交 CI 尚未获得通过结果。
- [ ] 3D 与像素编辑器外围使用现成组件库，现有引擎能力无回归。
- [ ] 服装卡片统一使用 Mantine 组件组合，不再维护重复的通用卡片体系。
- [ ] 保存、导出、发布、分享互不混淆。
- [ ] 作品、穿搭、皮肤、贴图和素材在 UI、API 与数据模型中的定义一致。
- [ ] 未接入的素材、模型、云同步和第三方服务没有被宣传为已实现。
- [ ] 完成桌面、平板、移动端的键盘、触摸、焦点与响应式回归测试。

## 三十、第二阶段结项记录（2026-10-25）

### 30.1 本阶段结项范围

第二阶段定义为“UI 组件库迁移基础设施与首批关键页面接入”，本次按该范围结项，不将其扩大解释为全站所有页面均已完成组件迁移。

- [x] 根项目引入 Mantine 与 Tailwind CSS v4，并更新根锁文件。
- [x] 为 Next.js 与 Vite 入口接入共享 Mantine 主题/Provider。
- [x] 登录、注册表单首批迁移到 Mantine 控件，同时保留现有认证与校验流程。
- [x] 补齐 `/ai`、`/editor`、`/wardrobe`、`/workbench` 等规范入口，并将编辑器模式参数接入 Vite studio。
- [x] 添加路由目标与 AI/衣橱模式初始化的浏览器测试覆盖。
- [x] 最新结项提交 `70361170d39a4d76860202c3d43dc37dfbf1c1d9` 的 CI、安全测试和 Docker 工作流均显示成功：
  - CI: https://github.com/maoyiren/Pixcape/actions/runs/40161789431
  - Next.js Preview Build and Security Tests: https://github.com/maoyiren/Pixcape/actions/runs/40161789438
  - Build and publish Docker image workflow: https://github.com/maoyiren/Pixcape/actions/runs/40161789447

### 30.2 结项边界与下一阶段

第二阶段结项只覆盖以上明确范围。以下工作仍在后续阶段继续，不得标记为全站完成：

- [ ] 将所有旧式按钮、面板、服装卡片与表单逐页迁移到共享组件体系。
- [ ] 完成管理员后台 WordPress 风格统一外壳和真实业务链。
- [ ] 完成全站窄屏、键盘可访问性、视觉与真实浏览器回归。
- [ ] 完成生产环境 OAuth、邮件、AI 真实生成和部署后验收。
- [ ] 合并 PR 并发布生产镜像。

**发布边界：** PR #23 当前仍为 Draft、未合并。Docker 工作流成功不等于生产镜像已发布，也不代表 cdpc.cc 已更新。生产环境保持不变，除非后续明确执行合并、发布并完成部署验证。


### 30.3 第二阶段补充实施：工作台共享组件迁移

- [x] 将 `/workbench` 的欢迎区、入口卡片、操作按钮和布局改为复用 Mantine 的 `Container`、`Stack`、`Group`、`Paper`、`Card`、`SimpleGrid`、`Badge`、`Button`、`Title` 与 `Text`。
- [x] 工作台视觉通过共享 CDPC token 和局部覆盖样式统一，加入窄屏文字换行与减少动态效果支持。
- [x] 将 `/ai`、`/editor`、`/wardrobe` 的共用入口页迁移到 Mantine `Container`、`Stack`、`Group`、`Paper`、`Badge`、`Title`、`Text` 与 `Button`，统一状态提示和主操作布局。
- [x] 增加 360px 移动视口下的工作台入口可见性和横向溢出浏览器测试。
- [ ] 上述补充提交的 CI、Next.js/浏览器测试、安全测试和 Docker 构建尚待最新提交的工作流结果确认；在结果完成前不标记为通过。
- [ ] 工作台以外的旧式服装卡片、素材列表和编辑器外围仍需逐页迁移；3D 引擎与像素画布继续保留为业务功能引擎，不以 UI 组件替代。


### 30.4 第二阶段补充实施：账户与创作者页面迁移（2026-10-25）

- [x] 将登录页外壳迁移至 Mantine Container、Paper、Stack、Title、Text、Alert 和 Button，保留已有的登录方法筛选、回调地址校验、邮箱验证提示与 LoginForm。
- [x] 将注册页迁移至 Mantine 布局、字段与状态提示组件；保留 React Hook Form + Zod 校验、注册 API、邮箱验证分支及注册成功后的自动登录逻辑。
- [x] 将账户摘要页迁移至 Mantine 容器、卡片、角色/状态徽标和响应式操作组，保留登录会话校验与登出操作。
- [x] 将创作者中心迁移至 Mantine 卡片、资料表单和状态提示；保留服务端身份/账户状态校验、资料查询与更新 Server Action。
- [ ] 以上页面改动必须由最新 head 的 CI、Next.js 构建、安全测试和浏览器回归确认；代码迁移不等同于运行验证通过。
- [ ] 继续迁移剩余旧式表单、服装卡片和编辑器外围；不得替换或破坏像素画布与 3D 预览引擎。


### 30.5 全站界面继续实施：Studio 与管理后台一致性（2026-10-25）

- [x] 将共享的 `/studio` 入口页改为 Mantine 组件组合，统一标题区、模式标签、主操作、未配置状态与部署提示。
- [x] 保留编辑器目标地址校验：只允许 HTTPS 或本机开发地址，并继续向目标地址传递 `mode=editor|ai|wardrobe`。
- [x] 扩展共享样式，统一 Studio 与管理后台已有面板、表单、数据表和管理导航的暗色设计 token。
- [x] 为管理后台表格增加小屏横向滚动容器规则，并优化窄屏子导航、统计卡片与表单布局。
- [ ] 本次提交的 CI、Next.js 构建、安全测试、浏览器回归及 Docker 构建尚未确认通过；必须以最新提交对应的 Actions 结果为准。
- [ ] 管理后台现有页面仍包含旧式业务标记与表单结构；后续继续逐模块迁移至 Mantine，不改变角色权限、审核、审计、配置保存等业务行为。
- [ ] PR #23 仍未合并，生产环境未更新；完成验证前不应将本次 UI 迁移视为生产发布。


### 30.5 全站导航补齐与重构回归修正（2026-10-25）

- [x] 主导航补入「创作工作台」入口，避免用户只能从首页卡片或登录后页面进入工作台。
- [x] 修正 UI 单元测试中的过期注册按钮断言：注册页已经迁移 Mantine，测试仍强制要求旧版 `pixel-button` 类名；更新为验证现行共享 `cdpc-control cdpc-control-primary` 类名，不改变注册业务逻辑。
- [ ] 重新运行最新 head 的 CI、Next.js 构建、安全集成和浏览器回归；不能以旧 head 的结果代替。
- [ ] 继续盘点管理后台、服装选装与编辑器外围；保留现有权限校验、素材分类、像素画布和 3D 渲染能力，不以纯视觉壳替代真实功能。
- [ ] 验证移动端导航在 320px–420px 宽度下无横向溢出，并确认新增导航项不遮挡账户入口。


### 30.6 全站第二阶段：核心路由统一与后台布局（2026-10-25）

- [x] 从最新主分支建立独立实施分支，避免继续叠加旧 PR 的文件冲突。
- [x] 统一 Mantine 全局主题、默认圆角、标题字体、表单控件与暗色外观；所有 Next.js 路由通过根布局共享 Provider。
- [x] 主导航明确区分创作工坊、AI 创作、衣服选装、单品编辑器、创作者中心和个人中心；登录用户的账户入口指向真实的 /account，不再误指向 /workbench。
- [x] 为登录、注册、个人中心、创作者中心、工作台及编辑器入口补充统一表单、反馈、焦点、移动端换行和减少动态效果规则；保留注册 API、Server Actions、会话校验及编辑器 mode 参数。
- [x] 管理后台采用桌面端固定分区导航、小屏自动折叠为可换行导航；统一统计卡片、筛选表单、操作按钮、健康状态与配置表单的视觉基线。现有 AI 配置保存、密钥加密及审计逻辑保持不变。
- [x] 更新浏览器导航回归用例，验证核心入口使用规范路由。
- [ ] 尚未声称构建、浏览器回归、数据库集成测试或 Docker 构建通过；必须等待该分支 PR 的最新 CI 结果，并在需要时补充实际环境验证。
- [ ] AI 生成与衣服选装页面当前通过共享入口连接内置 Vite 工作台；模型是否可用取决于实际 AI 服务配置。素材库和社区在路由未确认前不得以“已上线”入口展示。
- [ ] PR #23 已于本轮前合并至主分支；旧 PR #25 因与主分支共享文件冲突未直接强合并。本次使用从最新 main 切出的独立分支提交增量修复。

### 30.7 PR #25 差异核对与主分支整合记录（2026-10-25）

- [x] 以当前 `main` 为基线核对 PR #25 的页面、路由、Mantine Provider、共享样式、AI 配置接口、环境变量示例和 AI API 测试文件；确认上述多项实现已存在于主分支，不重复覆盖。
- [x] 保留主分支更新后的独立 `/dress-up` 3D 选装页面、`/wardrobe` 路由、导航分工和更完整的响应式全局样式；不采用 PR #25 将 `/dress-up` 重定向到 `/wardrobe` 的旧实现，以免退化现有功能。
- [x] 从 PR #25 迁移工作台内部导航的安全增量：使用 Next.js `Link` 处理首页、创作者中心、登录及各创作入口，避免内部跳转退化为原生整页导航。
- [ ] PR #25 原始分支仍与当前主分支存在冲突，不直接强制合并；本次增量通过独立分支提交，后续以新的整合 PR 进行审阅。
- [ ] 本次增量尚未运行 Next.js 构建、类型检查、单元/安全测试、浏览器回归或 Docker 构建；不得标记为验证通过，需以新 PR 的最新 CI 结果为准。



---

# 原文：`docs/UI-FUNCTION-RESTRUCTURE-PLAN.md`

> 原文件 Blob SHA：`a5629837275b0a28761ff4bc967bc7a047994772`

# CDPC 全站 UI 与功能重构规划文档

- **版本：** V1.0
- **规划日期：** 2026-10-23
- **适用项目：** CDPC（原 Pixcape）
- **代码仓库：** https://github.com/maoyiren/Pixcape
- **目标站点：** https://cdpc.cc
- **状态：** 规划基线，尚需结合当前代码审计后实施

## 1. 重构目标

本次重构不只是调整页面样式，而是统一全站信息架构、功能流程、公共组件、认证与权限模型、响应式布局及验收方式。

核心原则：

1. **一套全站框架：** 标准页面共用导航栏、页脚、布局、设计令牌和公共组件。
2. **一个登录入口：** 普通用户与管理员使用同一认证入口，服务端按账号角色和权限决定可访问区域。
3. **按用户任务组织功能：** 形成“选择素材或皮肤 → 编辑 → 预览 → 保存 → 导出或发布”的清晰流程。
4. **先盘点，再重构：** 不凭页面截图猜测现有代码；先审计路由、功能、认证、数据模型和部署方式。
5. **保留已有能力：** 保护现有用户、作品、素材、皮肤 PNG、3D 预览和第三方集成。
6. **以测试作为完成标准：** 代码提交不等于功能验收，部署成功也不等于登录和业务流程已验证。

## 2. 现状问题与目标

| 问题 | 目标方案 |
|---|---|
| 不同页面的导航栏不一致 | 全站使用统一导航组件，按路由展示活动状态 |
| 页脚样式、内容和位置不统一 | 统一页脚组件；编辑器、认证页和后台允许使用预先定义的精简布局 |
| 功能入口重复、分类混乱 | 统一为首页、创作工坊、AI 创作、素材库、创作者社区、个人中心 |
| 管理员和普通用户登录分离 | 合并认证入口，使用服务端角色和权限控制后台访问 |
| 编辑器操作流程不连贯 | 统一导入、编辑、撤销/重做、预览、保存、导出流程 |
| 页面风格混杂、组件重复 | 建立设计令牌、组件目录和使用规范 |
| 移动端与桌面端体验不一致 | 统一响应式规则，针对小屏重排内容与工具区 |
| 管理后台缺少统一组织 | 仪表盘、用户权限、素材作品、AI 服务、系统配置、日志安全分区 |

## 3. 全站信息架构

### 3.1 主导航

建议主导航为：

1. **首页：** 平台介绍、快速开始、热门素材、最新作品、教程入口。
2. **创作工坊：** 皮肤编辑器、配件编辑器、披风模式及专业工具。
3. **AI 创作：** 文字生成皮肤、图片转换皮肤、生成历史和结果修整。
4. **素材库：** 分类、搜索、筛选、素材详情、收藏、下载与投稿。
5. **创作者社区：** 作品展示、作者主页、投稿、互动、举报与审核。
6. **个人中心：** 个人资料、我的作品、草稿、收藏、AI 历史、账号安全。

搜索、语言/主题入口（仅在实际支持时显示）及用户菜单作为全局辅助入口。管理后台入口只对具备相应权限的账号显示。

### 3.2 辅助页面

统一纳入设计系统的页面还包括：

- 登录、注册、忘记密码、邮箱验证、OAuth 回调。
- 搜索结果、作品详情、素材详情、创作者公开主页。
- 帮助中心、使用教程、常见问题、服务状态。
- 用户协议、隐私政策、版权与免责声明。
- 404、无权限、加载失败及系统错误页面。

### 3.3 页面布局类型

| 布局 | 适用页面 | 规则 |
|---|---|---|
| `MarketingLayout` | 首页、教程、帮助、政策 | 统一导航、内容宽度与页脚 |
| `BrowseLayout` | 素材、社区、搜索、详情 | 统一筛选、列表、分页和详情结构 |
| `EditorLayout` | 皮肤/配件编辑器、AI 结果修整 | 工作区优先，工具与预览位置稳定 |
| `AuthLayout` | 登录、注册、密码恢复 | 统一认证容器，减少干扰 |
| `AccountLayout` | 个人中心、作品管理、账号安全 | 统一侧边导航与内容区 |
| `AdminLayout` | 管理后台 | 统一后台导航、权限校验与数据操作 |

这些是同一设计系统中的不同布局，不应成为互不相关的独立网站。

## 4. 统一导航栏与页脚

### 4.1 导航栏规范

- 左侧展示 CDPC 项目图标与品牌名 `cdpc`。
- 中间展示核心业务导航；小屏幕采用紧凑导航或菜单抽屉。
- 右侧提供搜索、账号菜单及实际支持的语言/主题控制。
- 登录状态显示用户菜单；未登录状态显示统一登录入口。
- 管理员菜单根据服务端返回的有效权限显示“管理后台”入口。
- 活动导航根据当前路由计算，切换页面后及时更新。
- 页面滚动、加载、路由切换时保持高度、层级和交互一致。
- 不允许每个页面单独复制和维护导航栏。

### 4.2 页脚规范

标准内容页共用 `AppFooter`，包含：

- 品牌简介及主要功能入口。
- 创作工坊、AI 创作、素材库、社区、帮助中心链接。
- 用户协议、隐私政策、版权与免责声明。
- 必要的版本或版权信息。

编辑器可以采用全屏工作区，认证页可以减少干扰，管理后台可以使用专属框架；但仍需共享品牌、颜色、字体、按钮、链接及组件基础。不同布局只能使用明确规定的精简模式，不能各自重做页脚。

## 5. 统一登录与管理员权限

### 5.1 目标认证流程

统一登录/注册入口 → 服务端认证与会话校验 → 读取账号状态、角色和权限 → 按原始访问意图及有效权限进入目标页面。

普通用户进入首页或个人中心；具备管理权限的账号可进入管理后台。不能仅凭前端隐藏按钮来保护后台接口。

### 5.2 认证页面要求

- 登录方式包括邮箱与密码、现有邮箱魔法链接，以及已配置并启用的 Google、Microsoft、GitHub、Apple 登录。
- 注册、忘记密码、邮箱验证和 OAuth 回调使用一致的页面与状态反馈。
- 显示处理中、成功、失败和重试状态。
- 未配置或不可用的第三方提供商不得伪装为可用。
- 合并入口不得删除已有魔法链接流程，也不得重复创建会话。
- 已登录用户访问认证页时，应按安全规则返回原始访问目标或个人中心。

### 5.3 角色模型

| 身份 | 目标权限 |
|---|---|
| 游客 | 浏览公开页面、公开作品与素材 |
| 注册用户 | 管理个人资料、作品、收藏及允许的互动 |
| 创作者 | 管理自己的投稿、作品信息与公开主页 |
| 管理员 | 按授权管理用户、素材、审核及系统功能 |
| 超级管理员 | 管理高权限操作、管理员及关键安全设置 |

角色由服务端校验。所有受保护的数据读写操作都必须检查登录状态、角色和资源所有权。

### 5.4 安全与迁移

- 先盘点现有用户、管理员、会话、OAuth 身份关联及数据库结构，再统一入口。
- 不得通过删除旧管理员账号、重置生产数据或强制重新注册来实现合并。
- 保留环境变量配置的初始管理员引导机制，并提供安全的后续管理员管理能力。
- 密码、OAuth 密钥、邮件密钥等敏感配置不得返回给前端。
- 管理员新增、角色变更、关键设置修改应记录审计日志。
- 对登录、密码恢复、OAuth 回调和高风险管理操作实施限流与安全校验。
- 普通用户直接访问后台 URL 或 API 时，必须在服务端拒绝未授权访问。

## 6. 创作工坊

### 6.1 功能分类

- **皮肤编辑器：** PNG 导入、Classic/Slim 模型、纹理编辑、3D 预览、皮肤修改与导出。
- **配件编辑器：** 披肩、帽子、上衣、裤子、鞋子等分类；按素材模板编辑、预览、保存和导出。
- **披风模式：** 独立披风纹理与预览，以及适用时的鞘翅相关展示和动作预览。
- **简易/专业模式：** 简易模式提供模板和快速操作；专业模式提供更完整的编辑工具。

配件分类不能混用。披肩、服装和披风需有明确的类型定义、素材格式与预览行为。

### 6.2 编辑器统一布局

统一使用 `EditorLayout`，基本区域包括：

- 顶部工具栏：返回、作品名称、撤销、重做、保存、导出。
- 工具区：图层、颜色、模板及对应编辑工具。
- 预览区：实时 3D 预览、旋转、缩放、动作切换和背景。
- 纹理区：2D 纹理与图层编辑。
- 移动端将工具区和预览区合理分区，避免把桌面布局挤压到窄屏。

### 6.3 编辑器验收要求

1. 导入、编辑、撤销/重做、保存和导出操作符合统一规范。
2. 2D 修改与 3D 预览同步，并验证真实数据同步。
3. 角色旋转可连续观察，避免不必要的阻尼和角度限制。
4. 切换动作时不意外丢失编辑内容。
5. 导出前校验格式、尺寸和模型兼容性。
6. Blockbench 导入流程有明确的数据契约、异常提示与恢复路径。
7. 切换素材分类时保留正确类型与编辑状态。
8. 未保存更改离开页面时有提示；自动保存仅在持久化行为经过验证后启用。

**兼容性说明：** 配件编辑器与原版 Minecraft 实际装备系统不是同一概念。PNG 导出、第三方皮肤服务器展示和官方游戏装备能力应分别说明，不能暗示所有配件均可直接装备在原版角色上。

## 7. AI 创作、素材库与社区

### 7.1 AI 创作

统一提供两个入口：

- 文字生成 Minecraft 皮肤。
- 参考图片转换为 Minecraft 皮肤。

共同流程：输入 → 生成 → 检查结果 → 进入编辑器 → 保存 → 导出或发布。

要求：

- 模型支持按实际能力选择或由服务端路由，避免绑定单一供应商。
- API 密钥只保存在服务端。
- 提供生成中、失败、重试、配额不足等状态。
- 明确上传图片处理规则、生成内容使用条件和成本限制。
- 生成结果可关联编辑器，减少重复上传和数据丢失。

### 7.2 素材库

- 分类涵盖皮肤、披肩、服装、帽子、鞋子、披风等。
- 搜索支持现有数据中可用的名称、标签、作者字段。
- 详情展示真实预览、作者、适用类型、授权及使用说明。
- 收藏与登录用户关联。
- 使用素材时传入正确编辑器和素材类型。
- 投稿校验格式、分类、授权和审核状态。

素材列表应优先显示实际预览，而不是只展示文件名或原始数据。投稿不得默认公开，需根据审核状态和授权规则决定是否展示。

### 7.3 创作者社区

首期聚焦作品展示和分享：

- 作品发布与详情。
- 作者信息与作品列表。
- 评论及互动（以现有实现和数据能力为准）。
- 举报、审核、内容下架。
- 原创声明、授权信息和版权投诉处理。

## 8. 视觉设计系统与组件库

### 8.1 视觉方向

延续简洁、偏工具软件的像素创作平台风格，减少过度装饰和明显的 AI 营销视觉。以下为初始设计令牌建议，需与现有品牌资产核对后落地：

| 令牌 | 建议值 | 用途 |
|---|---|---|
| `color.brand-ink` | `#171D2A` | 品牌深色、深色界面 |
| `color.brand-steel` | `#8297BE` | 次要强调 |
| `color.surface` | `#F4F6FA` | 浅色背景 |
| `color.action` | `#4F7DFF` | 主要操作 |

先盘点项目已有 UI 库，选择一个主要组件体系；特殊场景可保留必要组件，但避免重复引入相互冲突的实现。

### 8.2 公共组件清单

- 基础表单：Button、IconButton、Input、Select、Checkbox、Switch。
- 浮层反馈：Dialog、Popover、Tooltip、Dropdown、Toast。
- 内容布局：Card、Tabs、Breadcrumb、Pagination。
- 页面状态：PageHeader、EmptyState、LoadingState、ErrorState。
- 业务组件：AssetCard、WorkCard、UserAvatar。
- 安全与操作：ConfirmDialog、PermissionGuard、ProtectedRoute。

统一字体、字号、间距、圆角、边框、阴影、焦点状态、键盘操作、暗色模式和无障碍要求。公共组件应集中维护，避免每个页面重复实现。

### 8.3 响应式标准

- **桌面端：** 完整导航，编辑器工具区与预览区合理分配空间。
- **平板端：** 可折叠工具面板，内容区域可重新排列。
- **手机端：** 导航收纳、表单单列、卡片自适应，编辑器分区切换。
- **全站：** 避免横向溢出、固定宽度挤压、过小触控目标和弹窗超出视口。

断点应基于当前布局与真实设备测试确定，不机械套用单一数值。

## 9. 个人中心与管理后台

### 9.1 个人中心

| 分组 | 页面 |
|---|---|
| 我的创作 | 我的作品、草稿、最近编辑 |
| 我的收藏 | 收藏的素材和作品 |
| AI 创作 | 生成历史、可恢复结果 |
| 账号设置 | 个人资料、登录方式、密码与安全 |
| 消息与帮助 | 通知、反馈、帮助中心 |

每个页面都要定义数据来源、加载/空/错误状态，以及操作完成后的反馈。

### 9.2 管理后台

使用统一的 `AdminLayout`，按角色权限显示模块：

- **运营仪表盘：** 用户、作品、生成任务、服务状态。
- **用户与权限：** 用户管理、角色、管理员。
- **素材与作品：** 分类、投稿、审核、下架。
- **AI 服务管理：** 模型配置、配额、成本与失败记录。
- **系统配置：** 认证、邮件、数据库及功能开关。
- **日志与安全：** 审计、异常和健康检查。

所有统计与健康状态必须来自真实数据或真实检查。配置修改失败要明确反馈。敏感密钥不得以明文返回；高风险操作应有权限校验、审计及必要的二次确认。

## 10. 分阶段实施路线

### 阶段 1：代码与功能审计

- 盘点所有路由、页面、导航、页脚和重复组件。
- 记录真实功能、未完成能力与已知故障。
- 检查登录、注册、管理员、OAuth 回调、数据库和部署结构。
- 确认构建、测试及部署基线。

**交付：** 页面清单、功能清单、问题优先级和重构影响范围。

### 阶段 2：设计系统与全局框架

- 建立设计令牌、组件规范和布局。
- 统一导航、页脚、面包屑、按钮与状态提示。
- 建立桌面和移动端公共响应式规则。
- 统一主题、语言和路由状态处理。

**交付：** 可复用公共布局和组件系统。

### 阶段 3：统一登录与权限体系

- 合并管理员与普通用户登录入口。
- 修复并验证注册、会话、第三方 OAuth 和回调。
- 验证角色、后台访问控制和资源所有权。
- 验证旧账号迁移和生产环境兼容性。

**交付：** 可验证的统一认证流程和权限测试结果。

### 阶段 4：迁移业务页面

- 首页、创作工坊、素材库、AI 创作。
- 作品详情、社区和个人中心。
- 管理后台与系统设置。
- 补齐空状态、错误状态、权限提示和响应式布局。

**交付：** 页面结构统一、入口清晰、业务流程可用。

### 阶段 5：回归测试与发布

- 执行构建、单元测试、集成测试和关键 E2E 测试。
- 检查桌面端、手机端和不同账号权限。
- 验证 Docker 镜像、生产环境变量和启动流程。
- 确认变更进入主分支，发布镜像后执行线上冒烟测试。

**交付：** 测试记录、发布版本、回滚方案和未完成事项清单。

## 11. 验收标准

### 全站布局
- 所有标准页面使用统一导航和页脚组件。
- 标题、按钮、卡片、表单和状态提示符合统一规范。
- 手机端导航、弹窗、表格与编辑器没有明显溢出。

### 账号认证
- 普通用户可完成注册、登录、退出和密码恢复。
- 管理员通过同一入口登录并按权限进入后台。
- Google、Microsoft、GitHub、Apple 仅对实际配置的提供商逐项验证。
- 邮箱魔法链接、OAuth 回调和会话续期经过测试。
- 普通用户不能绕过服务端权限访问管理接口。

### 创作流程
- 皮肤与配件分类准确，素材能进入正确编辑器。
- 编辑、撤销/重做、预览、保存和导出经过实际验证。
- AI 结果可进入编辑器，错误状态可以恢复。
- Blockbench 导入、3D 预览和旋转交互经过回归测试。

### 数据与管理
- 重构不造成现有用户、作品和素材数据丢失。
- 管理员权限、敏感配置和资源所有权经过测试。
- 关键管理操作有结果反馈，必要操作有审计记录。

### 交付与部署
- 生产构建与自动化测试通过。
- Docker 镜像可正常启动，数据库迁移符合部署方案。
- 主分支包含已验收的变更，发布版本可追溯。
- 线上登录、关键页面和编辑器完成冒烟测试。

## 12. 执行约束与风险控制

1. 先检查仓库再改代码，以当前主分支为准，不根据旧截图猜测实现。
2. 优先保留现有 React、TypeScript、Vite、渲染引擎和部署架构；只有审计证明必要时才调整技术栈。
3. 对皮肤 PNG、64×64 纹理、Classic/Slim、3D 预览、Blockbench 和现有账号数据进行回归保护。
4. 公共导航、页脚、按钮、表单和提示组件由公共模块维护。
5. 每个阶段都必须可构建、可测试；不得把未实现功能标记为完成。
6. 保留可回滚能力，记录数据库变更、配置变更和发布版本。
7. 本文为目标规划；当前功能状态和可行性必须通过代码审计与实际测试确认。

## 13. 最终交付物

- 全站页面与路由清单。
- 功能分类和页面操作流程图。
- 设计规范、公共组件清单与响应式规则。
- 统一登录、管理员角色、OAuth 与权限设计。
- 创作工坊、AI 创作、素材库、社区、个人中心和后台规格。
- 分阶段实施计划与回归测试用例。
- 更新后的项目文档、部署说明和环境变量配置说明。
- 实际测试记录、变更记录和发布验收清单。

**建议执行顺序：** 先审计当前仓库，再统一全站框架和账号认证，然后逐模块迁移业务页面，最后完成回归测试与发布。不要一次性推倒重写全部页面，也不要在尚未确认认证故障根因前重写整个登录系统。

