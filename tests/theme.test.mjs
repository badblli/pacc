import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const theme = read("extension/content/theme.css")
const tokens = new Map([...theme.matchAll(/(--pacc-[\w-]+):\s*(var\(--[\w-]+, [^;]+\));/g)].map((m) => [m[1], m[2]]))

test("dört content yüzeyi yalnız ortak oyun renklerini kullanır", () => {
  assert.ok(tokens.size >= 14)
  for (const name of ["panel", "planner", "carousel", "overlay"]) {
    const css = read(`extension/content/${name}.css`)
    assert.doesNotMatch(css, /#(?:1b2030|252b3d|2a3044|313850|3b4360|20263a|0f1320|121a2b|1b263c|25324b|485b7a|0d1424|171c29|343524)\b/i)
    // İstisna: panelin mevcut siyah/beyaz derinlik gölgeleri ve diğer kapların siyah gölgeleri.
    for (const color of css.matchAll(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
      assert.match(color[0], /^(?:#000[68]|rgba\((?:0, 0, 0|255, 255, 255), [\d.]+\))$/, `${name}: ${color[0]}`)
    }
    for (const ref of css.matchAll(/var\((--pacc-[\w-]+)/g)) assert.ok(tokens.has(ref[1]), `${name}: ${ref[1]}`)
    assert.match(css, /Jost/)
    const js = read(`extension/content/${name}.js`)
    assert.ok(js.includes(`["theme", "${name}"]`), `${name}: tema önce yüklenmeli`)
    assert.ok(js.includes('sheets.join("\\n")'))
  }
  for (const helper of ["container", "box", "button", "chip"]) assert.ok(theme.includes(`.pacc-${helper}`))
})

test("panel belirteçleri açıldığında d10-panel CSS birebir korunur", () => {
  const expanded = read("extension/content/panel.css").replace(/var\((--(?:color-|border-)[\w-]+), var\((--pacc-[\w-]+)\)\)/g, (_, game, key) => {
    const token = tokens.get(key)
    assert.ok(token.startsWith(`var(${game}, `), `${key}: aynı oyun değişkeni korunmalı`)
    return token
  })
  // WP başlangıcındaki LF panel.css özeti; değerler, seçiciler ve geometri sabit kalır.
  assert.equal(createHash("sha256").update(expanded).digest("hex"), "7b819d87d6c1092ae8b652d274d10d6c2fccf994549fbd75bfdda5158cdb9773")
})

test("manifest yalnız tema kaynağını açar, izinler aynı kalır", () => {
  const manifest = JSON.parse(read("extension/manifest.json"))
  assert.deepEqual(manifest.permissions, ["storage", "unlimitedStorage", "alarms", "declarativeNetRequest"])
  assert.deepEqual(manifest.host_permissions, ["https://pokemon-auto-chess.com/*"])
  assert.ok(manifest.web_accessible_resources.some((entry) => entry.resources.includes("content/theme.css")))
})

test("popup ve harness Jost'u Türkçe kapsamıyla yerelden yükler", () => {
  const css = read("extension/popup/popup.css")
  assert.equal([...css.matchAll(/@font-face/g)].length, 2)
  assert.equal([...css.matchAll(/font-weight: 400 700/g)].length, 2)
  assert.match(css, /U\+0100-02BA/)
  assert.match(css, /font:[^;]+"Jost", sans-serif/)
  assert.doesNotMatch(css, /@import|https?:|var\(--color-/)
  for (const subset of ["latin", "latin-ext"]) {
    const name = `Jost-${subset}.woff2`
    assert.ok(css.includes(`../fonts/${name}`))
    const data = readFileSync(new URL(`../extension/fonts/${name}`, import.meta.url))
    assert.equal(data.subarray(0, 4).toString(), "wOF2")
    for (const harness of ["panel", "planner", "carousel", "overlay", "replay"]) {
      assert.ok(read(`tests/${harness}-harness.html`).includes(`../extension/fonts/${name}`))
    }
  }
  assert.match(read("extension/fonts/OFL.txt"), /SIL OPEN FONT LICENSE/)
})
