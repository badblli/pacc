// Sürüm zip'ini üretir: dist/PACC-v<sürüm>.zip
// Zip, son commit'teki extension/ klasörünü "PACC/" klasörü olarak içerir; kullanıcı zip'ten
// çıkarıp bu klasörü chrome://extensions sayfasına sürükler. Commitlenmemiş değişiklikler girmez.
//
// Kullanım: npm run pack

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(readFileSync(join(ROOT, "extension", "manifest.json"), "utf8"))
// --store: Chrome Web Store manifest.json'u zip'in kökünde ister (klasörsüz)
const store = process.argv.includes("--store")
const out = join(ROOT, "dist", `PACC-v${version}${store ? "-store" : ""}.zip`)

const dirty = execFileSync("git", ["status", "--porcelain", "--", "extension"], { cwd: ROOT, encoding: "utf8" }).trim()
if (dirty) console.warn("⚠ extension/ altında commitlenmemiş değişiklik var; zip son commit'ten üretiliyor.")

mkdirSync(dirname(out), { recursive: true })
execFileSync("git", ["archive", "--format=zip", ...(store ? [] : ["--prefix=PACC/"]), "-o", out, "HEAD:extension"], { cwd: ROOT })
console.log(`✔ ${out}`)
