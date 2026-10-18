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
  assert.match(studio, /className="preset-footer"/)
})

test('Next.js routes share the same footer and CDPC branding', () => {
  const layout = read('../../app/layout.tsx')
  const nav = read('../../app/components/site-nav.tsx')
  const css = read('../../app/next.css')
  assert.match(layout, /cdpc-site-footer/)
  assert.match(layout, /CDPC/)
  assert.match(nav, /<span>CDPC<\/span>/)
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
  assert.match(layout, /不隶属于 Mojang 或 Microsoft/)
})
