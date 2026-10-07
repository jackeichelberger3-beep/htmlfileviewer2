// Lightweight, best-effort code formatters (indentation cleanup).
export function formatHTML(code) {
  if (!code) return "";
  const tokens = code.replace(/>\s+</g, "><").trim().split(/(<[^>]+>)/).filter(Boolean);
  const voidTags = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  let indent = 0;
  const lines = [];
  for (const t of tokens) {
    const isTag = /^<[^>]+>$/.test(t);
    if (isTag) {
      const closing = /^<\//.test(t);
      const tag = t.replace(/^<\//, "").replace(/[\/>]/g, "").split(/\s/)[0].toLowerCase();
      const selfClose = /\/>$/.test(t) || (t.startsWith("<!") || voidTags.has(tag));
      if (closing) indent = Math.max(0, indent - 1);
      lines.push("  ".repeat(indent) + t);
      if (!closing && !selfClose) indent++;
    } else {
      const text = t.trim();
      if (text) lines.push("  ".repeat(indent) + text);
    }
  }
  return lines.join("\n");
}

export function formatCSS(code) {
  if (!code) return "";
  let c = code.replace(/\s*\{\s*/g, " {\n").replace(/;\s*/g, ";\n").replace(/\s*}\s*/g, "\n}\n").trim();
  const lines = c.split("\n").map((l) => l.trim()).filter(Boolean);
  let indent = 0;
  const out = [];
  for (const l of lines) {
    if (l.endsWith("{")) { out.push("  ".repeat(indent) + l); indent++; }
    else if (l === "}") { indent = Math.max(0, indent - 1); out.push("  ".repeat(indent) + l); }
    else out.push("  ".repeat(indent) + l);
  }
  return out.join("\n");
}

export function formatJS(code) {
  if (!code) return "";
  const rawLines = code.split("\n");
  let indent = 0, inStr = false, strCh = "";
  const out = [];
  for (let line of rawLines) {
    const trimmed = line.trim();
    const leadingClose = /^[}\])]/.test(trimmed);
    let effective = indent - (leadingClose ? 1 : 0);
    if (effective < 0) effective = 0;
    out.push("  ".repeat(effective) + trimmed);
    let net = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inStr) { if (ch === strCh && trimmed[i - 1] !== "\\") inStr = false; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { inStr = true; strCh = ch; continue; }
      if (ch === "{") net++; else if (ch === "}") net--;
    }
    indent = effective + net;
    if (indent < 0) indent = 0;
  }
  return out.join("\n");
}
