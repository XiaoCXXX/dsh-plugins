// dsh-control-bar 宿主半：注册 /dsh-control/* 路由，并把控制条脚本注入 DSH Web 页面。
//
// 机制与 dsh-theme-pack / dsh-desktop-pet 一致：
//   - 注入 webServer 服务
//   - ctx.webServer.register({ kind: 'exact', path, handler })  注册路由
//   - ctx.webServer.tapIndex(html => html)                       往 index 注入 <script>
//
// 桌面客户端里的「悬浮控制条」是 Electron 的一个独立 WebContentsView，网页端用不了。
// 这个插件把同样的东西做进页面里：拖拽、折叠、位置记忆、重新加载、新会话、
// 回到最新、主题循环、连接状态灯。纯前端，不需要 Electron。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BAR_FILE = path.join(PACKAGE_ROOT, 'lib', 'bar.browser.js')

/** 稳定 Cordis 插件名。 */
const name = 'dsh-control-bar'
/** 需要 webServer 提供路由与 index 注入能力。 */
const inject = ['webServer']

/** 普通插件体：注册路由 + 注入脚本，全部用 ctx.effect 兜底释放。 */
function apply(ctx) {
  const disposers = []

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-control/bar.js',
      handler: (req, res) => {
        let source = ''
        try {
          source = fs.readFileSync(BAR_FILE, 'utf8')
        } catch (err) {
          source = '/* dsh-control-bar unavailable: ' + String((err && err.message) || err) + ' */'
        }
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(source)
      },
    }),
  )

  disposers.push(
    ctx.webServer.tapIndex((html) => {
      if (html.indexOf('/dsh-control/bar.js') !== -1) return html
      const tag = '<script defer src="/dsh-control/bar.js"></script>'
      if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
      return html + tag
    }),
  )

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* 释放失败不影响宿主 */
      }
    }
  })
}

export { name, inject, apply }
