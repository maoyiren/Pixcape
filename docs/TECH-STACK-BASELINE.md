# Technology Stack Baseline

Last reviewed: 2026-11-05

This repository uses current stable/LTS releases where compatible with the production architecture. The lockfiles, not version ranges alone, define what CI and Docker actually install.

## Runtime and build

| Area | Baseline |
| --- | --- |
| Node.js | 26.13.0 (Active LTS) |
| npm | Bundled with the pinned Node.js release |
| Web framework | Next.js 16.4.5 |
| UI runtime | React / React DOM 19.3.1 |
| TypeScript | 7.0.2 |
| Prisma ORM and adapters | 7.10.1 |
| Mantine | 9.7.5 |
| Lucide React | 1.69.0 |
| Tailwind CSS | 4.3.4 |
| Vite (legacy app/build tooling) | 8.3.5 |
| Three.js | 0.186.x |
| skinview3d | 3.4.2 |
| Playwright | 1.64.1 |
| Express (AI API) | 5.3.0 |

The Next.js and React versions are kept on stable releases. No canary, alpha, beta, or release-candidate packages are introduced as part of routine upgrades.

## Upgrade policy

1. Update the root dependency declarations and the matching npm lockfile together.
2. Keep all Prisma adapters, Prisma CLI, and Prisma Client on the same release line.
3. Keep the production Docker build, CI runners, and local Node version on the same supported LTS line.
4. Upgrade framework majors only after reviewing migration notes and running the full database, browser, security, and Docker suites.
5. Do not treat a successful dependency save as proof that an external AI provider, OAuth provider, or production deployment is working.
6. Keep the legacy Vite toolchain only while it is still required by existing build and regression workflows; remove it after its pages and assets are fully migrated to Next.js.

## Verification

A default-branch maintenance workflow regenerates both npm lockfiles when the stack-upgrade branch changes. The pull-request CI then validates the committed lockfiles with clean installs, database migrations, security checks, browser tests, production builds, and Docker builds. The normal pull-request workflows then provide the PostgreSQL/MySQL/SQLite migration, security, browser, and Docker regression coverage.

A CI pass validates the candidate code in GitHub Actions. It does not deploy to cdpc.cc or replace the production image automatically.
