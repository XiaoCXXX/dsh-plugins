/* dsh-theme-pack 应用脚本 —— 由宿主半注入到 DSH Web 页面（<script defer>）。
 *
 * 职责：
 *  1. 从 /dsh-theme/theme.json 读取当前主题；
 *  2. 把主题色写成 **inline + !important** 的自定义属性，同时落在
 *     documentElement 与 body 上 —— DSH 自带的主题 presenter 会往这两个地方写
 *     非 important 的值（或整块改写），important 的 inline 值优先级更高，所以
 *     我们的配色不会被它顶掉；
 *  3. 按主题声明的 colorScheme 钉住基底模式（body[data-ds-dark-theme]），并用
 *     MutationObserver 在被改回来时重新钉住；
 *  4. 轮询主题变化（本地 HTTP、载荷极小），失焦页面暂停。
 *
 * 这段代码是普通页面脚本，不是 cordis 客户端插件（仓库外的插件复现不了
 * 客户端插件的 lazy-CJS 构建链），因此只依赖 DOM 与 fetch。
 */
(function () {
  'use strict'

  var ENDPOINT = '/dsh-theme/theme.json'
  var POLL_MS = 3000
  var appliedNames = []
  var appliedId = null
  var modeObserver = null

  function elements() {
    var list = []
    if (document.documentElement) list.push(document.documentElement)
    if (document.body) list.push(document.body)
    return list
  }

  function applyVars(vars) {
    var els = elements()
    var names = []
    // 先清掉上一轮自己写下的名字，再写这一轮。
    //
    // 不这么做就会有一个很隐蔽的 bug：原生主题（dsh-white-blue / dsh-dark）的
    // vars 是空的 {}，applyVars({}) 什么都不写、同时把 appliedNames 置空，
    // 于是上一套主题留在 html/body 上的 inline + !important 变量**再也没有人清**。
    // 那些变量带 !important，优先级高于 DSH 自己的调色板，表现为
    // 「从非原生主题切回原生主题，DSH 界面切不回去」。
    // （ocean → contrast 之所以看着正常，是因为 contrast 自带整套变量，
    //   把该覆盖的都覆盖了，正好绕过这条路径。）
    for (var c = 0; c < els.length; c++) {
      var prev = els[c].style
      for (var p = 0; p < appliedNames.length; p++) prev.removeProperty(appliedNames[p])
    }
    for (var i = 0; i < els.length; i++) {
      var style = els[i].style
      for (var key in vars) {
        if (!Object.prototype.hasOwnProperty.call(vars, key)) continue
        style.setProperty(key, vars[key], 'important')
      }
    }
    for (var name in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, name)) names.push(name)
    }
    appliedNames = names
  }

  function clearVars() {
    var els = elements()
    for (var i = 0; i < els.length; i++) {
      for (var j = 0; j < appliedNames.length; j++) els[i].style.removeProperty(appliedNames[j])
    }
    appliedNames = []
  }

  /** 原生主题（vars 为空）要把基底模式还给 DSH 自己，不能一直钉着。 */
  function isNativeTheme(payload) {
    return payload && payload.native === true
  }

  function pinMode(scheme) {
    if (!document.body) return
    var wantDark = scheme === 'dark'
    var has = document.body.hasAttribute('data-ds-dark-theme')
    if (wantDark && !has) document.body.setAttribute('data-ds-dark-theme', '')
    if (!wantDark && has) document.body.removeAttribute('data-ds-dark-theme')

    if (typeof MutationObserver === 'undefined') return
    if (modeObserver) modeObserver.disconnect()
    modeObserver = new MutationObserver(function () {
      var now = document.body.hasAttribute('data-ds-dark-theme')
      if (wantDark && !now) document.body.setAttribute('data-ds-dark-theme', '')
      if (!wantDark && now) document.body.removeAttribute('data-ds-dark-theme')
    })
    modeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
  }

  function apply(payload) {
    if (!payload || !payload.theme) return
    var scheme = payload.colorScheme === 'dark' ? 'dark' : 'light'

    // 「不覆盖配色」和「不管基底明暗」是两件事，别捆在一起。
    //
    // 原生主题不覆盖任何令牌（它的 vars 是空的），但**仍然要钉住基底模式**——
    // 否则「原生白蓝 ↔ 原生暗色」互相切不动：两套主题都不写变量，
    // 又都不动 data-ds-dark-theme，页面明暗就永远停在切换前的那个。
    // 这里曾经把两件事一起 return 掉，正好踩中这个坑。
    pinMode(scheme)

    if (isNativeTheme(payload)) {
      // 原生主题：清掉我们写过的变量，把配色整个还给 DSH 自己的调色板。
      // 不清的话，上一套非原生主题留在 html/body 上的 inline + !important
      // 会继续压着 DSH 的调色板，表现为「切回原生主题没反应」。
      clearVars()
    } else {
      // 每次都重放：presenter 可能在主题/系统配色变化时改写，重放成本极低。
      // applyVars 内部会先清掉上一轮的名字，所以从深色主题切到浅色主题不会留下残影。
      applyVars(payload.vars || {})
    }
    appliedId = payload.theme
  }

  function poll() {
    // 不要在 document.hidden 时提前返回：客户端的 DSH 视图在窗口隐藏 / 最小化到托盘时
    // 同样是 hidden，而那时恰恰需要能拉到主题（本地 HTTP 轮询，代价可忽略）。
    fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null })
      .then(function (data) { if (data && data.ok) apply(data) })
      .catch(function () { /* 宿主未就绪时静默重试 */ })
  }

  // ---------------------------------------------------------------- UI 微调
  //
  // 只依赖 DSH 客户端稳定的 data-* 钩子（不是哈希类名），只改观感不改行为：
  //   1) 本轮进行中折叠过程成员，直接显示答案（答案行带 data-turn-process-answer）
  // 输入框保持 DSH 原生的圆角卡片，不做任何改动（见下方备注）。
  // 关掉：window.__dshThemePack.setUiTweaks(false)
  var UI_TWEAKS_ID = 'dsh-theme-ui-tweaks'
  var UI_TWEAKS_CSS = [
    // 备注：这里原先还有一条「输入区并入对话面板」的微调
    //   body:has([data-chat-turn]) [data-composer-card]{width:100%;border-radius:0;box-shadow:none;...}
    // 它把输入框压成通栏直角。因为它是「对话态才生效」，所以切会话时先看到原生圆角卡片、
    // 对话一渲染出来就被压平——正是那个「先圆角后变样」的闪烁。现已移除，保留原生圆角风格。
    // 想退回通栏观感就把那条加回来；想整体关掉微调用 window.__dshThemePack.setUiTweaks(false)。
    '/* 2) 生成过程中直接显示答案：隐藏非答案的过程行 */',
    '[data-turn-process][data-open] [data-turn-process-member]:not([data-turn-process-answer]):not([data-turn-process-hidden]){display:none!important}',
    '/* 3) 输入框永远贴底：DSH 的输入区只是 position:sticky;bottom:0，当会话正文是空的时候',
    '   （例如历史还没加载出来 / 加载卡住）sticky 不会把它推下去，它就直接排在内容区最上面——',
    '   也就是「输入框跑到最上面、下面一片空白」。这里给座位加 margin-top:auto，让它在 flex 列',
    '   里吸到最底下；正文比一屏长时没有多余空间，auto 边距为 0，不影响正常滚动。',
    '   只在 active/settling 生效（hero 时输入框本来就该跟标题一起居中）。 */',
    '[data-phase="active"] [data-composer-seat],[data-phase="settling"] [data-composer-seat],',
    '[data-content-phase="active"] [data-composer-seat],[data-content-phase="settling"] [data-composer-seat]{margin-top:auto}',
  ].join('\n')

  // ---------------------------------------------------------------- 形状语言
  //
  // DSH 自己把「几何」也做成了设计 token：--dsw-radius-{xs,sm,md,lg,panel} 与
  // --dsw-shadow-lv3 在前端样式里被 var() 引用了 50+ 次（radius-sm 19 次、lg 13、
  // md 11、panel 5、shadow-lv3 2）。所以改这一组值，卡片/按钮/菜单/面板/弹窗就
  // 一起变成同一套圆角语言 —— 不碰 DOM、不用逐组件覆盖，DSH 升级也不会失配。
  //
  // 这些 token 在前端包里只有引用、没有定义（定义在别处），因此这里用 !important
  // 覆盖并以 html/body 为根下发继承。个别写字面量的组件（如输入卡 28px）不受影响。
  var SHAPE_ID = 'dsh-theme-shape'
  var SHAPE_TOKENS = {
    '--dsw-radius-xs': '6px',
    '--dsw-radius-sm': '8px',
    '--dsw-radius-md': '10px',
    '--dsw-radius-lg': '14px',
    '--dsw-radius-panel': '18px',
    '--dsw-shadow-lv3': '0 6px 24px rgba(16,26,64,.12)',
  }
  var SHAPE_CSS = (function () {
    var decls = Object.keys(SHAPE_TOKENS)
      .map(function (k) { return k + ':' + SHAPE_TOKENS[k] + '!important' })
      .join(';')
    return ':root,html,body,body[data-ds-dark-theme]{' + decls + '}'
  })()

  function installShape() {
    if (!document.head) return
    var el = document.getElementById(SHAPE_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = SHAPE_ID
      document.head.appendChild(el)
    }
    if (el.textContent !== SHAPE_CSS) el.textContent = SHAPE_CSS
  }

  function removeShape() {
    var el = document.getElementById(SHAPE_ID)
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }

  function installUiTweaks() {
    if (!document.head) return
    var el = document.getElementById(UI_TWEAKS_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = UI_TWEAKS_ID
      document.head.appendChild(el)
    }
    if (el.textContent !== UI_TWEAKS_CSS) el.textContent = UI_TWEAKS_CSS
  }

  function removeUiTweaks() {
    var el = document.getElementById(UI_TWEAKS_ID)
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }

  // ---------------------------------------------------------------- 布局自愈
  //
  // DSH 的会话视图有一个「会话一直停在加载中」的坏状态（settling）：输入框不是
  // sticky 在底部，而是直接排在**空的**内容区最上面，正文一片空白；内容区高度也
  // 可能整个塌掉。两种形态都只能靠重新加载页面复位（根因见仓库
  // lib/vendor-patch.js 里的会话日志 dispose 补丁）。
  //
  // 页面里这一段是最后一道保险，网页端（Chrome）和桌面客户端都覆盖：
  // 真卡住了就自己 reload 一次，不用用户去手动刷新。限流：至少隔 60 秒、
  // 每页最多 3 次，避免抖动时反复刷新。
  var LAYOUT_GUARD_MS = 4000
  var LAYOUT_RELOAD_GAP_MS = 60000
  var LAYOUT_MAX_RELOADS = 3
  var LAYOUT_SETTLING_STREAK = 8
  /** active 却一条轮次都没有，连续这么多个 tick（4s × 4 ≈ 16s）就判定历史没加载出来。 */
  var LAYOUT_EMPTY_STREAK = 4
  var layoutSettlingStreak = 0
  var layoutEmptyStreak = 0
  var layoutLastReload = 0
  var layoutReloads = 0
  var layoutArmedAt = Date.now()

  /**
   * 现在的页面是不是坏布局。
   * @returns {string|null} 'composer-pinned-top' | 'scroll-collapsed' | 'composer-offscreen' |
   *                        'settling-timeout' | 'transcript-empty' | null
   */
  function layoutDiagnosis() {
    try {
      var phaseEl = document.querySelector('[data-phase]')
      var scroll = document.querySelector('[data-conversation-scroll]')
      var card = document.querySelector('[data-composer-card]')
      if (!scroll || !card) return null
      var phase = phaseEl === null ? '' : String(phaseEl.getAttribute('data-phase') || '')
      var content = document.querySelector('[data-conversation-content]')
      var session = content === null ? '' : String(content.getAttribute('data-conversation-session') || '')
      var s = scroll.getBoundingClientRect()
      var c = card.getBoundingClientRect()
      var turns = scroll.querySelectorAll('[data-chat-turn]').length

      if (phase === 'active' && turns > 0) {
        if (s.height < 120 && window.innerHeight > 480) return 'scroll-collapsed'
        if (s.height - c.height > 200 && (c.top - s.top) < 40) return 'composer-pinned-top'
        // 输入框被挤出视口（用户报的「跑到上面/到外面去了」常见就是这个：
        // 竖向上它还在底部，但横向整体被推到屏幕外，看起来就是「没输入框」）。
        if (c.width > 0 && (c.right > window.innerWidth + 16 || c.left < -16)) return 'composer-offscreen'
      }
      // active 却一条轮次都没有：正常一两秒就渲染出来，一直不出来就是历史没加载出来。
      // 这时输入框也没有「对话」可以吸底，会停在内容区最上面、下面一片空白。
      if (phase === 'active' && turns === 0 && session !== '') {
        layoutEmptyStreak += 1
        if (layoutEmptyStreak >= LAYOUT_EMPTY_STREAK) return 'transcript-empty'
      } else {
        layoutEmptyStreak = 0
      }
      // settling 是正常瞬态（会话正在加载）；只有它一直不结束才是卡死。
      if (phase === 'settling' && session !== '') {
        layoutSettlingStreak += 1
        if (layoutSettlingStreak >= LAYOUT_SETTLING_STREAK) return 'settling-timeout'
      } else {
        layoutSettlingStreak = 0
      }
      return null
    } catch (error) {
      return null
    }
  }

  function guardLayout() {
    // 刚加载的头几秒不判：样式/数据都还在到位。
    if (Date.now() - layoutArmedAt < LAYOUT_GUARD_MS * 2) return
    var why = layoutDiagnosis()
    if (!why) return
    var now = Date.now()
    if (now - layoutLastReload < LAYOUT_RELOAD_GAP_MS) return
    if (layoutReloads >= LAYOUT_MAX_RELOADS) return
    layoutLastReload = now
    layoutReloads += 1
    layoutSettlingStreak = 0
    layoutEmptyStreak = 0
    window.location.reload()
  }

  /**
   * 把当前布局的关键几何写进 localStorage（键 DIAG_KEY）。
   *
   * 用途只有一个：用户报「输入框跑到最上面」时，宿主机没法直接连他的浏览器，
   * 但可以读 Chrome 的 Local Storage，从这份快照里拿到真实坐标去定位。
   * 开销极小（几秒一次、内容不变就不写），也不含任何对话内容。
   */
  var DIAG_KEY = 'dsh.ui.layoutDiag'
  var DIAG_BROKEN_KEY = 'dsh.ui.layoutDiagBroken'
  var lastDiagJson = ''

  function rectOf(el) {
    if (!el) return null
    var r = el.getBoundingClientRect()
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
  }

  function writeLayoutDiagnostics() {
    try {
      var scroll = document.querySelector('[data-conversation-scroll]')
      var card = document.querySelector('[data-composer-card]')
      var content = document.querySelector('[data-conversation-content]')
      var seat = document.querySelector('[data-composer-seat]')
      var phaseEl = document.querySelector('[data-phase]')
      var right = document.querySelector('[data-sidebar-right-panel]')
      var vars = {}
      if (content) {
        var cs = getComputedStyle(content)
        var names = ['--dsh-chat-content-width', '--dsh-chat-user-width', '--dsh-conversation-column-width', '--dsh-composer-card-max-width', '--dsh-composer-side-clearance']
        for (var i = 0; i < names.length; i++) vars[names[i]] = String(cs.getPropertyValue(names[i]) || '').trim().slice(0, 80)
      }
      var widest = []
      var all = document.querySelectorAll('body *')
      for (var j = 0; j < all.length && widest.length < 6; j++) {
        var rr = all[j].getBoundingClientRect()
        if (rr.width > window.innerWidth + 2 || rr.left < -2) {
          widest.push({ tag: all[j].tagName.toLowerCase(), cls: String(all[j].className || '').slice(0, 40), r: rectOf(all[j]) })
        }
      }
      var payload = {
        t: Date.now(),
        vp: [window.innerWidth, window.innerHeight, window.devicePixelRatio],
        doc: [document.documentElement.scrollWidth, document.documentElement.scrollLeft, document.documentElement.scrollHeight],
        phase: phaseEl ? String(phaseEl.getAttribute('data-phase') || '') : '',
        session: content ? String(content.getAttribute('data-conversation-session') || '') : '',
        turns: document.querySelectorAll('[data-chat-turn]').length,
        scroll: rectOf(scroll),
        card: rectOf(card),
        seat: rectOf(seat),
        content: rectOf(content),
        right: right ? { r: rectOf(right), mode: right.getAttribute('data-sidebar-right-mode'), collapsed: right.getAttribute('data-sidebar-right-collapsed') } : null,
        vars: vars,
        widest: widest,
        // 「一条轮次都没有」到底是没渲染视图，还是视图在但历史没来：
        // viewSlot=false → 会话视图插槽为空（插件没装上/加载失败）；
        // viewSlot=true 但 turns=0 → 视图在、历史没到（会话 open 卡住）。
        view: {
          slot: document.querySelectorAll('[data-slot="conversation.view"]').length,
          chatRoot: document.querySelectorAll('[data-conversation-scroll] [data-chat-turn]').length > 0,
          tab: (function () {
            var t = document.querySelector('[role="tab"][aria-selected="true"]')
            return t ? String(t.textContent || '').trim().slice(0, 12) : ''
          })()
        },
        diag: layoutDiagnosis()
      }
      var json = JSON.stringify(payload)
      if (json !== lastDiagJson) {
        lastDiagJson = json
        window.localStorage.setItem(DIAG_KEY, json)
        // 坏布局的快照单独留一份：自愈会重载页面，重载后这份证据不能被健康快照冲掉。
        if (payload.diag) {
          try { window.localStorage.setItem(DIAG_BROKEN_KEY, json) } catch (e) { /* 配额满等，忽略 */ }
        }
      }
    } catch (error) {
      /* 诊断写不进去不影响任何功能 */
    }
  }

  function start() {
    installShape()
    installUiTweaks()
    poll()
    setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll() })
    writeLayoutDiagnostics()
    setInterval(function () {
      writeLayoutDiagnostics()
      guardLayout()
    }, LAYOUT_GUARD_MS)
  }

  // 供调试：window.__dshThemePack
  window.__dshThemePack = {
    refresh: poll,
    get appliedTheme() { return appliedId },
    clear: function () { clearVars(); if (modeObserver) modeObserver.disconnect() },
    setUiTweaks: function (on) { if (on === false) removeUiTweaks(); else installUiTweaks() },
    setShape: function (on) { if (on === false) removeShape(); else installShape() },
    shapeTokens: SHAPE_TOKENS,
    /** 手动跑一次布局体检（返回诊断字符串或 null）。 */
    diagnoseLayout: function () { return layoutDiagnosis() },
    /** 立刻把布局快照写进 localStorage，并返回它。 */
    dumpLayout: function () { writeLayoutDiagnostics(); try { return JSON.parse(window.localStorage.getItem(DIAG_KEY) || 'null') } catch (e) { return null } },
    /** 布局自愈的计数（reloads/lastReload）。 */
    layoutGuard: function () { return { reloads: layoutReloads, lastReload: layoutLastReload, armedAt: layoutArmedAt } },
  }


  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
