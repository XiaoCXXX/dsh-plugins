# dsh-desktop-pet

A desktop pet for the DSH web UI: a small mascot anchored in the corner that shows your
balance, peak/off-peak pricing and per-turn spend, with a speech bubble, sounds and a petting
animation.

It is a derivative of the MIT-licensed
[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget):
the package name, the route prefix (`/dsh-whale` → `/dsh-pet`), the artwork, the lines and the
animation were all reworked. The original MIT notice is reproduced in `LICENSE`.

## What it shows

- **Balance** of the active account, refreshed on an interval;
- **Peak / off-peak pricing** for the current moment;
- **Per-turn spend** for the latest turn;
- **Speech bubble** with rotating lines; clicking the pet cycles the bubble;
- **Sounds** on interaction and on spend events;
- **Panel**: appearance, size, bubble options, sounds, usage accounting (metered vs. token),
  peak pricing, per-turn cost hints, scrollbar/width avoidance.

## Host half

Registered under `/dsh-pet/*` on the DSH web server (balance proxy, usage memory, size memory).
State files may be written to `$DSH_HOME` so a read-only `node_modules` does not matter.

## Install

```bash
dsh plugin --profile web add link:<absolute path of this directory>
```

Restart `dsh web`, then refresh the browser. Settings live in the pet's own panel; size and
usage memory are kept under `$DSH_HOME`.

## Notes

- Requires a signed-in DeepSeek account for the balance/usage numbers; without one the pet still
  appears, the numbers simply do not resolve;
- The artwork in `assets/pet.png` ships with this plugin.
