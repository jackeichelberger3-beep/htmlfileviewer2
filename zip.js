// Minimal store-only (no compression) ZIP writer + download (standalone build).

const enc = new TextEncoder();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
function cat(...arrs) {
  let len = 0; for (const a of arrs) len += a.length;
  const out = new Uint8Array(len); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

function filePath(f, folders) {
  const s = []; let cur = folders.find((x) => x.id === (f.folderId || null));
  while (cur) { s.unshift(cur.name); cur = folders.find((x) => x.id === (cur.parentId || null)); }
  s.push(f.name);
  return s.join("/");
}

export function buildProjectZip(project) {
  const folders = project.folders || [];
  const files = (project.files || []).map((f) => ({ name: filePath(f, folders), content: f.content || "" }));
  const locals = [], centrals = []; let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.name);
    const data = enc.encode(f.content);
    const crc = crc32(data);
    const local = cat(
      u32(0x04034b50), u16(20), u16(0), u16(0),
      u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameB.length), u16(0), nameB, data
    );
    locals.push(local);
    centrals.push(cat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameB
    ));
    offset += local.length;
  }
  const cd = cat(...centrals);
  const eocd = cat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0));
  return cat(...locals, cd, eocd);
}

export function downloadProjectZip(project, name = "html-studio-project.zip") {
  const bytes = buildProjectZip(project);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
