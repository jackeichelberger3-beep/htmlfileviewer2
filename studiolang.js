// Studio Language (SL) — a tiny, easy-to-learn scripting language for the
// advanced terminal mode. Statements are separated by ";" or new lines.
export const MANUAL_HTML = `
<div class="he-manual">
  <div class="he-man-title">What it is</div>
  <div class="he-man-p">Studio Language (SL) is the Terminal's advanced mode — a tiny scripting language you can learn in five minutes. Unlock it by typing <b>admin</b> in the Terminal and entering the password (changeable below). Lines starting with an SL keyword run as SL; anything else still runs as a normal terminal command. Type <b>exit</b> to leave advanced mode.</div>
  <div class="he-man-title">Rules</div>
  <div class="he-man-p">Statements are separated by <b>;</b> (or new lines). Keywords are case-insensitive. Lines starting with <b>#</b> are comments. Text uses "double quotes".</div>
  <div class="he-man-title">Basics</div>
  <pre>set x = 10 * 2 + 1      — variables hold numbers or text
set name = "Ada"
out "Hello " + name     — print (join with +)
out x * 5</pre>
  <div class="he-man-title">Decisions &amp; loops</div>
  <pre>if x > 10; out "big"; else; out "small"; end
repeat 3; out "lap " + it; end    — it is 1, 2, 3…
while x > 0; set x = x - 1; end</pre>
  <div class="he-man-title">Working with files</div>
  <pre>read "index.html"        — print a file's contents
append "notes.md" "done" — add a line to a file</pre>
  <div class="he-man-title">Built-in functions</div>
  <pre>count()   folders()   has("app.js")   lines("styles.css")
chars("index.html")   len("hello")   round(3.7)
upper("hi")   lower("HI")   rand(10)   now()</pre>
  <div class="he-man-title">Expressions</div>
  <div class="he-man-p">Math: <b>+ - * / %</b> · compare: <b>== != &gt; &lt; &gt;= &lt;=</b> · logic: <b>and or not</b> · group with <b>( )</b>. Examples: <b>out count() * 2</b> · <b>if has("app.js") and x > 3; out "ready"; end</b>.</div>
</div>`;

function splitStatements(code) {
  const parts = []; let cur = ""; let inStr = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inStr) { cur += c; if (c === "\\") { cur += code[i + 1] || ""; i++; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; cur += c; continue; }
    if (c === ";" || c === "\n") { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p && !p.startsWith("#"));
}

const truthy = (v) => !(v === 0 || v === "" || v == null || v === "0");
const trimNum = (v) => { const n = Math.round(v * 1e6) / 1e6; return Number.isInteger(n) ? String(n) : String(n); };

export function runStudio(code, ctx) {
  const files = (ctx.files || []).map((f) => ({ ...f }));
  const folders = ctx.folders || [];
  const vars = { it: 0 };
  const output = [];
  const print = (text, cls) => output.push({ text: String(text), cls: cls || "" });
  const num = (v) => (typeof v === "number" ? v : (parseFloat(v) || 0));
  const str = (v) => (typeof v === "number" ? trimNum(v) : String(v));
  const findFile = (name) => {
    const n = String(name).trim().toLowerCase();
    return files.find((f) => f.name.toLowerCase() === n) || files.find((f) => f.name.toLowerCase().endsWith(n)) || null;
  };
  const FUNCS = {
    count: () => files.length,
    folders: () => folders.length,
    len: (x) => str(x).length,
    upper: (x) => str(x).toUpperCase(),
    lower: (x) => str(x).toLowerCase(),
    round: (x) => Math.round(num(x)),
    rand: (n) => 1 + Math.floor(Math.random() * Math.max(1, Math.floor(num(n)))),
    now: () => new Date().toLocaleTimeString(),
    has: (name) => (findFile(name) ? 1 : 0),
    lines: (name) => { const f = findFile(name); if (!f) throw new Error("No file matches " + name); return (f.content || "").split("\n").length; },
    chars: (name) => { const f = findFile(name); if (!f) throw new Error("No file matches " + name); return (f.content || "").length; }
  };

  function tokenize(src) {
    const toks = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/\d/.test(c)) { let j = i; while (j < src.length && /[\d.]/.test(src[j])) j++; toks.push({ t: "num", v: parseFloat(src.slice(i, j)) }); i = j; continue; }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < src.length && src[j] !== '"') {
          if (src[j] === "\\") { s += src[j + 1] === "n" ? "\n" : (src[j + 1] || ""); j += 2; }
          else { s += src[j]; j++; }
        }
        if (j >= src.length) throw new Error('Missing closing "');
        toks.push({ t: "str", v: s }); i = j + 1; continue;
      }
      if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /\w/.test(src[j])) j++; toks.push({ t: "id", v: src.slice(i, j) }); i = j; continue; }
      const two = src.slice(i, i + 2);
      if (["==", "!=", ">=", "<="].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
      if ("+-*/%(),<>".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
      throw new Error("Unexpected character: " + c);
    }
    return toks;
  }

  function evalExpr(src) {
    const toks = tokenize(String(src));
    let pos = 0;
    const peek = () => toks[pos];
    const isOp = (v) => { const t = toks[pos]; return !!t && t.t === "op" && t.v === v; };
    const isId = (v) => { const t = toks[pos]; return !!t && t.t === "id" && t.v.toLowerCase() === v; };
    const eatOp = (v) => { if (!isOp(v)) throw new Error('Expected "' + v + '"'); pos++; };
    function primary() {
      const t = peek();
      if (!t) throw new Error("Missing value in expression");
      if (t.t === "num") { pos++; return t.v; }
      if (t.t === "str") { pos++; return t.v; }
      if (t.t === "id") {
        pos++;
        if (isOp("(")) {
          pos++;
          const args = [];
          if (!isOp(")")) { args.push(orExpr()); while (isOp(",")) { pos++; args.push(orExpr()); } }
          eatOp(")");
          const fn = FUNCS[t.v.toLowerCase()];
          if (!fn) throw new Error("Unknown function: " + t.v);
          return fn(...args);
        }
        const lw = t.v.toLowerCase();
        if (lw === "true") return 1;
        if (lw === "false") return 0;
        if (!(t.v in vars)) throw new Error("Unknown variable: " + t.v);
        return vars[t.v];
      }
      throw new Error("Unexpected: " + t.v);
    }
    function unary() {
      if (isId("not")) { pos++; return truthy(unary()) ? 0 : 1; }
      if (isOp("-")) { pos++; return -num(unary()); }
      if (isOp("(")) { pos++; const v = orExpr(); eatOp(")"); return v; }
      return primary();
    }
    function mul() {
      let v = unary();
      while (isOp("*") || isOp("/") || isOp("%")) {
        const op = toks[pos].v; pos++;
        const r = unary(); const a = num(v), b = num(r);
        v = op === "*" ? a * b : b === 0 ? 0 : op === "/" ? a / b : a % b;
      }
      return v;
    }
    function add() {
      let v = mul();
      while (isOp("+") || isOp("-")) {
        const op = toks[pos].v; pos++;
        const r = mul();
        v = op === "+" ? (typeof v === "string" || typeof r === "string" ? str(v) + str(r) : num(v) + num(r)) : num(v) - num(r);
      }
      return v;
    }
    function cmp() {
      let v = add();
      const t = toks[pos];
      if (t && t.t === "op" && ["==", "!=", "<", ">", "<=", ">="].includes(t.v)) {
        pos++;
        const r = add();
        const bothNum = typeof v === "number" && typeof r === "number";
        const a = bothNum ? num(v) : str(v), b = bothNum ? num(r) : str(r);
        v = (t.v === "==" ? a === b : t.v === "!=" ? a !== b : t.v === "<" ? a < b : t.v === ">" ? a > b : t.v === "<=" ? a <= b : a >= b) ? 1 : 0;
      }
      return v;
    }
    function andE() { let v = cmp(); while (isId("and")) { pos++; v = (truthy(v) && truthy(cmp())) ? 1 : 0; } return v; }
    function orExpr() { let v = andE(); while (isId("or")) { pos++; v = (truthy(v) || truthy(cmp())) ? 1 : 0; } return v; }
    const v = orExpr();
    if (pos !== toks.length) throw new Error("Unexpected: " + (toks[pos] ? toks[pos].v : "end"));
    return v;
  }

  const statements = splitStatements(code);
  let steps = 0;
  const kwOf = (l) => { const m = l.match(/^([A-Za-z_]\w*)/); return m ? m[1].toLowerCase() : ""; };

  function matchBlock(i, allowElse) {
    let depth = 0;
    for (let j = i + 1; j < statements.length; j++) {
      const k = kwOf(statements[j]);
      if (k === "if" || k === "repeat" || k === "while") depth++;
      else if (k === "end") { if (depth === 0) return { idx: j, kw: "end" }; depth--; }
      else if (k === "else" && depth === 0 && allowElse) return { idx: j, kw: "else" };
    }
    throw new Error("Missing end for block");
  }

  function runSeq(from, to) {
    let i = from;
    while (i < to) {
      const line = statements[i];
      const k = kwOf(line);
      if (++steps > 20000) throw new Error("Too many steps — check your loops");
      if (k === "set") {
        const m = line.match(/^set\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/i);
        if (!m) throw new Error("Usage: set name = expression");
        vars[m[1]] = evalExpr(m[2]); i++;
      } else if (k === "out" || k === "print") {
        const rest = line.slice(k.length).trim();
        print(rest ? str(evalExpr(rest)) : ""); i++;
      } else if (k === "read") {
        const f = findFile(evalExpr(line.slice(4)));
        if (!f) throw new Error("No file matches that name");
        (f.content || "").split("\n").forEach((l) => print(l)); i++;
      } else if (k === "append") {
        const m = line.match(/^append\s+([\s\S]+?)\s+([\s\S]+)$/i);
        if (!m) throw new Error('Usage: append "file.ext" "text"');
        const f = findFile(evalExpr(m[1]));
        if (!f) throw new Error("No file matches that name");
        f.content = (f.content || "") + (f.content ? "\n" : "") + str(evalExpr(m[2]));
        print("Appended to " + f.name, "ok"); i++;
      } else if (k === "if") {
        const first = matchBlock(i, true);
        let elseIdx = -1, endIdx;
        if (first.kw === "else") { elseIdx = first.idx; endIdx = matchBlock(elseIdx, false).idx; }
        else endIdx = first.idx;
        if (truthy(evalExpr(line.slice(2)))) runSeq(i + 1, elseIdx !== -1 ? elseIdx : endIdx);
        else if (elseIdx !== -1) runSeq(elseIdx + 1, endIdx);
        i = endIdx + 1;
      } else if (k === "repeat") {
        const endIdx = matchBlock(i, false).idx;
        const n = Math.max(0, Math.min(10000, Math.floor(num(evalExpr(line.slice(6))))));
        for (let t = 1; t <= n; t++) { vars.it = t; runSeq(i + 1, endIdx); }
        i = endIdx + 1;
      } else if (k === "while") {
        const endIdx = matchBlock(i, false).idx;
        let guard = 0;
        while (truthy(evalExpr(line.slice(5)))) {
          if (++guard > 10000) throw new Error("while loop did not finish (max 10000 passes)");
          runSeq(i + 1, endIdx);
        }
        i = endIdx + 1;
      } else {
        throw new Error("Unknown statement: " + line);
      }
    }
  }
  runSeq(0, statements.length);
  const changes = [];
  files.forEach((f, idx) => { if (ctx.files[idx] && f.content !== ctx.files[idx].content) changes.push({ id: f.id, content: f.content }); });
  return { output, changes };
}
