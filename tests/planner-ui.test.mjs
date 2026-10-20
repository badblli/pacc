// Tarayıcı gerektirmeyen sözleşme testi: gerçek content script ve sahte gölge ağacı.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { test } from "node:test"

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const catalog = JSON.parse(read("extension/i18n/en.json"))
const plan = [{ name: "CHARIZARD", x: 0, y: 1, items: [] }]
const cluster = { id: "fire", rank: 3, count: 100, winrate: 25, synergies: { FIRE: 4 }, pokemons: [{ name: "CHARIZARD", frequency: 1 }] }

async function setup() {
  const handlers = {}, rootHandlers = {}, nodes = {}, sent = [], appended = [], storage = []
  const timers = new Map()
  const dialog = { appendChild(el) { el.parentNode = this }, querySelector() { return { getBoundingClientRect: () => ({ left: 950, top: 16, width: 44, height: 44 }) } } }
  let serial = 0, top = false
  const surface = {
    innerHTML: "",
    querySelector(selector) {
      if (selector.startsWith(".") && !this.innerHTML.includes(`class="${selector.slice(1)}`)) return null
      nodes[selector] ??= { style: {}, focus() {} }
      return nodes[selector]
    },
    querySelectorAll(selector) { return selector.startsWith(".drawer button") ? this.focusables ?? [] : [] }
  }
  const style = { textContent: "" }
  const root = {
    getElementById: () => surface, querySelector: () => style,
    addEventListener: (type, fn) => { rootHandlers[type] = fn }
  }
  const attrs = new Map()
  const host = {
    attachShadow: () => root, setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k),
    matches: () => top, showPopover() { top = true }, hidePopover() { top = false }, remove() {}
  }
  const data = { family: { CHARMANDER: "CHARMANDER", CHARIZARD: "CHARMANDER", VULPIX: "VULPIX", NINETALES: "VULPIX" }, recipes: { FIRE_STONE: ["FOSSIL_STONE", "CHARCOAL"] } }
  const engine = {
    planFit: () => ({ best: [{ cluster, fit: 50 }], missing: [{ pkm: "NINETALES" }], synergies: [{ syn: "FIRE", count: 1, next: 4, need: 3 }] }),
    planRecommendations: () => [{ pkm: "NINETALES", fit: 80, rarity: "RARE", reasons: [{ kind: "next", syn: "FIRE" }] }],
    planItems: () => [{ pkm: "CHARIZARD", items: ["FIRE_STONE"], have: [] }],
    compToPlan: (ctx, c, opts) => opts.keepPlan ? [...opts.keepPlan, { name: "NINETALES", x: 1, y: 1, items: [] }] : structuredClone(plan)
  }
  const window = {
    PacAdvisor: engine,
    PacI18n: { ready: Promise.resolve(), t: (k, vars = {}) => (catalog[k] ?? k).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ""),
      has: k => k in catalog, escapeHtml: s => String(s ?? "").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
      humanize: k => k, number: String, onChange() {}, gameText: async () => ({}) },
    addEventListener: (k, fn) => { handlers[k] = fn }, postMessage: msg => sent.push(msg), innerWidth: 1280
  }
  const location = { pathname: "/lobby", origin: "https://pokemon-auto-chess.com" }
  const context = vm.createContext({ window, location,
    document: { getElementById: () => null, querySelector: () => dialog, createElement: () => host, documentElement: { appendChild(el) { el.parentNode = this; appended.push(el) } } },
    chrome: { runtime: { id: "test", getURL: p => p }, storage: { local: { get: async () => ({ meta: { clusters: [cluster] } }) }, onChanged: { addListener: fn => storage.push(fn) } } },
    fetch: async () => ({ text: async () => "", json: async () => data }),
    setInterval: () => 1, clearInterval() {}, setTimeout: fn => { timers.set(++serial,fn); return serial }, clearTimeout: id => timers.delete(id)
  })
  vm.runInContext(read("extension/content/planner.js"), context)
  for (let n=0;n<12;n++) await Promise.resolve()
  const message = (data, source = window) => handlers.message({ data, source })
  const click = (dataset) => rootHandlers.click({ target: { closest: () => ({ dataset, disabled: false }) } })
  const rects = { modal:{x:10,y:10,w:1000,h:700}, header:{x:10,y:10,w:1000,h:56}, picker:{x:40,y:400,w:900,h:250}, actions:{x:40,y:150,w:300,h:44}, board:{x:40,y:220,w:600,h:120} }
  const planner = (board = plan, open = true) => message({type:"pac-yardimci:planner",planner:{open,board:structuredClone(board),rects:open?rects:null}})
  return { rects, root, rootHandlers, dialog, surface, sent, nodes, message, click, planner, location, storage, window, attrs, appended, host, timers }
}

test("planlayıcı hizası, seçici ve doğru planner-set sözleşmesi", async () => {
  const h = await setup()
  assert.equal(h.sent[0].type, "pac-yardimci:hello")
  h.planner()
  assert.equal(h.appended.length, 1)
  assert.equal(h.appended[0], h.host)
  assert.equal(h.host.parentNode, h.dialog)
  assert.equal(h.nodes[".pacc-toggle"].style.top, "16px")
  assert.equal(h.nodes[".pacc-toggle"].style.left, "786px")
  assert.equal(786 + 148 + 16, 950)
  assert.equal(h.attrs.has("popover"), false)
  assert.doesNotMatch(h.surface.innerHTML, /class="drawer"/)
  assert.equal((h.surface.innerHTML.match(/<button/g) ?? []).length, 1)
  h.click({action:"toggle"})
  assert.equal(h.nodes[".drawer"].style.left, "590px")
  assert.equal(h.nodes[".drawer"].style.width, "420px")
  assert.equal(h.nodes[".drawer"].style.top, "66px")
  assert.equal(h.nodes[".drawer"].style.height, "644px")
  assert.match(h.surface.innerHTML, /role="dialog"/)
  assert.match(h.surface.innerHTML, /class="recommendations"/)
  h.click({action:"tab",tab:"myPlan"})
  assert.match(h.surface.innerHTML, /Missing core units/)
  assert.match(h.surface.innerHTML, /Item plan/)
  h.click({action:"tab",tab:"meta"})
  assert.match(h.surface.innerHTML, /Avg\. 3.00/)
  h.click({action:"replace"})
  const msg = h.sent.at(-1)
  assert.equal(msg.type,"pac-yardimci:planner-set")
  assert.deepEqual(JSON.parse(JSON.stringify(msg.board)), plan)
  assert.equal(typeof msg.requestId,"string")
  h.message({type:"pac-yardimci:planner-set-result",requestId:"foreign",ok:true})
  assert.match(h.surface.innerHTML,/role="dialog"/)
  h.message({type:"pac-yardimci:planner-set-result",requestId:msg.requestId,ok:true,note:"reopen",via:"storage"})
  assert.match(h.surface.innerHTML,/role="dialog"/)
  assert.match(h.surface.innerHTML,/Close and reopen/)
})

test("ilk boş kare, bekleyen isteği çoğaltmama, merge ve hata yanıtı", async () => {
  const h=await setup(); h.planner(); h.click({action:"toggle"})
  h.click({add:"NINETALES"})
  let msg=h.sent.at(-1)
  assert.deepEqual(JSON.parse(JSON.stringify(msg.board[1])),{name:"NINETALES",x:1,y:1,items:[]})
  const count=h.sent.length
  h.click({add:"NINETALES"}); assert.equal(h.sent.length,count)
  h.message({type:"pac-yardimci:planner-set-result",requestId:msg.requestId,ok:false,error:"invalid"})
  assert.match(h.surface.innerHTML,/could not be updated/)
  h.click({action:"tab",tab:"meta"}); h.click({action:"merge"})
  msg=h.sent.at(-1)
  assert.equal(msg.board.length,2)
  assert.equal(msg.board[0].name,"CHARIZARD")
})

test("takip yalnızca oyun rotasında, aile/yedek ilerlemesi, adımlar ve küçültme",async () => {
  const h=await setup()
  h.planner([...plan,{name:"NINETALES",x:1,y:1,items:[]}],false)
  assert.doesNotMatch(h.surface.innerHTML,/class="tracker/)
  h.location.pathname="/game"
  h.message({type:"pac-yardimci:game",snapshot:{board:[{name:"CHARMANDER",y:0,items:[]}],shop:["VULPIX","CHARMANDER"],inventory:["FOSSIL_STONE","CHARCOAL"],synergies:{FIRE:1}}})
  assert.match(h.surface.innerHTML,/Core units 1 \/ 2/)
  assert.match(h.surface.innerHTML,/Buy VULPIX/)
  assert.match(h.surface.innerHTML,/Buy a copy of CHARMANDER/)
  assert.match(h.surface.innerHTML,/craft FIRE_STONE/)
  assert.equal(h.attrs.has("popover"),false)
  h.click({action:"minimize"}); assert.doesNotMatch(h.surface.innerHTML,/id="tracking-details"/)
  h.click({action:"minimize"}); assert.match(h.surface.innerHTML,/id="tracking-details"/)
  h.planner([],false); assert.doesNotMatch(h.surface.innerHTML,/class="tracker/)
  h.planner(plan,true); assert.doesNotMatch(h.surface.innerHTML,/class="tracker/)
})

test("eksik motor, kapatma ayarı, yabancı mesaj ve dolu tahta",async () => {
  const h=await setup(); h.window.PacAdvisor=null; h.planner()
  h.click({action:"toggle"}); assert.match(h.surface.innerHTML,/No recommendations yet/)
  const html=h.surface.innerHTML
  h.message({type:"pac-yardimci:planner",planner:{open:false,board:[]}}, {})
  assert.equal(h.surface.innerHTML,html)
  const full=Array.from({length:24},(_,i)=>({name:"CHARIZARD",x:i%8,y:Math.floor(i/8)+1,items:[]}))
  h.planner(full); h.click({add:"NINETALES"}); assert.match(h.surface.innerHTML,/plan is full/)
  h.storage[0]({settings:{newValue:{planner:false}}},"local")
  assert.equal(h.surface.innerHTML,"")
  assert.equal(h.attrs.has("popover"),false)
})

test("Escape çekmeceyi kapatır, tuş ve pointer olayları oyuna ulaşmaz", async () => {
  const h = await setup(); h.planner(); h.click({ action: "toggle" })
  let stopped = 0, prevented = 0
  for (const type of ["mousedown", "pointerdown", "mouseup", "pointerup"]) h.rootHandlers[type]({ stopPropagation() { stopped++ } })
  h.rootHandlers.keydown({ key: "Escape", stopPropagation() { stopped++ }, preventDefault() { prevented++ } })
  assert.equal(stopped, 5); assert.equal(prevented, 1)
  assert.doesNotMatch(h.surface.innerHTML, /class="drawer"/)
  assert.match(h.surface.innerHTML, /class="pacc-toggle"/)
  assert.equal(h.host.parentNode, h.dialog)
})

test("harness geometri raporu: 1280×720 ve 1920×1080 çakışmasız", () => {
  const html = read("tests/planner-harness.html")
  const source = html.slice(html.indexOf("  const intersects ="), html.indexOf("  window.plannerGeometryReport"))
  const geometry = vm.runInNewContext(`${source}; geometryReport`)
  for (const size of [[1280, 720], [1920, 1080]]) {
    const report = geometry(...size)
    console.log(JSON.stringify(report))
    for (const key of ["toggleClose", "toggleActions", "drawerActions", "drawerBoard", "drawerSynergies"]) assert.equal(report[key], false, `${size}: ${key}`)
    assert.equal(report.gap, 16)
    assert.equal(report.drawerWidth, 440)
  }
})

test("Tab ve Shift+Tab çekmece sınırında döner", async () => {
  const h = await setup(); h.planner(); h.click({ action: "toggle" })
  const first = { focus() { h.root.activeElement = this } }, last = { focus() { h.root.activeElement = this } }
  h.surface.focusables = [first, last]
  let prevented = 0
  const key = shiftKey => h.rootHandlers.keydown({key:"Tab",shiftKey,stopPropagation(){},preventDefault(){prevented++}})
  h.root.activeElement = last; key(false); assert.equal(h.root.activeElement, first)
  key(true); assert.equal(h.root.activeElement, last)
  assert.equal(prevented, 2)
})

test("çekmece oyun eylemlerinin üst ve alt şeridini açık bırakır", async () => {
  const h = await setup()
  h.rects.actions = { x: 700, y: 80, w: 300, h: 44 }
  h.planner(); h.click({action:"toggle"})
  assert.equal(h.nodes[".drawer"].style.top, "132px")
  assert.equal(h.nodes[".drawer"].style.height, "578px")
  h.rects.actions.y = 650; h.planner()
  assert.equal(h.nodes[".drawer"].style.top, "66px")
  assert.equal(h.nodes[".drawer"].style.height, "576px")
})
