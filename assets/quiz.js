// Shared true/false quiz.
// renderQuiz(boxEl, scoreEl, [[questionHtml, answerBool, explanationHtml], ...], labels?)
// Question and explanation strings may contain markup (the zhuyin build turns them into ruby spans).
// labels: { yes, no, right, wrong, score(correct, total) -> html, perfect } — all optional.
function renderQuiz(box, scoreEl, items, labels) {
  var L = labels || {};
  var answered = 0, correct = 0;
  items.forEach(function (q, i) {
    var div = document.createElement("div");
    div.className = "q";
    var p = document.createElement("p");
    p.innerHTML = "<b>" + (i + 1) + ".</b> " + q[0];
    var row = document.createElement("div");
    row.className = "q-row";
    var yes = document.createElement("button");
    yes.className = "btn"; yes.type = "button"; yes.innerHTML = L.yes || "真的";
    var no = document.createElement("button");
    no.className = "btn"; no.type = "button"; no.innerHTML = L.no || "假的";
    row.appendChild(yes); row.appendChild(no);
    var res = document.createElement("p");
    res.className = "result"; res.hidden = true;
    div.appendChild(p); div.appendChild(row); div.appendChild(res);
    box.appendChild(div);
    function pick(ans) {
      if (!res.hidden) return;
      var ok = ans === q[1];
      res.hidden = false;
      res.className = "result " + (ok ? "ok" : "no");
      res.innerHTML = (ok ? (L.right || "答對了！") : (L.wrong || "再想想～")) + q[2];
      yes.disabled = true; no.disabled = true;
      answered++; if (ok) correct++;
      if (answered === items.length) {
        var msg = L.score ? L.score(correct, items.length) : "你答對了 " + correct + " 題，共 " + items.length + " 題！";
        scoreEl.innerHTML = msg + (correct === items.length ? (L.perfect || "你是雞蛋小博士！") : "");
      }
    }
    yes.addEventListener("click", function () { pick(true); });
    no.addEventListener("click", function () { pick(false); });
  });
}
