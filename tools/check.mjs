#!/usr/bin/env node
// 发布前自检：每个包必须是可安装的 DSH bundle，且所有 JS 都能通过语法检查。
//   node tools/check.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = path.join(ROOT, 'packages')

let failures = 0
const ok = (message) => console.log(`  ok    ${message}`)
const bad = (message) => {
  failures += 1
  console.log(`  FAIL  ${message}`)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    return { __error: String(error.message) }
  }
}

/** 用当前 Node（含 ELECTRON_RUN_AS_NODE 形态）做语法检查。 */
function syntaxCheck(file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe', env: process.env })
    return null
  } catch (error) {
    return String((error.stderr || error.message || '').toString()).trim().split('\n').slice(0, 3).join(' ')
  }
}

const names = fs.readdirSync(PACKAGES).filter((name) => {
  const dir = path.join(PACKAGES, name)
  return fs.statSync(dir).isDirectory()
})

if (names.length === 0) bad('packages/ 下没有任何插件')

for (const name of names) {
  const dir = path.join(PACKAGES, name)
  console.log(`\n${name}`)
  const manifest = readJson(path.join(dir, 'package.json'))

  if (manifest.__error) {
    bad(`package.json 解析失败：${manifest.__error}`)
    continue
  }
  if (manifest.name !== name) bad(`package.json name=${manifest.name} 与目录名不一致`)
  else ok('name 与目录一致')
  if (!manifest.version) bad('缺少 version')
  else ok(`version ${manifest.version}`)
  if (!manifest.license) bad('缺少 license')
  else ok(`license ${manifest.license}`)

  const patchRel = manifest.dsh?.bundle?.patch
  if (!patchRel) bad('没有声明 dsh.bundle.patch（不能作为 bundle 安装）')
  else {
    const patchFile = path.join(dir, patchRel)
    if (!fs.existsSync(patchFile)) bad(`bundle patch 文件不存在：${patchRel}`)
    else {
      const text = fs.readFileSync(patchFile, 'utf8')
      if (!text.includes(`name: ${name}`) && !new RegExp(`name:\\s*['"]${name}['"]`).test(text)) {
        bad('cordis.patch.yml 里没有 insert 这个包名')
      } else ok('bundle patch 已插入自身')
    }
  }

  const entry = manifest.main ? path.join(dir, manifest.main) : undefined
  if (!entry || !fs.existsSync(entry)) bad(`main 入口不存在：${manifest.main}`)
  else {
    const problem = syntaxCheck(entry)
    problem ? bad(`入口语法错误：${problem}`) : ok(`入口可解析：${manifest.main}`)
  }

  // 其余 .js 也过一遍语法（排除 assets 里的二进制）
  const seen = new Set([entry])
  const walk = (current) => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name)
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === 'assets') continue
        walk(full)
        continue
      }
      if (!/\.(js|cjs|mjs)$/.test(item.name)) continue
      if (seen.has(full)) continue
      seen.add(full)
      const problem = syntaxCheck(full)
      if (problem) bad(`语法错误 ${path.relative(dir, full)}：${problem}`)
    }
  }
  walk(dir)
  ok(`全部 JS 通过语法检查（${seen.size} 个）`)

  const missingDocs = ['README.md', 'README.en.md', 'LICENSE'].filter((doc) => !fs.existsSync(path.join(dir, doc)))
  if (missingDocs.length === 0) ok('README / LICENSE 齐备')
  else missingDocs.forEach((doc) => bad(`缺少 ${doc}`))
}

console.log(failures === 0 ? '\n全部通过。' : `\n${failures} 项未通过。`)
process.exit(failures === 0 ? 0 : 1)
