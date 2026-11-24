// Turns ⟪漢字|ㄓㄨˋ ㄧㄣ⟫ markers into <ruby> zhuyin markup.
// Usage: node tools/build-zhuyin.js <source.html> <output.html>
// Every Han character inside a marker must have exactly one zhuyin syllable; the build fails otherwise.
const fs = require("fs");
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: node tools/build-zhuyin.js <source.html> <output.html>"); process.exit(2); }

const HAN = /\p{Script=Han}/u;
const SYLLABLE = /^˙?[ㄅ-ㄩ]{1,4}[ˊˇˋ]?$/;
const errors = [];
let count = 0;

const html = fs.readFileSync(src, "utf8").replace(/⟪([^|⟫]+)\|([^⟫]*)⟫/g, (whole, text, zy) => {
  const chars = [...text];
  const han = chars.filter(c => HAN.test(c));
  const syl = zy.trim().split(/\s+/).filter(Boolean);
  if (han.length !== syl.length) {
    errors.push(`字數 ${han.length} ≠ 注音 ${syl.length}：「${text}」`);
    return whole;
  }
  syl.forEach(s => { if (!SYLLABLE.test(s)) errors.push(`注音格式不對「${s}」：「${text}」`); });
  let i = 0;
  count += han.length;
  // Textbook layout: symbols stacked vertically to the right of the character,
  // the light-tone dot on top, the 2nd/3rd/4th tone mark beside the last symbol.
  const box = (s) => {
    const light = s.startsWith("˙");
    const body = s.replace(/^˙/, "");
    const tone = /[ˊˇˋ]$/.test(body) ? body.slice(-1) : "";
    const sym = tone ? body.slice(0, -1) : body;
    return `<span class="zb" aria-hidden="true"><span class="zcol">${light ? '<span class="zl">˙</span>' : ""}<span class="zs">${sym}</span></span>${tone ? `<span class="zt">${tone}</span>` : ""}</span>`;
  };
  // Keep punctuation glued to its neighbour so a line never starts with ，。！ or ends with 「.
  const CLOSE = /[，。！？、：；」』）～]/, OPEN = /[「『（]/;
  const units = [];
  let pending = "";
  for (const c of chars) {
    if (HAN.test(c)) { units.push(pending + `<span class="zc">${c}${box(syl[i++])}</span>`); pending = ""; }
    else if (OPEN.test(c)) pending += c;
    else if (CLOSE.test(c) && units.length) units[units.length - 1] += c;
    else units.push(pending + c), pending = "";
  }
  if (pending) units.push(pending);
  return '<span class="zy">' + units.map(u => u.includes("zc") ? `<span class="zu">${u}</span>` : u).join("") + "</span>";
});

const leftover = html.match(/⟪|⟫/g);
if (leftover) errors.push(`還有 ${leftover.length} 個沒有處理的 ⟪ ⟫ 標記`);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
fs.writeFileSync(out, html);
console.log(`OK：${count} 個字加上注音 → ${out}`);
