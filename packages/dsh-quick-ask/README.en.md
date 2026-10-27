# dsh-quick-ask

The quick-ask backend behind the desktop client's portable bubble: one request is one prompt
(optionally with an image), the answer streams back over SSE, and the same session's model
condenses it into a one-line summary.

The bubble itself lives in the Electron client; this plugin is the host (Node) half only.

## What it does

```
GET /dsh-quick/ask?question=...&session=...&shot=...
  → text/event-stream
      event: accepted   the prompt was accepted by the session
      event: chunk      a streamed answer fragment
      event: summary    the one-line summary
      event: done       finished
      event: error      failure reason
```

- Injects `webServer`, `sessionController` and `llm`;
- Prompts go through `sessionController` into a session (the active one by default), so the
  exchange **stays in that session**;
- The summary uses the session's model route (`summaryRoute()`), falling back to a raw excerpt;
- Images are supported: attachments are sent along with the prompt.

## Install

```bash
dsh plugin --profile web add link:<absolute path of this directory>
```

Restart `dsh web`. In the desktop client, use the floating bar's quick-ask action; from a
browser you can hit `/dsh-quick/ask?question=...` directly.

## Notes

- Only meaningful against a **local** `dsh web`: it depends on the host's `sessionController`;
- No front-end code, no injected page script.
