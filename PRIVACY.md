# PACC privacy policy

_Last updated: 2026-10-19_

PACC (Poké Auto Chess Coach) is a browser extension that shows advice while you play Pokémon Auto Chess at https://pokemon-auto-chess.com.

**PACC does not collect, sell or share any personal data.** It has no account, no analytics, no tracking and no server of its own.

What it does with data, all inside your browser:

- **Game state on the page.** While you are on pokemon-auto-chess.com, PACC reads the game state that the game already sends to your browser (your board, shop, pick choices, held items) to calculate advice. It is processed in memory and never sent anywhere.
- **Meta report.** PACC downloads the game's public meta statistics (`/meta-v2`, `/meta/pokemons`, `/meta/items`, `/types-trigger`) from pokemon-auto-chess.com and caches a compact copy in `chrome.storage.local`.
- **Settings.** Your choices (language, panel on/off, overlay on/off, elo tier, panel position) and a summary of your last game are stored in `chrome.storage.local` on your device.
- **Turkish translation.** If enabled, the game's English text file request is redirected to the Turkish file bundled inside the extension (`declarativeNetRequest`). No external server is involved.

PACC only runs on `https://pokemon-auto-chess.com/*` and makes network requests only to that site. Removing the extension deletes all its stored data.

Questions: open an issue at https://github.com/badblli/pacc/issues.
