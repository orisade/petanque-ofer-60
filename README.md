# Pétanque Ofer 60 🎉

A 3D pass-and-play pétanque game — a birthday gift for Ofer's 60th.

## Run

```bash
npm install
npm run dev     # open http://localhost:5173
```

## Teams (fixed rosters, one boule each per end)

- **Team Ofer**: Ofer 👑, Mom, Yariv, Eden
- **Team Shani**: Shani, Gali, Ori, Happy 🐕

The whole family stands on the sidelines in 3D; the current thrower walks to the circle.

## How to play

- Throw the jack, then take turns: aim with the mouse, **hold** to charge, **release** to throw. The team not holding the point throws next. First to 13.
- After each end, the **losing team** gets a trivia question about Ofer. Correct = one 🎁 perk token. Each team starts with 1 token.

## Perks (cost 1 🎁, buttons appear when usable)

1. **📢 Yariv's tsiktsuk** — available to Team Ofer whenever *Gali* is about to throw. Her throw goes wild.
2. **🐾 Happy digs a hole** — on Happy's turn, instead of throwing: click anywhere on the court and Happy digs a trap that sucks in rolling balls. Lasts until the end of the end.
3. **👯 Eden duplicates to Amit** — on Eden's turn: the camera flips and she throws from the *far side* of the court, behind the jack.

## Customize

- **Trivia questions**: edit `src/questions.js` (`correct` = index 0–3).
- **Family photos on faces**: drop images into `public/faces/<key>.png` — keys: `ofer, mom, yariv, eden, amit, shani, gali, ori, happy`. They replace the smiley faces automatically.
- **Shirt colors / names**: `ROSTERS` at the top of `src/main.js`.

## Tests

With the dev server running: `node smoke.mjs` (load + jack throw), `node test-perks.mjs` (full play-through hitting tsiktsuk + dig), `node test-twin.mjs` (Eden/Amit far-side throw).

## Two ways to share it

| You want them to… | Send them | They need |
|---|---|---|
| **just play** | `Petanque-Ofer-60.html` | nothing — double-click it |
| **change the code** | `Petanque-Ofer-60-source.zip` | Node.js, then `npm install && npm run dev` |

The `.html` is a *built* file: all the code is bundled and minified into one line,
so it is for playing, not editing. The zip is the real project with its folders
intact (`src/main.js`, `src/questions.js`, `src/style.css`, `src/assets/…`).

### One-click build

**Double-click `Build-and-Share.command`** (Mac) or `Build-and-Share.bat`
(Windows). It installs dependencies on first run, builds both files, prints
where they are and opens the folder. Nothing to type.

Or from a terminal:

```bash
npm run release   # both of the below
npm run package   # -> Petanque-Ofer-60.html   (playable single file)
npm run zip       # -> Petanque-Ofer-60-source.zip (editable project)
```

## Sending the playable file (Windows or Mac)

```bash
npm run package      # produces Petanque-Ofer-60.html (~3.3 MB)
```

That single file contains everything — code, styles, all the photos. Send it by
email, WhatsApp, Drive or a USB stick. The recipient just **double-clicks it**;
it opens in their browser and runs offline. Nothing to install, no server, works
the same on Windows and Mac. Because it's one local file, the family photos never
go on the internet.

Caveats: needs a reasonably current browser (Chrome, Edge, Safari, Firefox) with
WebGL. Gmail may block a `.html` attachment — zip it first, or share via Drive.

## Deploy as a web link (optional)

`npm run build` → static `dist/` for Vercel/Netlify.
