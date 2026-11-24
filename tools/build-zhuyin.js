// Adds zhuyin to pages for young readers, using the 注音粉圓 (BpmfHuninn) IVS font.
//
//   node tools/build-zhuyin.js            build every src/*.src.html into the site root
//   node tools/build-zhuyin.js --dump     also write tools/zhuyin-review.txt (every character with its reading)
//   node tools/build-zhuyin.js --font <BpmfHuninn-Regular.ttf> <dir with node_modules/subset-font>
//                                         also rebuild fonts/BpmfHuninn-subset.woff2 with just the characters used
//
// The font draws zhuyin beside each character by itself. A polyphone shows its first reading
// unless the character is followed by a variation selector: U+E01E1 = 2nd reading, U+E01E2 = 3rd, ...
// The reading order comes from tools/bpmf/phonic_table_v1.500.txt (bpmfvs, Apache 2.0).
//
// Three ways to mark text in a source page:
//   ⟪雞的祕密|ㄐㄧ ˙ㄉㄜ ㄇㄧˋ ㄇㄧˋ⟫   explicit: one syllable per Han character (checked)
//   ⟪雞的祕密⟫                         looked up in tools/zhuyin-dict.txt (also works inside JS strings)
//   <meta name="zhuyin" content="auto">  every text node in <main> is looked up, except inside
//                                         <svg>, <script>, <style>, <details class="grownup"> and elements with data-nozy
// Words win over single characters, so put polyphones (長大 / 長長) in the dictionary as words.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HAN = /\p{Script=Han}/u;
const SYLLABLE = /^˙?[ㄅ-ㄩ]{1,4}[ˊˇˋ]?$/;
const args = process.argv.slice(2);
const dump = args.includes("--dump");
const fontArg = args.indexOf("--font");

// ---------- dictionary ----------
const dict = new Map();
let maxLen = 1;
fs.readFileSync(path.join(__dirname, "zhuyin-dict.txt"), "utf8").split(/\r?\n/).forEach((line, n) => {
  line = line.replace(/#.*/, "").trim();
  if (!line) return;
  const [word, ...syl] = line.split(/\s+/);
  const han = [...word].filter(c => HAN.test(c));
  if (han.length !== syl.length) throw new Error(`zhuyin-dict.txt 第 ${n + 1} 行：「${word}」字數 ${han.length} ≠ 注音 ${syl.length}`);
  syl.forEach(s => { if (!SYLLABLE.test(s)) throw new Error(`zhuyin-dict.txt 第 ${n + 1} 行：注音格式不對「${s}」`); });
  if (dict.has(word) && dict.get(word).join(" ") !== syl.join(" ")) throw new Error(`zhuyin-dict.txt 第 ${n + 1} 行：「${word}」重複而且讀音不同`);
  dict.set(word, syl);
  maxLen = Math.max(maxLen, han.length);
});

// ---------- font reading order ----------
// tools/bpmf/phonic_table_v1.500.txt lists every character the font covers with its readings in
// selector order (bpmfvs v1.500, the version of the font in fonts/). First reading = default.
const order = new Map();
fs.readFileSync(path.join(__dirname, "bpmf", "phonic_table_v1.500.txt"), "utf8").split(/\r?\n/).forEach(l => {
  const [ch, , , ...readings] = l.split("\t");
  if (ch && readings.length) order.set(ch, readings.filter(Boolean));
});

const errors = [];
const review = [];
const fallbacks = new Map();   // "字ㄓㄨˋ → 字型顯示ㄓㄨ" -> example
const used = new Set();        // every code point that must stay in the subset font
let total = 0;

function lookup(text) {
  const chars = [...text];
  const out = [];
  for (let i = 0; i < chars.length;) {
    if (!HAN.test(chars[i])) { i++; continue; }
    let hit = null;
    for (let len = Math.min(maxLen, chars.length - i); len >= 1; len--) {
      const w = chars.slice(i, i + len).join("");
      if (dict.has(w) && [...w].every(c => HAN.test(c))) { hit = w; break; }
    }
    if (!hit) { errors.push(`字典沒有「${chars[i]}」（在「${text.trim().slice(0, 30)}」）`); out.push("ㄨ"); i++; continue; }
    out.push(...dict.get(hit));
    i += [...hit].length;
  }
  return out;
}

// ---------- markup ----------
const PUNCT = /[，。！？、：；「」『』（）～…—]/;
function render(text, syl) {
  let i = 0;
  const pairs = [];
  let html = "";
  for (const c of text) {
    if (HAN.test(c)) {
      const want = syl[i++];
      const list = order.get(c);
      let k = 0;
      if (!list) errors.push(`注音字型沒有「${c}」這個字`);
      else {
        k = list.indexOf(want);
        if (k < 0) { k = 0; fallbacks.set(`${c}${want} → 字型顯示 ${list[0]}`, text.trim().slice(0, 24)); }
      }
      const vs = k > 0 ? String.fromCodePoint(0xE01E0 + k) : "";
      used.add(c); if (vs) used.add(vs);
      pairs.push(`${c}${want}${k > 0 ? `[${k + 1}]` : ""}`);
      html += c + vs;
    } else if (PUNCT.test(c)) {
      html += `<span class='zp'>${c}</span>`;
    } else {
      html += c;
    }
  }
  total += i;
  review.push(pairs.join(" "));
  return `<span class='zy'>${html}</span>`;
}

function annotate(text, explicit) {
  const han = [...text].filter(c => HAN.test(c));
  if (!han.length) return text;
  let syl;
  if (explicit != null) {
    syl = explicit.trim().split(/\s+/).filter(Boolean);
    if (syl.length !== han.length) { errors.push(`字數 ${han.length} ≠ 注音 ${syl.length}：「${text}」`); return text; }
    syl.forEach(s => { if (!SYLLABLE.test(s)) errors.push(`注音格式不對「${s}」：「${text}」`); });
  } else syl = lookup(text);
  return render(text, syl);
}

// ---------- auto mode: walk text between tags ----------
const SKIP = new Set(["svg", "script", "style", "head", "nav", "title", "textarea"]);
function autoText(html) {
  const tokens = html.split(/(<[^>]+>)/);
  const skip = [];
  let inMain = false;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.startsWith("<")) {
      const m = t.match(/^<\/?([a-zA-Z0-9-]+)/);
      if (!m) continue;
      const name = m[1].toLowerCase();
      const closing = t.startsWith("</");
      const selfClosing = /\/>$/.test(t);
      if (name === "main") inMain = !closing;
      if (closing) { if (skip.length && skip[skip.length - 1] === name) skip.pop(); continue; }
      if (selfClosing) continue;
      if (skip.length) { if (name === skip[skip.length - 1]) skip.push(name); continue; }
      if (SKIP.has(name) || /data-nozy/.test(t) || (name === "details" && /class="[^"]*grownup/.test(t))) skip.push(name);
      continue;
    }
    if (!inMain || skip.length || !HAN.test(t) || t.includes("⟪") || t.includes("class='zy'")) continue;
    tokens[k] = annotate(t, null);
  }
  return tokens.join("");
}

// ---------- the on/off switch, added to every page that has zhuyin ----------
const HEAD_SNIPPET = `<link rel="preload" href="fonts/BpmfHuninn-subset.woff2" as="font" type="font/woff2" crossorigin>
<script>try{if(localStorage.getItem("zhuyin")==="off")document.documentElement.classList.add("zy-off")}catch(e){}</script>
</head>`;
const TOGGLE = `</ul>
    <button class="zy-toggle" type="button" aria-pressed="true" id="zyToggle">注音 開</button>`;
const TOGGLE_SCRIPT = `<script>
(function () {
  var b = document.getElementById("zyToggle"), root = document.documentElement;
  function show() { var on = !root.classList.contains("zy-off"); b.textContent = on ? "注音 開" : "注音 關"; b.setAttribute("aria-pressed", on ? "true" : "false"); }
  b.addEventListener("click", function () {
    root.classList.toggle("zy-off");
    try { localStorage.setItem("zhuyin", root.classList.contains("zy-off") ? "off" : "on"); } catch (e) {}
    show();
  });
  show();
})();
</script>
</body>`;

// ---------- build ----------
const srcDir = path.join(ROOT, "src");
const files = fs.readdirSync(srcDir).filter(f => f.endsWith(".src.html"));
const built = [];
for (const f of files) {
  let html = fs.readFileSync(path.join(srcDir, f), "utf8");
  review.push(`\n===== ${f} =====`);
  html = html.replace(/⟪([^|⟫]+)(?:\|([^⟫]*))?⟫/g, (w, text, zy) => annotate(text, zy == null ? null : zy));
  if (/<meta name="zhuyin" content="auto">/.test(html)) html = autoText(html);
  const left = html.match(/⟪|⟫/g);
  if (left) errors.push(`${f}：還有 ${left.length} 個沒處理的 ⟪ ⟫`);
  if (html.includes("class='zy'")) {
    html = html.replace("</head>", HEAD_SNIPPET).replace(/<\/ul>(\s*<\/nav>)/, TOGGLE + "$1").replace("</body>", TOGGLE_SCRIPT);
    if (!html.includes("zyToggle")) errors.push(`${f}：找不到導覽列，沒辦法加注音開關`);
  }
  built.push([f.replace(/\.src\.html$/, ".html"), html]);
}
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}
for (const [name, html] of built) fs.writeFileSync(path.join(ROOT, name), html);
if (dump) {
  const fb = [...fallbacks].map(([k, v]) => `${k}（例：${v}）`);
  fs.writeFileSync(path.join(__dirname, "zhuyin-review.txt"),
    "===== 字型沒有收的讀音（顯示成字型的讀音） =====\n" + (fb.join("\n") || "（沒有）") + "\n" + review.join("\n") + "\n");
}
console.log(`OK：${built.length} 頁、${total} 個字加上注音（${built.map(b => b[0]).join("、")}）`);
if (fallbacks.size) console.log(`字型沒有收的讀音 ${fallbacks.size} 種，用 --dump 看清單`);

// ---------- optional: rebuild the subset font ----------
if (fontArg >= 0) {
  const [ttf, toolDir] = args.slice(fontArg + 1, fontArg + 3);
  const subsetFont = require(require.resolve("subset-font", { paths: [toolDir] }));
  const text = [...used].join("") + "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.%";
  subsetFont(fs.readFileSync(ttf), text, { targetFormat: "woff2" })
    .then(buf => {
      fs.writeFileSync(path.join(ROOT, "fonts", "BpmfHuninn-subset.woff2"), buf);
      console.log(`字型：${used.size} 個字元 → fonts/BpmfHuninn-subset.woff2（${Math.round(buf.length / 1024)} KB）`);
    })
    .catch(e => { console.error("縮小字型失敗：", e.message); process.exit(1); });
}
