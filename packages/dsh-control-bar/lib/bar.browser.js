/* dsh-control-bar —— 注入到 DSH Web 页面的悬浮控制条。
 *
 * 为什么是「注入脚本」而不是 React 客户端插件：控制条要在**任何** DSH 页面上都能用，
 * 不依赖客户端的模块加载器/插槽系统；宿主半（lib/index.js）用 tapIndex 把它塞进
 * index.html，纯 DOM + Shadow DOM，页面结构怎么变都不影响。
 *
 * 功能：
 *   · 拖动 / 折叠 / 位置与折叠状态记忆（localStorage）
 *   · 连接状态灯（定时探一次首页）
 *   · 新会话（点侧栏那个按钮，不猜内部 API）
 *   · 回到最新（把对话区滚到底）
 *   · 主题循环（有 dsh-theme-pack 时才出现）
 *   · 重新加载页面
 *   · Ctrl/⌘+Shift+. 显示/隐藏
 */
(function () {
  'use strict'

  if (window.__dshControlBar) return

  var STORAGE_KEY = 'dsh.controlBar.v1'
  var LANG = (navigator.language || 'en').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
  var TEXT = {
    zh: {
      grip: '拖动（双击折叠/展开）',
      online: '连接正常',
      offline: '连接异常',
      newSession: '新会话',
      latest: '回到最新',
      theme: '切换主题',
      reload: '重新加载界面',
      collapse: '折叠',
      expand: '展开',
    },
    en: {
      grip: 'Drag (double-click to collapse)',
      online: 'Connected',
      offline: 'Disconnected',
      newSession: 'New session',
      latest: 'Jump to latest',
      theme: 'Next theme',
      reload: 'Reload UI',
      collapse: 'Collapse',
      expand: 'Expand',
    },
  }[LANG]

  function load() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {}
    } catch (error) {
      return {}
    }
  }

  function save(patch) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patch))
    } catch (error) {
      /* 隐私模式等写不进去，不影响使用 */
    }
  }

  var state = load()

  // 默认位置：对话区左下角。不选左下角 16px 是因为那里正好压住侧栏「设置」，
  // 也不选右下角（桌面宠物在那儿）、底部中间（输入框在那儿）。
  function defaultLeft() {
    var sidebar = 300
    return Math.min(sidebar, Math.max(16, window.innerWidth - 220))
  }
  function defaultTop() {
    return Math.max(16, window.innerHeight - 76)
  }

  var host = document.createElement('div')
  host.id = 'dsh-control-bar'
  host.setAttribute('data-plugin', 'dsh-control-bar')
  host.style.cssText = [
    'position:fixed',
    'z-index:2147483000',
    'left:' + (typeof state.x === 'number' ? state.x : defaultLeft()) + 'px',
    'top:' + (typeof state.y === 'number' ? state.y : defaultTop()) + 'px',
    'width:0',
    'height:0',
    'pointer-events:none',
  ].join(';')

  var root = host.attachShadow({ mode: 'open' })

  var style = document.createElement('style')
  style.textContent = [
    ':host{all:initial}',
    '.bar{',
    '  pointer-events:auto;',
    '  /* 宿主是 0 尺寸的定位锚点；块级 flex 会被它压成 0 宽，',
    '     所以必须 inline-flex + max-content，让胶囊按内容撑开。 */',
    '  display:inline-flex;width:max-content;',
    '  align-items:center;gap:2px;',
    '  padding:4px;border-radius:999px;',
    '  background:rgba(22,24,31,.82);',
    '  color:#e8eaf2;',
    '  box-shadow:0 6px 24px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.08) inset;',
    '  backdrop-filter:blur(12px) saturate(140%);',
    '  font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
    '  user-select:none;-webkit-user-select:none;',
    '  transform:translateY(0);transition:opacity .16s ease,transform .16s ease;',
    '}',
    '.bar.collapsed{padding:0;border-radius:50%}',
    '.bar.collapsed .btn,.bar.collapsed .grip{display:none}',
    '.grip{cursor:grab;padding:0 6px 0 8px;letter-spacing:1px;color:rgba(232,234,242,.45);touch-action:none}',
    '.grip:active{cursor:grabbing}',
    '.dot{width:8px;height:8px;border-radius:50%;flex:none;margin:0 8px 0 8px;background:#6b7280;box-shadow:0 0 0 2px rgba(255,255,255,.06)}',
    '.dot.on{background:#3ddc84;box-shadow:0 0 8px rgba(61,220,132,.55)}',
    '.dot.off{background:#ff6b6b;box-shadow:0 0 8px rgba(255,107,107,.5)}',
    '.btn{',
    '  flex:none;',
    '  width:30px;height:30px;border:0;border-radius:50%;',
    '  background:transparent;color:inherit;font-size:15px;line-height:1;',
    '  display:flex;align-items:center;justify-content:center;cursor:pointer;',
    '  transition:background .12s ease,transform .12s ease;',
    '}',
    '.btn:hover{background:rgba(255,255,255,.12)}',
    '.btn:active{transform:scale(.94)}',
    '.btn:focus-visible{outline:2px solid rgba(120,170,255,.9);outline-offset:2px}',
    '.btn[hidden]{display:none}',
    '.collapsedDot{',
    '  pointer-events:auto;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;',
    '  background:rgba(22,24,31,.82);color:#e8eaf2;display:none;align-items:center;justify-content:center;',
    '  box-shadow:0 6px 24px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.08) inset;font-size:15px;',
    '}',
    '.bar.collapsed + .collapsedDot{display:flex}',
  ].join('\n')
  root.appendChild(style)

  var bar = document.createElement('div')
  bar.className = 'bar'
  root.appendChild(bar)

  var grip = document.createElement('span')
  grip.className = 'grip'
  grip.textContent = '⠿'
  grip.title = TEXT.grip
  bar.appendChild(grip)

  var dot = document.createElement('span')
  dot.className = 'dot'
  dot.title = TEXT.online
  bar.appendChild(dot)

  function button(label, title, onClick) {
    var el = document.createElement('button')
    el.type = 'button'
    el.className = 'btn'
    el.textContent = label
    el.title = title
    el.setAttribute('aria-label', title)
    el.addEventListener('click', function (event) {
      event.preventDefault()
      event.stopPropagation()
      onClick(el)
    })
    bar.appendChild(el)
    return el
  }

  var themeButton = button('◐', TEXT.theme, function () {
    cycleTheme(themeButton)
  })
  themeButton.hidden = true

  button('＋', TEXT.newSession, function () {
    clickByText(/新会话|New session|新しい会話/i)
  })
  button('⤓', TEXT.latest, function () {
    scrollToLatest()
  })
  button('⟳', TEXT.reload, function () {
    window.location.reload()
  })
  var collapseButton = button('⌄', TEXT.collapse, function () {
    setCollapsed(true)
  })

  var collapsedDot = document.createElement('button')
  collapsedDot.type = 'button'
  collapsedDot.className = 'collapsedDot'
  collapsedDot.textContent = '⠿'
  collapsedDot.title = TEXT.expand
  collapsedDot.addEventListener('click', function () {
    setCollapsed(false)
  })
  root.appendChild(collapsedDot)

  function setCollapsed(value) {
    bar.classList.toggle('collapsed', value)
    state.collapsed = value
    save(state)
  }

  // ---------------------------------------------------------------- 动作

  /** 点页面上第一个「文字匹配」的可点击元素（侧栏按钮的文案是稳定的）。 */
  function clickByText(pattern) {
    var candidates = document.querySelectorAll('button,[role="button"],a')
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i]
      var text = String(el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text || text.length > 40) continue
      if (!pattern.test(text)) continue
      el.click()
      return true
    }
    return false
  }

  function scrollToLatest() {
    var scroller = document.querySelector('[data-conversation-scroll]')
    if (!scroller) return
    scroller.scrollTop = scroller.scrollHeight
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  }

  /** 主题循环：只有装了 dsh-theme-pack（能读到 /dsh-theme/theme.json）才启用。 */
  var themes = null
  function loadThemes() {
    fetch('/dsh-theme/theme.json', { cache: 'no-store' })
      .then(function (res) {
        return res.ok ? res.json() : null
      })
      .then(function (data) {
        if (!data || !data.ok || !Array.isArray(data.themes) || data.themes.length < 2) return
        themes = data
        themeButton.hidden = false
      })
      .catch(function () {
        /* 没装主题包就不显示这个按钮 */
      })
  }

  function cycleTheme(el) {
    if (!themes) return
    var ids = themes.themes.map(function (t) {
      return t.id
    })
    var at = ids.indexOf(themes.theme)
    var next = ids[(at + 1) % ids.length]
    el.style.opacity = '.5'
    fetch('/dsh-theme/theme.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    })
      .then(function (res) {
        return res.ok ? res.json() : null
      })
      .then(function (data) {
        if (data && data.ok) themes = data
      })
      .catch(function () {})
      .then(function () {
        el.style.opacity = ''
      })
  }

  // ---------------------------------------------------------------- 连接状态

  var online = null
  function probe() {
    fetch('/', { method: 'GET', cache: 'no-store' })
      .then(function (res) {
        setOnline(res.status < 500)
      })
      .catch(function () {
        setOnline(false)
      })
  }

  function setOnline(value) {
    if (online === value) return
    online = value
    dot.className = 'dot ' + (value ? 'on' : 'off')
    dot.title = value ? TEXT.online : TEXT.offline
  }

  // ---------------------------------------------------------------- 拖动

  var drag = null
  grip.addEventListener('pointerdown', function (event) {
    event.preventDefault()
    var rect = bar.getBoundingClientRect()
    drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    grip.setPointerCapture(event.pointerId)
  })
  grip.addEventListener('pointermove', function (event) {
    if (!drag) return
    moveTo(event.clientX - drag.dx, event.clientY - drag.dy)
  })
  grip.addEventListener('pointerup', function (event) {
    if (!drag) return
    drag = null
    try {
      grip.releasePointerCapture(event.pointerId)
    } catch (error) {}
    save(state)
  })
  grip.addEventListener('dblclick', function () {
    setCollapsed(!bar.classList.contains('collapsed'))
  })

  function moveTo(left, top) {
    var width = bar.offsetWidth || 34
    var height = bar.offsetHeight || 34
    var maxLeft = Math.max(4, window.innerWidth - width - 4)
    var maxTop = Math.max(4, window.innerHeight - height - 4)
    var x = Math.min(Math.max(4, left), maxLeft)
    var y = Math.min(Math.max(4, top), maxTop)
    host.style.left = x + 'px'
    host.style.top = y + 'px'
    state.x = Math.round(x)
    state.y = Math.round(y)
  }

  // 窗口变小后把控制条拉回视口内
  window.addEventListener('resize', function () {
    var rect = bar.getBoundingClientRect()
    moveTo(rect.left, rect.top)
  })

  // ---------------------------------------------------------------- 显示/隐藏

  function setVisible(visible) {
    host.style.display = visible ? '' : 'none'
    state.hidden = !visible
    save(state)
  }

  document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
    if (event.key !== '.' && event.key !== '>') return
    event.preventDefault()
    setVisible(host.style.display === 'none')
  })

  // ---------------------------------------------------------------- 启动

  function start() {
    if (document.getElementById('dsh-control-bar')) return
    document.body.appendChild(host)
    if (state.collapsed) setCollapsed(true)
    if (state.hidden) host.style.display = 'none'
    // 首帧后再量一次：字体/内容到位后尺寸才准
    requestAnimationFrame(function () {
      var rect = bar.getBoundingClientRect()
      if (typeof state.x !== 'number' || typeof state.y !== 'number') {
        moveTo(defaultLeft(), defaultTop() - rect.height)
      } else {
        moveTo(state.x, state.y)
      }
    })
    loadThemes()
    probe()
    setInterval(probe, 10000)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // 让 DSH 自己的 React 先挂载，避免我们把宿主插到会被替换的节点里
      setTimeout(start, 1200)
    })
  } else {
    setTimeout(start, 1200)
  }

  window.__dshControlBar = {
    show: function () {
      setVisible(true)
    },
    hide: function () {
      setVisible(false)
    },
    collapse: setCollapsed,
    version: '0.1.0',
  }
})()
