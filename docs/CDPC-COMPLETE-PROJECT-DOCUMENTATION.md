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

