# dsh-quick-ask

给「便携悬浮窗」用的快速提问后端：一次请求 = 一次提问（可带图），回答用 SSE 流式推回，
再由同一个会话里的模型压成一句话摘要。

悬浮窗本身在桌面客户端里（Electron 的小窗口），这个插件只负责宿主（Node）这一侧。

## 它做什么

```
GET /dsh-quick/ask?question=...&session=...&shot=...
  → text/event-stream
      event: accepted   一次提问已被会话接受
      event: chunk      回答流式片段
      event: summary    一句话摘要
      event: done       结束
      event: error      失败原因
```

- 依赖注入 `webServer`、`sessionController`、`llm`；
- 提问通过 `sessionController` 送进指定会话（默认当前活动会话），因此回答会**留在会话里**；
- 摘要走同一会话的模型路由（`summaryRoute()`），失败时退回原文片段；
- 支持附图：图片以 attachment 形式随提问一起发送。

## 安装

```bash
dsh plugin --profile web add link:<这个目录的绝对路径>
```

重启 `dsh web`。桌面客户端里点悬浮栏的「快速提问」即可使用；也可以在浏览器里直接请求
`/dsh-quick/ask?question=...` 验证。

## 说明

- 只对**本地** `dsh web` 有意义：它依赖 `sessionController` 这个宿主服务；
- 没有前端代码，不注入页面脚本。
