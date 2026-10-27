# dsh-theme-pack

One switch, both surfaces: it drives the DSH web UI's `--dsw-*` design tokens **and** the
desktop client's palette, and it also carries two UI fixes that DSH does not ship upstream.

## Themes

Themes live in `lib/themes.js`; the desktop client's theme dropdown reads the same ids through
its own `lib/themes.js`, so the two sides never disagree.

State is a tiny JSON file, `$DSH_HOME/.dsh-theme.json`:

```
GET /dsh-theme/theme.json     current theme + palette + the list of themes
PUT /dsh-theme/theme.json     { "theme": "<id>" }
GET /dsh-theme/theme.js       the applier script injected into the DSH page
```

The injected applier writes the palette as inline `!important` custom properties on
`html`/`body`, pins `body[data-ds-dark-theme]` to the theme's `colorScheme`, and re-applies on
poll (DSH's own theme presenter rewrites those attributes, so they must be pressed down).

## UI fixes it carries

1. **Composer pinned to the bottom.** DSH's composer is only `position: sticky; bottom: 0`.
   When the transcript is empty (history still loading, or stuck) sticky has nothing to push
   against and the input box lands at the *top* of the content area with blank space below.
   The applier adds `margin-top: auto` to the composer seat for `active`/`settling` phases.
2. **Layout self-heal.** Every 4 s the applier checks the conversation: composer pushed
   off-screen horizontally, collapsed transcript, a session stuck "loading", or an `active`
   session with zero turns. If one holds, the page reloads itself (throttled: ≥60 s apart,
   at most 3 per page). A `localStorage` snapshot of the geometry is kept for diagnosis
   (`dsh.ui.layoutDiag` / `dsh.ui.layoutDiagBroken`).

## Install

```bash
dsh plugin --profile web add link:<absolute path of this directory>
```

Restart `dsh web`, then refresh the browser.

## Turn the extra layers off

```js
window.__dshThemePack.setUiTweaks(false)   // the "show answer, hide process rows" tweak
window.__dshThemePack.setShape(false)      // the global radius/shadow token layer
window.__dshThemePack.diagnoseLayout()     // run the layout check by hand
```
