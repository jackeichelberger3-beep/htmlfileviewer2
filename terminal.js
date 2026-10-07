// Shared shell-emulation over a project filesystem (standalone build).
// Pure: takes state, returns { output:[{text,cls}], state, clear }.

let _c = 0;
const uid = (p) => p + "_" + Date.now().toString(36) + (_c++);
const langOf = (n) => { const e = (n || "").split(".").pop().toLowerCase(); return e === "css" ? "css" : e === "js" ? "js" : "html"; };

const childFolders = (folders, id) => folders.filter((f) => (f.parentId || null) === id);
const childFiles = (files, id) => files.filter((f) => (f.folderId || null) === id);
function folderPath(id, folders) {
  const segs = []; let cur = folders.find((f) => f.id === id);
  while (cur) { segs.unshift(cur.name); cur = folders.find((f) => f.id === (cur.parentId || null)); }
  return "/" + segs.join("/");
}
function resolveFolder(cwdId, arg, folders) {
  if (!arg || arg === ".") return cwdId;
  let id = arg.startsWith("/") ? null : cwdId;
  for (const p of arg.split("/").filter(Boolean)) {
    if (p === ".") continue;
    if (p === "..") { const cur = folders.find((f) => f.id === id); id = cur ? (cur.parentId || null) : null; continue; }
    const fld = folders.find((f) => f.name === p && (f.parentId || null) === id);
    if (!fld) return undefined;
    id = fld.id;
  }
  return id;
}

export function runCommand(raw, state) {
  const input = (raw || "").trim();
  const [cmd, ...rest] = input.split(/\s+/);
  const arg = rest.join(" ");
  const { folders, files, cwd } = state;
  const out = (text, cls) => ({ text: String(text), cls: cls || "" });
  const st = (override) => ({ ...state, ...override });
  const C = (cmd || "").toLowerCase();

  switch (C) {
    case "": return { output: [], state: st() };
    case "help": return { output: [
      out("Commands:"),
      out("  help              show this help"),
      out("  clear             clear the terminal"),
      out("  pwd               print working directory"),
      out("  ls [path]         list files & folders"),
      out("  cd <path>         change directory"),
      out("  cat <file>        print a file"),
      out("  echo <text>       print text"),
      out("  tree              show project tree"),
      out("  touch <name>      create a file (.html/.css/.js)"),
      out("  mkdir <name>      create a folder"),
      out("  rm <name>         remove a file or folder"),
      out("  date / whoami     misc info"),
    ], state: st() };
    case "clear": return { output: [], state: st(), clear: true };
    case "pwd": return { output: [out(folderPath(cwd, folders) || "/")], state: st() };
    case "whoami": return { output: [out("developer")], state: st() };
    case "date": return { output: [out(new Date().toString())], state: st() };
    case "echo": return { output: [out(arg)], state: st() };
    case "ls": {
      const target = arg ? resolveFolder(cwd, arg, folders) : cwd;
      if (target === undefined) return { output: [out("ls: " + arg + ": no such directory", "err")], state: st() };
      const dirs = childFolders(folders, target).map((f) => "📁 " + f.name);
      const fls = childFiles(files, target).map((f) => "📄 " + f.name);
      const all = [...dirs, ...fls];
      return { output: all.length ? all.map(out) : [out("(empty)", "muted")], state: st() };
    }
    case "cd": {
      if (!arg || arg === "~" || arg === "/") return { output: [], state: st({ cwd: null }) };
      const t = resolveFolder(cwd, arg, folders);
      if (t === undefined) return { output: [out("cd: " + arg + ": no such directory", "err")], state: st() };
      return { output: [], state: st({ cwd: t }) };
    }
    case "cat": {
      if (!arg) return { output: [out("cat: missing file", "err")], state: st() };
      const f = childFiles(files, cwd).find((x) => x.name === arg) || files.find((x) => x.name === arg);
      if (!f) return { output: [out("cat: " + arg + ": no such file", "err")], state: st() };
      return { output: (f.content || "").split("\n").map(out), state: st() };
    }
    case "tree": {
      const lines = [out(folderPath(cwd, folders) || "/")];
      const walk = (id, prefix) => {
        const ds = childFolders(folders, id).map((d) => ({ name: d.name, id: d.id, dir: true }));
        const fs = childFiles(files, id).map((f) => ({ name: f.name, dir: false }));
        const all = [...ds, ...fs];
        all.forEach((it, i) => {
          const last = i === all.length - 1;
          lines.push(out(prefix + (last ? "└─ " : "├─ ") + (it.dir ? "📁 " : "📄 ") + it.name));
          if (it.dir) walk(it.id, prefix + (last ? "   " : "│  "));
        });
      };
      walk(cwd, "");
      return { output: lines, state: st() };
    }
    case "touch": {
      if (!arg) return { output: [out("touch: missing file name", "err")], state: st() };
      if (childFiles(files, cwd).some((x) => x.name === arg)) return { output: [out("touch: " + arg + " already exists", "err")], state: st() };
      const nf = { id: uid("file"), name: arg, folderId: cwd, lang: langOf(arg), content: "" };
      return { output: [out("created " + arg, "ok")], state: st({ files: [...files, nf] }) };
    }
    case "mkdir": {
      if (!arg) return { output: [out("mkdir: missing folder name", "err")], state: st() };
      if (childFolders(folders, cwd).some((x) => x.name === arg)) return { output: [out("mkdir: " + arg + " already exists", "err")], state: st() };
      const nf = { id: uid("fld"), name: arg, parentId: cwd };
      return { output: [out("created folder " + arg, "ok")], state: st({ folders: [...folders, nf] }) };
    }
    case "rm": {
      if (!arg) return { output: [out("rm: missing name", "err")], state: st() };
      const f = childFiles(files, cwd).find((x) => x.name === arg);
      if (f) return { output: [out("removed " + arg, "ok")], state: st({ files: files.filter((x) => x.id !== f.id) }) };
      const d = childFolders(folders, cwd).find((x) => x.name === arg);
      if (d) {
        const toRm = new Set([d.id]); let ch = true;
        while (ch) ch = folders.some((x) => x.parentId && toRm.has(x.parentId) && !toRm.has(x.id) && toRm.add(x.id));
        return { output: [out("removed folder " + arg, "ok")], state: st({ folders: folders.filter((x) => !toRm.has(x.id)), files: files.filter((x) => !toRm.has(x.folderId)) }) };
      }
      return { output: [out("rm: " + arg + ": no such file or directory", "err")], state: st() };
    }
    default: return { output: [out("command not found: " + cmd + " — type 'help'", "err")], state: st() };
  }
}
