# DSH Plugins（DeepSeek Harness 插件合集）

这是 [DSHSD 桌面客户端](https://github.com/XiaoCXXX/-DSHSD-Deepseek-Harness-Super-Desktop) 随包分发的
几个 DSH 插件，抽出来单独维护：可以随客户端分发，也可以用 `dsh plugin add` 单独装到任意 profile。

| 插件 | 作用 | 形态 |
|---|---|---|
| [`dsh-control-bar`](packages/dsh-control-bar) | 悬浮控制条：拖动/折叠、连接状态、新会话、回到最新、主题循环、重新加载 | 宿主路由 + 注入页面脚本 |
| [`dsh-theme-pack`](packages/dsh-theme-pack) | 主题包：一次切换同时驱动 DSH 界面的 `--dsw-*` 令牌与桌面客户端配色；另含「输入框贴底」「布局自愈」两条界面修正 | 宿主路由 + 注入页面脚本 |
| [`dsh-desktop-pet`](packages/dsh-desktop-pet) | 桌面宠物：右上角形态，显示余额、峰谷计价、每轮花销，带台词气泡与音效 | 宿主路由 + 注入页面脚本 |
| [`dsh-quick-ask`](packages/dsh-quick-ask) | 快速提问后端：把一次提问（可附图）送进会话，用 SSE 把回答压成一句话推给悬浮窗 | 纯宿主插件（SSE 路由） |

## 安装

每个插件都是标准 DSH bundle（`package.json` 里声明 `dsh.bundle.patch`），装法一致：

```bash
dsh plugin --profile web add link:<packages/xxx 的绝对路径>
# 或从 GitHub 装
dsh plugin --profile web add github:用户名/仓库名#subdirectory=packages/xxx
```

装完**重启 `dsh web`**，再刷新浏览器。

> 只装 `dsh-control-bar` / `dsh-theme-pack` 就够日常用了；宠物和快速提问偏桌面客户端场景。

## 和桌面客户端的关系

DSHSD 启动时会把 `plugins/` 下的插件同步进 profile（`lib/provision.js`）。
本仓库是这些插件的**上游源码**；客户端仓库里的是构建时同步过去的副本。

## 目录结构

```
packages/
  dsh-control-bar/     ← 新增：客户端控件的网页版
  dsh-theme-pack/
  dsh-desktop-pet/
  dsh-quick-ask/
```

每个包自成一体（`package.json` + `cordis.patch.yml` + `lib/`），没有跨包依赖。

## 许可

MIT。`dsh-desktop-pet` 基于 MIT 许可的
[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)
二次开发，署名见该包 `package.json`。
