// Dependency-free ZIP import: parses the central directory and inflates
// entries with the browser's built-in DecompressionStream("deflate-raw").
const uid = (p) => p + "_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
const langOfExt = (n) => { const e = (n || "").split(".").pop().toLowerCase(); return e === "css" ? "css" : e === "js" ? "js" : "html"; };
const TEXT_EXT = new Set(["html", "htm", "css", "js", "json", "md", "svg", "txt", "xml"]);

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a valid zip file");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
    entries.push({ name, method, compSize, lho });
    off += 46 + nameLen + extraLen + commentLen;
  }
  const out = [];
  for (const e of entries) {
    if (e.name.endsWith("/")) continue;
    if (e.lho + 30 > buf.length) continue;
    const fnLen = dv.getUint16(e.lho + 26, true);
    const exLen = dv.getUint16(e.lho + 28, true);
    const start = e.lho + 30 + fnLen + exLen;
    if (start + e.compSize > buf.length) continue;
    const data = buf.subarray(start, start + e.compSize);
    let bytes;
    if (e.method === 0) bytes = data;
    else if (e.method === 8) bytes = await inflateRaw(data);
    else continue;
    out.push({ name: e.name, bytes });
  }
  return out;
}

export async function importProjectZip(file) {
  const entries = await readZip(file);
  const base = (file.name || "Imported").replace(/\.zip$/i, "").trim() || "Imported";
  const rootId = uid("fld");
  const folders = [{ id: rootId, name: base, parentId: null }];
  const byPath = new Map();
  const files = [];
  for (const { name, bytes } of entries) {
    const parts = name.split("/");
    const fileName = parts.pop();
    if (!fileName) continue;
    if (fileName.startsWith(".") || parts.some((p) => !p || p.startsWith(".") || p === "__MACOSX")) continue;
    const ext = fileName.split(".").pop().toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    let folderId = rootId;
    if (parts.length) {
      let built = "";
      for (const p of parts) {
        built = built ? built + "/" + p : p;
        if (!byPath.has(built)) {
          const id = uid("fld");
          byPath.set(built, id);
          folders.push({ id, name: p, parentId: folderId });
        }
        folderId = byPath.get(built);
      }
    }
    let content = "";
    try { content = new TextDecoder().decode(bytes); } catch (e) { continue; }
    if (content.includes("\u0000")) continue;
    files.push({ id: uid("file"), name: fileName, folderId, lang: langOfExt(fileName), content });
  }
  return { folders, files };
}
