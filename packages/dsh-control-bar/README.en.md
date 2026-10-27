# dsh-control-bar

The desktop client's floating control strip, rebuilt as a DSH plugin so the browser gets it too.

It injects a small draggable bar into the DSH web page:

| Control | Action |
|---|---|
| ⠿ | Drag to move; double-click to collapse/expand |
| ● | Connection dot (probes the index every 10s) |
| ◐ | Cycle themes (**only when [dsh-theme-pack](../dsh-theme-pack) is installed**) |
| ＋ | New session |
| ⤓ | Jump to latest (scroll the transcript to the bottom) |
| ⟳ | Reload the UI |
| ⌄ | Collapse to a dot |

- Position, collapsed and hidden state persist in `localStorage` (`dsh.controlBar.v1`);
- `Ctrl/⌘ + Shift + .` toggles visibility;
- A plain injected script (Shadow DOM for style isolation): no React slot contract, no Electron.

## Install into a profile

```bash
dsh plugin --profile web add link:<absolute path of this directory>
```

Restart `dsh web`, then refresh the browser.

## Why not the Electron strip

The desktop client's strip is a separate Electron `WebContentsView`, usable only inside
the client. This plugin puts the same affordances in the page itself, so the browser and
the client's DSH view share one control surface without host IPC.
