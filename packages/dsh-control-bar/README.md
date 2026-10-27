# dsh-control-bar

把桌面客户端的「悬浮控制条」做成 DSH 插件，网页端也能用。

它往 DSH Web 页面注入一个可拖动的小条，提供：

| 按钮 | 作用 |
|---|---|
| ⠿ | 拖动位置；双击折叠/展开 |
| ● | 连接状态灯（每 10 秒探一次首页） |
| ◐ | 循环切换主题（**装了 [dsh-theme-pack](../dsh-theme-pack) 才出现**） |
| ＋ | 新会话 |
| ⤓ | 回到最新（对话区滚到底） |
| ⟳ | 重新加载界面 |
| ⌄ | 折叠成一个圆点 |

- 位置、折叠、显示状态记在 `localStorage`（`dsh.controlBar.v1`）；
- `Ctrl/⌘ + Shift + .` 显示/隐藏；
- 纯前端的注入脚本（Shadow DOM 隔离样式），不依赖 React 插槽，也不依赖 Electron。

## 装到自己的 profile

```bash
dsh plugin --profile web add link:<这个目录的绝对路径>
```

然后重启 `dsh web`，刷新浏览器。

## 为什么不是 Electron 的悬浮条

桌面客户端里那条是 Electron 的独立 `WebContentsView`，只能在客户端里用。
这个插件把同样的能力做进页面：浏览器、桌面客户端的 DSH 视图都能看到同一套控件，
而且不需要宿主 IPC。
