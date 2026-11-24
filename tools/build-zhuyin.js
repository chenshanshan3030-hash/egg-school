// Adds textbook-style zhuyin to pages for young readers.
//
//   node tools/build-zhuyin.js            build every src/*.src.html into the site root
//   node tools/build-zhuyin.js --dump     also write tools/zhuyin-review.txt (every character with its zhuyin)
//
// Three ways to get zhuyin into a source page:
//   ⟪雞的祕密|ㄐㄧ ˙ㄉㄜ ㄇㄧˋ ㄇㄧˋ⟫   explicit: one syllable per Han character (checked)
//   ⟪雞的祕密⟫                         looked up in tools/zhuyin-dict.txt (also works inside JS strings)
//   <meta name="zhuyin" content="auto">  every text node in <main> is looked up, except inside
//                                         <svg>, <script>, <style>, <details class="grownup"> and elements with data-nozy
// Words win over single characters, so put polyphones (長大 / 長長) in the dictionary as words.
// Any character the dictionary cannot place stops the build with a list to fix.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HAN = /\p{Script=Han}/u;
const SYLLABLE = /^˙?[ㄅ-ㄩ]{1,4}[ˊˇˋ]?$/;
const dump = process.argv.includes("--dump");

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

const errors = [];
const review = [];
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
const box = (s) => {
  const light = s.startsWith("˙");
  const body = s.replace(/^˙/, "");
  const tone = /[ˊˇˋ]$/.test(body) ? body.slice(-1) : "";
  const sym = tone ? body.slice(0, -1) : body;
  return `<span class='zb' aria-hidden='true'><span class='zcol'>${light ? "<span class='zl'>˙</span>" : ""}<span class='zs'>${sym}</span></span>${tone ? `<span class='zt'>${tone}</span>` : ""}</span>`;
};
const CLOSE = /[，。！？、：；」』）～]/, OPEN = /[「『（]/;

function render(text, syl) {
  const chars = [...text];
  let i = 0;
  const pairs = [];
  const units = [];
  let pending = "";
  for (const c of chars) {
    if (HAN.test(c)) {
      const s = syl[i++];
      pairs.push(`${c}${s}`);
      units.push(pending + `<span class='zc'>${c}${box(s)}</span>`);
      pending = "";
    } else if (OPEN.test(c)) pending += c;
    else if (CLOSE.test(c) && units.length) units[units.length - 1] += c;
    else { units.push(pending + c); pending = ""; }
  }
  if (pending) units.push(pending);
  total += i;
  review.push(pairs.join(" "));
  return "<span class='zy'>" + units.map(u => u.includes("zc") ? `<span class='zu'>${u}</span>` : u).join("") + "</span>";
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
  const skip = [];          // stack of tag names we are inside and must not touch
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
  built.push([f.replace(/\.src\.html$/, ".html"), html]);
}
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}
for (const [name, html] of built) fs.writeFileSync(path.join(ROOT, name), html);
if (dump) fs.writeFileSync(path.join(__dirname, "zhuyin-review.txt"), review.join("\n") + "\n");
console.log(`OK：${built.length} 頁、${total} 個字加上注音（${built.map(b => b[0]).join("、")}）`);
