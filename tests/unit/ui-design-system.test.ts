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
