import { spawnSync } from 'node:child_process'
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceDir = path.join(root, '.cache', 'blockbench')
const outputDir = path.join(root, 'public', 'blockbench')
const bridgeSource = path.join(root, 'scripts', 'pixcape-blockbench-bridge.js')
const blockbenchRef = process.env.BLOCKBENCH_REF || '5b0c99cd5a0e0ef3d15f52e91e945672076022ac'

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')} (exit ${result.status})`)
  }
}

if (!existsSync(bridgeSource)) {
  throw new Error('Missing Pixcape Blockbench bridge: scripts/pixcape-blockbench-bridge.js')
}

rmSync(sourceDir, { recursive: true, force: true })
mkdirSync(path.dirname(sourceDir), { recursive: true })
mkdirSync(path.dirname(outputDir), { recursive: true })

run('git', ['init', sourceDir])
run('git', ['-C', sourceDir, 'remote', 'add', 'origin', 'https://github.com/liseezn/blockbench.git'])
run('git', ['-C', sourceDir, 'fetch', '--depth=1', 'origin', blockbenchRef])
run('git', ['-C', sourceDir, 'checkout', '--detach', 'FETCH_HEAD'])
run('npm', ['ci'], sourceDir)
run('npm', ['run', 'build-web'], sourceDir)

const requiredFiles = ['index.html', 'favicon.png', 'icon_full.png', 'manifest.webmanifest', 'LICENSE.MD']
const requiredDirs = ['assets', 'css', 'content', 'dist', 'font', 'icons', 'js', 'keymaps', 'lang', 'lib', 'themes']
if (!existsSync(path.join(sourceDir, 'dist', 'bundle.js'))) {
  throw new Error('Blockbench build did not produce dist/bundle.js')
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })
for (const file of requiredFiles) {
  const from = path.join(sourceDir, file)
  if (!existsSync(from)) throw new Error(`Missing Blockbench runtime file: ${file}`)
  copyFileSync(from, path.join(outputDir, file))
}
for (const dir of requiredDirs) {
  const from = path.join(sourceDir, dir)
  if (!existsSync(from)) throw new Error(`Missing Blockbench runtime directory: ${dir}`)
  cpSync(from, path.join(outputDir, dir), { recursive: true })
}

copyFileSync(bridgeSource, path.join(outputDir, 'pixcape-bridge.js'))
const htmlPath = path.join(outputDir, 'index.html')
const html = readFileSync(htmlPath, 'utf8')
if (!html.includes('pixcape-bridge.js')) {
  if (!/<\/body>/i.test(html)) {
    throw new Error('Cannot inject Pixcape bridge: Blockbench index.html has no closing body tag')
  }
  writeFileSync(htmlPath, html.replace(/<\/body>/i, '  <script src="./pixcape-bridge.js"></script>\n</body>'))
}
console.log(`Blockbench ${blockbenchRef} copied to public/blockbench/ with Pixcape import bridge`)
