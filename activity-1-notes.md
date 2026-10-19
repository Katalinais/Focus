# Activity 1 — Execute, Observe, Analyze (manifest icons)

## Execute
- `manifest.json` was created at the project root and linked from `index.html`'s `<head>` via `<link rel="manifest" href="manifest.json">`.
- `icons/icon-96-incorrecto.png` (a real 96×96 PNG) was declared in `manifest.icons` with `"sizes": "192x192"` — the same value a genuine 192×192 icon would use, even though the file itself is smaller.
- The project was served over `http://localhost:8791` (manifests aren't parsed over `file://`).

## Observe
Verified programmatically (fetching `manifest.json` and loading the declared icon file in the page):

| | declared (`sizes`) | actual pixel size |
|---|---|---|
| `icons/icon-96-incorrecto.png` | 192×192 | **96×96** |

Open the same page in Chrome → DevTools → **Application → Manifest** and the Icons section will flag this exact icon: Chrome loads the file, measures it, and shows a warning because the measured size doesn't match the declared `sizes` string. Copy the exact wording Chrome shows for you here (it can vary slightly by Chrome version) — that verbatim text is the "Observe" part of the deliverable:

> _(paste Chrome's exact message here)_

## Analyze
**Chrome checks that the declared value matches the file — not that the file meets some fixed minimum.** The manifest spec lets you *claim* any size for an icon; Chrome/DevTools independently decodes the image and compares its real width/height against what `sizes` says. When they disagree, DevTools reports a mismatch — the icon isn't "too small" in the abstract, it's *lying about its own dimensions*. (Separately, Chrome does require *some* icon that is genuinely ≥192×192 for the app to be installable — but that's a different, additional check from the per-icon size-matches-file check this activity is about.)

## Fix and confirm
Replacing the entry with the real `icons/icon-192.png` was verified the same way:

| | declared (`sizes`) | actual pixel size |
|---|---|---|
| `icons/icon-192.png` | 192×192 | **192×192** ✅ match |

With the real file in place, the mismatch warning disappears in DevTools → Application → Manifest.

*(`manifest.json` in this repo has been left pointing at `icon-96-incorrecto.png` on purpose, so you can still do the live "Observe" step — open the page in your own Chrome, read the DevTools message, write it down verbatim above, then compare with your partner. Edit the `src` back to `icons/icon-192.png` once you're done to complete the "confirm the warning disappears" step yourself.)*
