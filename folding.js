// Code folding helpers — best-effort block detection + marker-based elision.
const VOID_TAGS = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);

export function isFoldMarker(line) {
  return /fold:[a-z0-9]+/.test(line) && (/<!--\s*fold:/.test(line) || /\/\*\s*fold:/.test(line));
}
export function parseFoldMarker(line) {
  const m = line.match(/fold:([a-z0-9]+)/);
  return m ? m[1] : null;
}
export function foldMarkerLine(lang, id, n) {
  const inner = `fold:${id} ▸ ${n} lines folded`;
  return lang === "html" ? `<!-- ${inner} -->` : `/* ${inner} */`;
}

export function findBlockEnd(lines, start, lang) {
  return lang === "html" ? findHtmlEnd(lines, start) : findBraceEnd(lines, start);
}

export function isFoldStart(lines, i, lang) {
  const line = lines[i] || "";
  if (!line.trim() || isFoldMarker(line)) return false;
  if (lang === "html") {
    if (/^\s*<\//.test(line) || /^\s*<!/.test(line)) return false;
    const m = line.match(/<([a-zA-Z][\w-]*)[^>]*>/);
    if (!m) return false;
    if (/\/>\s*$/.test(line) || VOID_TAGS.has(m[1].toLowerCase())) return false;
    return findHtmlEnd(lines, i) > i;
  }
  return findBraceEnd(lines, i) > i;
}

function findBraceEnd(lines, start) {
  let depth = 0, seenOpen = false, inStr = false, strCh = "", inLine = false, inBlock = false;
  for (let li = start; li < lines.length; li++) {
    const text = lines[li];
    for (let k = 0; k < text.length; k++) {
      const ch = text[k], nxt = text[k + 1];
      if (inLine) { continue; }
      if (inBlock) { if (ch === "*" && nxt === "/") { inBlock = false; k++; } continue; }
      if (inStr) { if (ch === "\\") { k++; continue; } if (ch === strCh) inStr = false; continue; }
      if (ch === "/" && nxt === "/") { inLine = true; k++; continue; }
      if (ch === "/" && nxt === "*") { inBlock = true; k++; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { inStr = true; strCh = ch; continue; }
      if (ch === "{") { depth++; seenOpen = true; }
      else if (ch === "}") { depth--; if (depth === 0 && seenOpen) return li; }
    }
    inLine = false;
  }
  return -1;
}

function findHtmlEnd(lines, start) {
  const open = lines[start].match(/<([a-zA-Z][\w-]*)[^>]*>/);
  if (!open) return -1;
  const tag = open[1].toLowerCase();
  if (VOID_TAGS.has(tag)) return -1;
  let depth = 0, seen = false;
  const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g;
  for (let li = start; li < lines.length; li++) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(lines[li]))) {
      const closing = m[1] === "/", t = m[2].toLowerCase(), self = m[3] === "/";
      if (self || VOID_TAGS.has(t)) continue;
      if (closing) { depth--; if (depth === 0 && seen) return li; }
      else { depth++; seen = true; }
    }
  }
  return -1;
}

export function applyFold(content, startLine, endLine, lang, id) {
  const lines = content.split("\n");
  const stored = lines.slice(startLine + 1, endLine + 1).join("\n");
  const hidden = endLine - startLine;
  const marker = foldMarkerLine(lang, id, hidden);
  const newContent = [...lines.slice(0, startLine + 1), marker, ...lines.slice(endLine + 1)].join("\n");
  return { content: newContent, stored };
}

export function unfoldAt(content, id, stored) {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => parseFoldMarker(l) === id);
  if (idx === -1) return content;
  return [...lines.slice(0, idx), ...stored.split("\n"), ...lines.slice(idx + 1)].join("\n");
}
