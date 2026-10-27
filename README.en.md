# DSH Plugins (DeepSeek Harness)

The plugins that ship with the [DSHSD desktop client](https://github.com/XiaoCXXX/-DSHSD-Deepseek-Harness-Super-Desktop),
extracted into their own repository: bundle them with the client, or install any of them into
any profile with `dsh plugin add`.

| Plugin | What it does | Shape |
|---|---|---|
| [`dsh-control-bar`](packages/dsh-control-bar) | Floating control strip: drag/collapse, connection dot, new session, jump to latest, theme cycle, reload | host routes + injected page script |
| [`dsh-theme-pack`](packages/dsh-theme-pack) | Theme pack: one switch drives both the DSH `--dsw-*` tokens and the desktop client palette; also carries the "composer pinned to the bottom" and "layout self-heal" fixes | host routes + injected page script |
| [`dsh-desktop-pet`](packages/dsh-desktop-pet) | Desktop pet: balance, peak/off-peak pricing, per-turn cost, speech bubble and sounds | host routes + injected page script |
| [`dsh-quick-ask`](packages/dsh-quick-ask) | Quick-ask backend: sends one prompt (optionally with an image) into a session and streams a one-line answer over SSE | host plugin (SSE route) |

## Install

Every plugin is a standard DSH bundle (`dsh.bundle.patch` in its `package.json`):

```bash
dsh plugin --profile web add link:<absolute path to packages/xxx>
# or straight from GitHub
dsh plugin --profile web add github:<user>/<repo>#subdirectory=packages/xxx
```

Restart `dsh web` afterwards, then refresh the browser.

## Relationship to the desktop client

On startup, DSHSD syncs the plugins under its `plugins/` directory into the profile
(`lib/provision.js`). This repository is the upstream source of those plugins; the client
repository keeps a copy synced at build time.

## Layout

```
packages/
  dsh-control-bar/     ← new: the web edition of the client's control strip
  dsh-theme-pack/
  dsh-desktop-pet/
  dsh-quick-ask/
```

Each package is self-contained (`package.json` + `cordis.patch.yml` + `lib/`); no cross-package
dependencies.

## License

MIT. `dsh-desktop-pet` is a derivative of the MIT-licensed
[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget);
attribution lives in that package's `package.json`.
