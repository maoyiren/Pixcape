import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Vite app loads one shared CDPC design system after legacy base styles', () => {
  const entry = read('../../src/main.tsx')
  assert.match(entry, /import '\.\/styles\.css'/)
  assert.match(entry, /import '\.\/design-system\.css'/)
})

test('shared design system defines consistent tokens and responsive editor chrome', () => {
  const css = read('../../src/design-system.css')
  for (const token of ['--cdpc-bg', '--cdpc-surface', '--cdpc-border', '--cdpc-text', '--cdpc-accent']) {
    assert.ok(css.includes(token), `missing design token: ${token}`)
  }
  for (const selector of ['.cdpc-editor-overlay', '.cdpc-editor-toolbar', '.cdpc-site-footer', '.preset-topbar', '.ai-studio']) {
    assert.ok(css.includes(selector), `missing shared UI rule: ${selector}`)
  }
})

test('preset studio no longer loads the conflicting pixel inventory theme', () => {
  const studio = read('../../src/PresetStudio.tsx')
  assert.doesNotMatch(studio, /minecraft-inventory\.css/)
  assert.match(studio, /className="cdpc-site-footer"/)
})

test('Next.js routes share the same footer and CDPC branding', () => {
  const layout = read('../../app/layout.tsx')
  const nav = read('../../app/components/site-nav.tsx')
  const css = read('../../app/next.css')
  assert.match(layout, /cdpc-site-footer/)
  assert.match(layout, /CDPC/)
  assert.match(nav, /className="site-brand-word">cdpc<\/span>/)
  assert.match(css, /--cdpc-bg:#101318/)
})


test('Next.js shared styling preserves accessible focus and reduced-motion behavior', () => {
  const css = read('../../app/next.css')
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /--cdpc-accent/)
  assert.match(css, /@media\(max-width:720px\)/)
})

test('shared layout keeps the non-affiliation notice and language metadata', () => {
  const layout = read('../../app/layout.tsx')
  assert.match(layout, /lang="zh-CN"/)
  assert.match(layout, /不隶属于 Mojang Studios 或 Microsoft/)
})


test('AI generation mode uses accessible Radix Tabs and shared styling', () => {
  const studio = read('../../src/AiSkinStudio.tsx')
  const css = read('../../src/ai-skin-studio.css')
  assert.match(studio, /import \* as Tabs from '@radix-ui\/react-tabs'/)
  assert.match(studio, /<Tabs\.Root className="ai-studio__segmented"/)
  assert.match(studio, /<Tabs\.Trigger value="text-to-image">/)
  assert.match(studio, /<Tabs\.Trigger value="image-to-image">/)
  assert.match(css, /\[role="tab"\]\[data-state="active"\]/)
})

test('Next.js navigation and admin routes have small-screen responsive safeguards', () => {
  const css = read('../../app/next.css')
  assert.match(css, /\.site-nav-links\{order:3;flex:1 1 100%/)
  assert.match(css, /\.admin-overview\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css, /@media\(max-width:420px\)/)
  assert.match(css, /\.inventory-shell table\{display:block;max-width:100%;overflow-x:auto/)
})

test('AI studio provides compact touch-friendly layout on narrow screens', () => {
  const css = read('../../src/ai-skin-studio.css')
  assert.match(css, /@media\(max-width:520px\)/)
  assert.match(css, /\.ai-studio__segmented \[role="tab"\]/)
})


test('Phase 2 shared controls cover account forms and magic-link submission', () => {
  const css = read('../../src/design-system.css')
  const login = read('../../app/login/login-form.tsx')
  const register = read('../../app/register/page.tsx')
  for (const token of ['--cdpc-control-height: 44px', '--cdpc-control-radius: 7px', '--cdpc-control-focus']) {
    assert.ok(css.includes(token), `missing shared control token: ${token}`)
  }
  for (const selector of ['.cdpc-page .cdpc-input', '.cdpc-page .cdpc-control-primary', '.cdpc-page .auth-email-form', '.cdpc-page .auth-provider-group', '.cdpc-page .auth-feedback-error', '.cdpc-page .auth-feedback-success']) {
    assert.ok(css.includes(selector), `missing shared control rule: ${selector}`)
  }
  assert.match(login, /发送登录链接/)
  assert.match(login, /<Button[^>]*type="submit"/)
  assert.match(login, /className="pixel-button auth-provider-button cdpc-control"/)
  assert.match(login, /auth-feedback-error/)
  assert.match(login, /auth-feedback-success/)
  assert.match(css, /\.cdpc-page \.cdpc-control-primary\s*\{[^}]*box-shadow: none/s)
  assert.match(login, /cdpc-control cdpc-control-primary/)
  assert.match(register, /className="cdpc-control cdpc-control-primary"/)
})
