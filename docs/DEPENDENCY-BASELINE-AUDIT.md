# CDPC 依赖与构建基线审计

- 审计日期：2026-10-23
- 审计分支：`chore/dependency-audit-2026-10-23`
- 仓库：`maoyiren/Pixcape`
- 范围：根目录依赖清单、Dockerfile、Vite/Next 配置、脚本入口
- 状态：静态仓库审计；尚未在真实 CI/容器中执行构建和测试

## 1. 已核对事实

### 根目录依赖
当前 `package.json` 声明 React 19、TypeScript、Vite 8、Next.js 16、NextAuth 4、Prisma 7、Radix UI（Tabs/Tooltip/Select）、Lucide React、Three.js、skinview3d、Nodemailer、vite-plugin-pwa，以及 PostgreSQL/MariaDB/SQLite 适配器。

根目录未找到 `package-lock.json`、`pnpm-lock.yaml` 或 `yarn.lock`。这表示本次审计无法确认根项目有被提交的依赖锁定文件；不代表子项目一定没有独立锁文件。

### 构建与运行
- `build`：先运行 Blockbench 构建，再运行 Vite 应用构建。
- `next:build`：先生成多数据库 Prisma 客户端，再运行 Next.js 构建。
- 主 `Dockerfile` 分别构建 Blockbench、Vite、Next.js 和 AI API，最终镜像包含 Nginx 与 Next.js 服务。
- Vite 配置有独立的 base path（默认 `/`，Docker 设置为 `/studio/`），PWA 也由 Vite 插件管理。
- Next.js 配置使用独立的 `tsconfig.next.json`。
- 这些证据表明 Vite 编辑器和 Next.js 应用目前是并存架构，不能在未梳理路由/部署契约前把依赖统一塞进一个前端入口。

### 测试脚本
- `test:unit` 使用 Node 内置测试运行器。
- `test:integration` 使用 Node 内置测试运行器。
- `test:e2e` 也使用 Node 内置测试运行器，测试文件为 `tests/e2e/*.test.mjs`。
- 根 `package.json` 没有声明 Vitest、Testing Library 或 Playwright，也没有根级 `vitest.config.ts` 或 `playwright.config.ts`。
- 因此，目前不能将 `test:e2e` 视为已经配置好的浏览器自动化测试。应继续检查测试文件内容，判断它们是 HTTP/流程测试还是浏览器 UI 测试。

## 2. 当前风险与处理建议

| 优先级 | 发现 | 影响 | 建议 |
|---|---|---|---|
| P0 | 根目录未发现已提交的包管理器锁文件 | 构建可能解析到不同的传递依赖版本，难以复现问题 | 确认项目统一使用 npm 后，生成并提交 `package-lock.json`；将 Docker 安装改为 `npm ci` 前先验证所有工作区/子项目的安装方式 |
| P0 | Vite、Next.js、Blockbench、AI API 多个构建边界 | 依赖加错位置可能增大镜像、污染浏览器包或导致构建失败 | 维护应用边界表；每个新增库记录安装目录、运行时和是否进入客户端 bundle |
| P0 | 生产 Dockerfile 使用 `npm install` 而非锁文件驱动的安装 | 依赖树可重复性较弱 | 锁文件补齐并在 CI 验证后，分阶段将对应安装改为 `npm ci`；AI API 需单独审计其锁文件 |
| P1 | UI 目前已有 Radix 原语但未完成导入盘点 | 贸然引入 Mantine 可能造成两套组件样式、主题和行为并存 | 先统计 `@radix-ui/*`、自定义组件和页面导入，再选唯一主体系；在迁移试点通过前不安装第二套完整 UI 系统 |
| P1 | 表单与验证库未在根依赖中声明 | 重复表单可能有不一致校验，但当前缺口仍需按页面确认 | 先盘点表单复杂度和服务端校验；确认收益后将 React Hook Form + Zod 作为一组引入 |
| P1 | 没有发现根级 Playwright/Vitest 配置 | 浏览器回归和组件测试能力可能不足 | 先阅读现有测试文件并跑通当前脚本；只有确认没有浏览器级覆盖后再引入 Playwright |
| P1 | 根目录第三方许可清单存在，但新增库仍需纳入 | 发行包许可义务可能遗漏 | 每次新增依赖同步审查许可证及 THIRD_PARTY_NOTICES.md |

## 3. 依赖接入决策

### 现在不应一次性安装的库
- Mantine：先做 Radix/现有组件导入清点和页面试点。
- React Hook Form + Zod：先确定表单和 API 校验边界；服务端校验不能只依赖客户端。
- Vitest + Testing Library：Node 测试能覆盖的逻辑继续复用现有测试运行器，组件测试有明确缺口再加入。
- Playwright：先审查 `tests/e2e` 现有用例；如果没有真实浏览器交互测试，再引入。
- TanStack Query/Table、图表库、Sentry、Pino、Redis、对象存储 SDK：需以具体功能、规模和数据边界为前提，暂不作为基础依赖批量安装。

### 建议第一批落地顺序
1. 完成测试目录、UI 导入和根/子项目锁文件的完整审计。
2. 明确主 UI 体系和 Vite/Next.js/AI API 的依赖边界。
3. 建立可重复的依赖安装和构建基线。
4. 选择一个低风险的登录/注册表单试点，评估 React Hook Form + Zod。
5. 根据现有 E2E 测试实际内容决定是否新增 Playwright。
6. 每一批独立提交、构建与测试，不将多个大型框架升级混进同一改动。

## 4. 重要兼容性约束

- 保留现有 NextAuth 认证模型，不引入第二套认证框架。
- 保留 Three.js、skinview3d 与 Blockbench Web 集成，不因 UI 组件迁移替换 3D 引擎。
- 保持 Minecraft 皮肤 PNG 的尺寸、透明度、Classic/Slim 及导入导出语义。
- 不把服务器 SDK 或密钥型库放入 Vite 客户端 bundle。
- 新增依赖必须与当前 Node 24 Docker 构建环境兼容，并检查许可证和原生模块支持。
- 仅凭静态文件审计不能证明当前线上功能或 CI 构建状态正常。

## 5. 本次审计未执行的事项

- 未安装或升级任何运行时依赖。
- 未生成锁文件。
- 未运行 `npm install`、构建、测试或 Docker 镜像构建。
- 未更改生产环境、认证配置或数据库。
- 需要在后续实现阶段通过 CI/本地可运行环境提供实际验证结果。

## 6. 后续验收清单

- [ ] 根项目与 `ai-api` 的锁文件和包管理方式已经核实。
- [ ] Docker 安装流程由锁文件驱动并通过 CI 验证。
- [ ] UI 组件实际导入清单已完成，主组件体系有明确结论。
- [ ] `tests/e2e` 已确认是否使用浏览器，缺口有对应方案。
- [ ] 新依赖的版本、许可证、安装位置、客户端/服务端边界均已记录。
- [ ] 现有构建、单元、集成、认证和编辑器关键路径有可重复的基线。
