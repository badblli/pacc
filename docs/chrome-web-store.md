# Chrome Web Store submission kit

Everything needed to publish PACC on the Chrome Web Store. Submitting needs a developer account
(one-time US$5 fee) at https://chrome.google.com/webstore/devconsole — the account owner does that.

## 1. Package

```bash
npm run pack -- --store
```

Upload `dist/PACC-v<version>-store.zip` (manifest at the zip root). For later updates bump `version`
in `extension/manifest.json` and `package.json`, commit, then pack again.

## 2. Store listing

- **Name:** comes from the manifest (`PACC — Auto Chess Coach`, localized).
- **Category:** Games (Tools as fallback).
- **Languages:** English (default), Turkish.

**Short description (EN, ≤132 chars):**
On-screen pick, shop and item advice for Pokémon Auto Chess, with % fit badges, item combine hints and a meta panel.

**Detailed description (EN):**
PACC is a free, open-source coach for Pokémon Auto Chess (pokemon-auto-chess.com).

• Pick advice on screen — starter, add pick, unique/legendary and item choices get a green "Recommended · %" or red "Avoid" badge with a short reason.
• Shop highlights — units that complete a synergy, evolve something you own, or belong to a meta comp that matches your board.
• Item combine hints — see which two components to merge and which unit should hold the item (Alt+I to toggle, Alt+O to hide everything).
• Coach panel (Alt+P) — meta comps with synergy icons, most-used items per Pokémon, evolution chains, economy tips.
• English and Turkish interface, plus an optional full Turkish translation of the game.

Advice is based on the game's own public meta report and your current team. PACC is read-only: it never clicks, moves or plays for you, and sends nothing anywhere. Source: https://github.com/badblli/pacc

Fan-made and not affiliated with Pokémon Auto Chess, The Pokémon Company, Nintendo or Game Freak.

**Turkish short description (TR):**
Pokémon Auto Chess için ekranda seçim, dükkan ve item önerileri: % uyum rozetleri, item birleştirme ipuçları ve meta paneli.

## 3. Privacy tab

- **Single purpose:** Show gameplay advice and an optional Turkish translation while playing Pokémon Auto Chess.
- **Privacy policy URL:** https://github.com/badblli/pacc/blob/main/PRIVACY.md
- **Data usage:** check "I do not collect or use user data" categories — none collected. Certify the three limited-use statements.
- **Remote code:** No.

**Permission justifications:**

| Permission | Why |
|---|---|
| `storage`, `unlimitedStorage` | Cache the game's meta report (~1 MB after compaction) and store settings locally. |
| `alarms` | Check the public meta report for updates every 6 hours. |
| `declarativeNetRequest` | Optional: serve the bundled Turkish translation instead of the game's English text file. |
| Host `https://pokemon-auto-chess.com/*` | Read the game page to show advice and download the public meta report. Only this site. |

## 4. Screenshots (1280×800 or 640×400, 1–5 images)

Take them in a real game with the browser window at 1280×800:
1. Starter choice with the green "Recommended" badge and tooltip.
2. Shop with highlighted slots.
3. Item combine hint on the board (① ② and the target ring).
4. Coach panel — Pokémon search with evolution chain.
5. Comps tab with synergy icons.

Small promo tile 440×280: the logo (`extension/icons/icon-128.png`) on the dark checkerboard background.

## 5. Review risks

- **Trademark:** listings that use "Pokémon" can be rejected for intellectual-property reasons even with the fan-made disclaimer. If rejected, keep the name "PACC — Auto Chess Coach" and refer to the game only as "pokemon-auto-chess.com".
- **Game rules:** the game's Terms of Service forbid "unauthorized automation/tools". Getting a written OK from the game's developers (Discord or keldaan.ag@gmail.com) before publishing is strongly recommended.
