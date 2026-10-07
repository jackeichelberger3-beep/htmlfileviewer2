import { templates } from "./templates.js";
import { formatHTML, formatCSS, formatJS } from "./formatter.js";
import { isFoldMarker, parseFoldMarker, isFoldStart, findBlockEnd, applyFold, unfoldAt } from "./folding.js";
import { runCommand } from "./terminal.js";
import { downloadProjectZip } from "./zip.js";
import { importProjectZip } from "./zipimport.js";
import { loadSettings, saveSettings, applyTheme } from "./settings.js";
import { runStudio, MANUAL_HTML } from "./studiolang.js";

const LS_PROJECT = "htmlStudio.project.v2";
const LS_SNIPPETS = "htmlStudio.snippets.v1";
const ROOT_GID = "__root__";

const langOfExt = (n) => { const e = (n || "").split(".").pop().toLowerCase(); return e === "css" ? "css" : e === "js" ? "js" : "html"; };
const uid = (p) => p + "_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4);

function seedProject() {
  return { folders: [], files: [
    { id: "f_index", name: "index.html", folderId: null, lang: "html", content: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>My Project</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>Start building something great.</p>\n</body>\n</html>" },
    { id: "f_styles", name: "styles.css", folderId: null, lang: "css", content: "body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.6}\nh1{color:#1a73e8}" },
    { id: "f_script", name: "script.js", folderId: null, lang: "js", content: "console.log('Hello from script.js');" }
  ]};
}

// Group model: one tab per group; editor shows HTML | CSS | JS panes side by side
let groups = [], activeGroupId = ROOT_GID;
let paneSel = { html: null, css: null, js: null };
let focusedLang = "html";
let foldsByFile = {};
let project = loadProject();
let expanded = { [ROOT_GID]: true };
let snippets = loadSnippets();
let explorerView = "project";
let logs = [];
let previewTimer = null;
let termCwd = null;
let termLines = [{ text: 'HTML Studio terminal — type "help" for commands', cls: "muted" }];
let bottomTab = "console";
let searchOpen = false, searchQ = "", replaceQ = "", replaceOpen = false;
let searchOpts = { case: false, word: false, regex: false };
let searchResults = [], searchIdx = 0, searchTimer = null;
let panelOrder = ["explorer", "pages", "editor", "preview"], panelCollapsed = { explorer: false, editor: false, preview: false }, maximized = null;
let settings = loadSettings();
let themeDraftColors = { bg: "#0a0a0a", panel: "#121212", panel2: "#1a1a1a", border: "#2a2a2a", text: "#e8eaed", muted: "#9aa0a6", accent: "#8ab4f8", danger: "#f28b82", tabActive: "#1f1f1f" };

const $ = (id) => document.getElementById(id);
const root = $("root");
const tabbar = $("tabbar");
const panes = $("panes");
const editorWrap = $("editorWrap");
const activeGroupEl = $("activeGroupName");
const preview = $("preview");
const tplMenu = $("tplMenu");
const explorerBody = $("explorerBody");
const ctxMenu = $("ctxMenu");
const consoleEl = $("console");
const consoleBody = $("consoleBody");
const termBody = $("termBody");
const termLinesEl = $("termLines");
const termInput = $("termInput");
const dropOverlay = $("dropOverlay");
const searchBar = $("searchBar");
const searchInput = $("searchInput");
const replaceInput = $("replaceInput");
const searchResultsEl = $("searchResults");
const searchCountEl = $("searchCount");
const taskbar = $("taskbar");
const pagesBody = $("pagesBody");
const pagesPanel = document.querySelector('[data-panel="pages"]');
const settingsModalEl = $("settingsModal");

function loadProject() {
  try { const p = JSON.parse(localStorage.getItem(LS_PROJECT)); if (p && Array.isArray(p.files) && Array.isArray(p.folders) && p.files.length) return p; } catch (e) {}
  return seedProject();
}
function loadSnippets() {
  try { const s = JSON.parse(localStorage.getItem(LS_SNIPPETS)); if (Array.isArray(s)) return s; } catch (e) {}
  return [];
}
function persistProject() { localStorage.setItem(LS_PROJECT, JSON.stringify(project)); }
function persistSnippets() { localStorage.setItem(LS_SNIPPETS, JSON.stringify(snippets)); }

// ===== Groups =====
function groupsOf() {
  const byFolder = {};
  project.files.forEach((f) => { const k = f.folderId || ROOT_GID; (byFolder[k] = byFolder[k] || []).push(f); });
  const gs = [{ id: ROOT_GID, name: "Project", folderId: null, files: byFolder[ROOT_GID] || [] }];
  project.folders.forEach((fo) => gs.push({ id: fo.id, name: fo.name, folderId: fo.id, files: byFolder[fo.id] || [] }));
  return gs;
}
function refreshGroups() {
  groups = groupsOf();
  if (!groups.some((g) => g.id === activeGroupId)) activeGroupId = ROOT_GID;
}
function activeGrp() { return groups.find((g) => g.id === activeGroupId) || groups[0] || null; }

function buildDoc(html, css, js) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css || ""}</style></head><body>${html || ""}
<script>
const __send=(level,args)=>parent.postMessage({__console:true,level,message:args.map(a=>{try{return typeof a==='object'?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(' ')},'*');
['log','info','warn','error','debug'].forEach(l=>{const o=console[l];console[l]=(...a)=>{__send(l,a);try{o.apply(console,a)}catch(e){}}});
window.addEventListener('error',e=>__send('error',[e.message+' (line '+e.lineno+')']));
window.addEventListener('unhandledrejection',e=>__send('error',['Unhandled rejection: '+((e.reason&&e.reason.message)||e.reason)]));
<\/script>
<script>${js || ""}<\/script>
</body></html>`;
}

const FPS_OVERLAY = `<div id="__fps" style="position:fixed;top:8px;right:8px;z-index:999999;background:rgba(10,10,10,.82);color:#0f0;font:11px ui-monospace,Consolas,monospace;padding:7px 9px;border-radius:8px;pointer-events:auto;user-select:none;box-shadow:0 4px 14px rgba(0,0,0,.4);border:1px solid #2a2a2a">
  <div id="__fps_val" style="font-weight:600;display:__FPS_SHOW__">FPS --</div>
  <div id="__fps_mem" style="display:__MEM_SHOW__;margin-top:3px;color:#8ab4f8">MEM --</div>
  <div id="__fps_dom" style="display:__DOM_SHOW__;margin-top:2px;color:#fdd663">DOM --</div>
  <div style="display:flex;gap:4px;margin-top:5px">
    <button id="__fps_bMem" style="background:#1a1a1a;color:#e8eaed;border:1px solid #2a2a2a;border-radius:5px;padding:2px 6px;font-size:10px;cursor:pointer;font-family:inherit">MEM</button>
    <button id="__fps_bDom" style="background:#1a1a1a;color:#e8eaed;border:1px solid #2a2a2a;border-radius:5px;padding:2px 6px;font-size:10px;cursor:pointer;font-family:inherit">DOM</button>
  </div>
</div>
<script>
(function(){
  var val=document.getElementById('__fps_val'),memEl=document.getElementById('__fps_mem'),domEl=document.getElementById('__fps_dom');
  var frames=0,last=performance.now();
  function loop(t){ frames++; if(t-last>=500){ val.textContent='FPS '+Math.round(frames*1000/(t-last)); frames=0; last=t; if(memEl.style.display!=='none'&&performance.memory){memEl.textContent='MEM '+(performance.memory.usedJSHeapSize/1048576).toFixed(1)+' MB';} if(domEl.style.display!=='none'){domEl.textContent='DOM '+document.getElementsByTagName('*').length;} } requestAnimationFrame(loop); }
  document.getElementById('__fps_bMem').onclick=function(){var s=memEl.style;s.display=s.display==='none'?'block':'none';};
  document.getElementById('__fps_bDom').onclick=function(){var s=domEl.style;s.display=s.display==='none'?'block':'none';};
  requestAnimationFrame(loop);
})();
<\/script>`;

function statsOverlay(s) {
  if (!s.showFps && !s.showRam && !s.showDom) return "";
  return FPS_OVERLAY.replace("__FPS_SHOW__", s.showFps ? "block" : "none").replace("__MEM_SHOW__", s.showRam ? "block" : "none").replace("__DOM_SHOW__", s.showDom ? "block" : "none");
}
function withOverlay(doc, s) { const o = statsOverlay(s); return o ? doc.replace("</body>", o + "</body>") : doc; }

function combinedContent() {
  const g = activeGrp();
  const htmlFile = g ? g.files.find((f) => f.id === paneSel.html) : null;
  const firstHtml = project.files.find((f) => f.lang === "html");
  const htmlContent = htmlFile ? htmlFile.content : (firstHtml ? firstHtml.content : '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#555">No .html file in this project yet.</p>');
  const cssContent = project.files.filter((f) => f.lang === "css").map((f) => "/* " + f.name + " */\n" + f.content).join("\n\n");
  const jsContent = project.files.filter((f) => f.lang === "js").map((f) => "/* " + f.name + " */\n" + f.content).join("\n\n");
  return { htmlContent, cssContent, jsContent };
}

window.addEventListener("message", (e) => {
  if (e.data && e.data.__console) { logs.push({ level: e.data.level, message: e.data.message, time: new Date().toLocaleTimeString() }); renderConsole(); }
});

// ===== Panel drag-to-rearrange =====
let draggedPanel = null;
function initPanelDnD() {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const grip = panel.querySelector(".he-grip");
    grip.setAttribute("draggable", "true");
    grip.addEventListener("dragstart", (e) => { draggedPanel = panel; panel.classList.add("he-dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "panel"); });
    panel.addEventListener("dragover", (e) => { e.preventDefault(); if (!draggedPanel || draggedPanel === panel) return; const rect = panel.getBoundingClientRect(); if (e.clientX - rect.left > rect.width / 2) panel.after(draggedPanel); else panel.before(draggedPanel); });
    grip.addEventListener("dragend", () => { if (draggedPanel) draggedPanel.classList.remove("he-dragging"); draggedPanel = null; });
  });
}

// ===== Window controls (minimize to taskbar / maximize) =====
function maximizePanel(panel) {
  document.querySelectorAll(".he-maximized").forEach((p) => p.classList.remove("he-maximized"));
  panel.classList.add("he-maximized"); panel.classList.remove("he-minimized");
  $("main").classList.add("he-maximizing");
}
function clearMaximize() {
  document.querySelectorAll(".he-maximized").forEach((p) => p.classList.remove("he-maximized"));
  $("main").classList.remove("he-maximizing");
}
function updateWinLabels() {
  document.querySelectorAll("[data-panel]").forEach((p) => {
    const max = p.querySelector('[data-win=max]');
    if (max) { max.textContent = p.classList.contains("he-maximized") ? "▣" : "▢"; max.classList.toggle("on", p.classList.contains("he-maximized")); }
  });
}
function renderTaskbar() {
  taskbar.innerHTML = "";
  const mins = document.querySelectorAll("[data-panel].he-minimized");
  if (!mins.length) { taskbar.style.display = "none"; return; }
  taskbar.style.display = "flex";
  const label = document.createElement("span"); label.className = "he-taskbar-label"; label.textContent = "Minimized"; taskbar.appendChild(label);
  mins.forEach((p) => {
    const pid = p.dataset.panel;
    const icon = pid === "explorer" ? "📁" : pid === "pages" ? "🗂" : pid === "editor" ? "✏️" : "👁";
    const name = pid === "explorer" ? (explorerView === "library" ? "Library" : "Explorer") : pid === "pages" ? "Pages" : pid === "editor" ? "Editor" : "Preview";
    const btn = document.createElement("button"); btn.className = "he-taskbar-btn"; btn.title = "Restore";
    btn.innerHTML = `<span>${icon}</span><span></span>`; btn.querySelector("span:last-child").textContent = name;
    btn.addEventListener("click", () => { p.classList.remove("he-minimized"); updateWinLabels(); renderTaskbar(); });
    taskbar.appendChild(btn);
  });
}
function initWinControls() {
  document.querySelectorAll("[data-win]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest("[data-panel]");
      if (btn.dataset.win === "min") {
        if (panel.classList.contains("he-maximized")) clearMaximize();
        else panel.classList.toggle("he-minimized");
      } else {
        if (panel.classList.contains("he-maximized")) clearMaximize();
        else maximizePanel(panel);
      }
      updateWinLabels(); renderTaskbar();
    });
  });
}

// ===== Terminal =====
function renderTerminal() {
  termLinesEl.innerHTML = "";
  termLines.forEach((l) => {
    const row = document.createElement("div"); row.className = "he-term-line " + (l.cls || "");
    const pr = document.createElement("span"); pr.className = "he-term-prompt"; pr.textContent = l.cls === "cmd" ? "$" : "›";
    const tx = document.createElement("span"); tx.style.whiteSpace = "pre-wrap"; tx.style.wordBreak = "break-word"; tx.textContent = l.text;
    row.appendChild(pr); row.appendChild(tx); termLinesEl.appendChild(row);
  });
  termBody.scrollTop = termBody.scrollHeight;
}
let studioOn = false;
function runTerminal(raw) {
  const input = (raw || "").trim();
  if (!input) return;
  const isSl = /^(set|out|print|if|else|end|repeat|while|read|append)\b/i.test(input);
  const push = (lines) => { termLines = [...termLines, ...lines]; };
  if (/^admin\b/i.test(input)) {
    if (studioOn) { push([{ text: input, cls: "cmd" }, { text: "Advanced mode is already active.", cls: "ok" }]); renderTerminal(); return; }
    const pw = input.length > 5 ? input.slice(6).trim() : window.prompt("Admin password:");
    if (pw !== null && pw === (settings.terminalPassword || "admin")) {
      studioOn = true;
      push([{ text: input, cls: "cmd" }, { text: "⚡ Advanced mode unlocked — Studio Language active. Full manual: Settings → Studio Language.", cls: "ok" }]);
    } else push([{ text: input, cls: "cmd" }, { text: "Wrong password.", cls: "err" }]);
    renderTerminal(); return;
  }
  if (/^exit$/i.test(input) && studioOn) { studioOn = false; push([{ text: input, cls: "cmd" }, { text: "Advanced mode off.", cls: "muted" }]); renderTerminal(); return; }
  if (isSl && !studioOn) { push([{ text: input, cls: "cmd" }, { text: "Advanced mode is locked — type admin to unlock.", cls: "err" }]); renderTerminal(); return; }
  if (isSl) {
    try {
      const res = runStudio(input, { files: project.files, folders: project.folders });
      push([{ text: input, cls: "cmd" }, ...res.output.map((o) => ({ text: o.text, cls: o.cls }))]);
      if (res.changes.length) {
        res.changes.forEach((ch) => { const f = project.files.find((x) => x.id === ch.id); if (f) f.content = ch.content; });
        persistProject(); syncActive();
      }
    } catch (e) {
      push([{ text: input, cls: "cmd" }, { text: "⚠ " + (e.message || "Studio Language error"), cls: "err" }]);
    }
    renderTerminal(); return;
  }
  const res = runCommand(input, { folders: project.folders, files: project.files, cwd: termCwd });
  if (res.clear) { termLines = []; }
  else termLines = [...termLines, { text: input, cls: "cmd" }, ...res.output.map((o) => ({ text: o.text, cls: o.cls }))];
  if (res.state.folders !== project.folders || res.state.files !== project.files || res.state.cwd !== termCwd) {
    project.folders = res.state.folders; project.files = res.state.files; termCwd = res.state.cwd;
    persistProject();
    renderExplorer(); syncActive();
  }
  renderTerminal();
}
termInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { runTerminal(termInput.value); termInput.value = ""; } });
document.querySelectorAll(".he-bottom-tab").forEach((b) => b.addEventListener("click", () => {
  bottomTab = b.dataset.bt;
  document.querySelectorAll(".he-bottom-tab").forEach((x) => x.classList.toggle("active", x === b));
  consoleBody.style.display = bottomTab === "console" ? "block" : "none";
  termBody.style.display = bottomTab === "terminal" ? "block" : "none";
  if (bottomTab === "terminal") termInput.focus();
}));

// ===== Snippets library =====
function renderExplorer() {
  refreshGroups();
  renderPages();
  explorerBody.innerHTML = "";
  if (explorerView === "library") { renderLibrary(); return; }
  if (project.folders.length === 0 && project.files.length === 0) { explorerBody.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:.5rem">No files yet. Click 📄＋ to add one.</div>'; return; }
  renderTree(null, 0, explorerBody);
}
function renderLibrary() {
  explorerBody.innerHTML = "";
  if (!snippets.length) { explorerBody.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:.5rem">No snippets yet. Click 📚＋ to save reusable code.</div>'; return; }
  snippets.forEach((s) => {
    const item = document.createElement("div"); item.className = "he-lib-item";
    const name = document.createElement("span"); name.className = "he-lib-name"; name.textContent = s.name; name.title = "Insert into focused pane"; name.addEventListener("click", () => insertSnippet(s));
    const lang = document.createElement("span"); lang.className = "he-lib-lang"; lang.textContent = s.lang;
    const acts = document.createElement("span"); acts.className = "he-exp-actions";
    const ins = document.createElement("button"); ins.className = "he-exp-btn"; ins.title = "Insert"; ins.textContent = "↧"; ins.addEventListener("click", () => insertSnippet(s));
    const ed = document.createElement("button"); ed.className = "he-exp-btn"; ed.title = "Edit"; ed.textContent = "✎"; ed.addEventListener("click", () => editSnippet(s));
    const del = document.createElement("button"); del.className = "he-exp-btn"; del.title = "Delete"; del.textContent = "🗑"; del.addEventListener("click", () => deleteSnippet(s.id));
    acts.appendChild(ins); acts.appendChild(ed); acts.appendChild(del);
    item.appendChild(name); item.appendChild(lang); item.appendChild(acts);
    explorerBody.appendChild(item);
  });
}
function insertSnippet(s) {
  const g = activeGrp(); if (!g) return;
  let file = g.files.find((f) => f.id === paneSel[focusedLang]);
  if (!file) {
    const lang = focusedLang; let name = "untitled." + lang; let i = 1;
    while (g.files.some((f) => f.name === name)) { name = "untitled" + i + "." + lang; i++; }
    file = { id: uid("file"), name, folderId: g.folderId, lang, content: s.code };
    project.files.push(file); persistProject(); renderExplorer(); syncActive(); schedulePreview();
    return;
  }
  const ta = panes.querySelector('textarea[data-file="' + file.id + '"]');
  const cur = file.content || ""; let nc;
  if (ta) { const st = ta.selectionStart, en = ta.selectionEnd; nc = cur.slice(0, st) + s.code + cur.slice(en); }
  else nc = cur + s.code;
  file.content = nc; persistProject(); syncActive(); schedulePreview();
}
function editSnippet(s) {
  snippetEditId = s.id; $("snippetModalHead").textContent = "Edit Snippet";
  $("snipName").value = s.name; $("snipLang").value = s.lang; $("snipCode").value = s.code;
  $("snippetModal").style.display = "grid";
}
function deleteSnippet(id) { snippets = snippets.filter((s) => s.id !== id); persistSnippets(); renderLibrary(); }
let snippetEditId = null;
function openNewSnippet() {
  snippetEditId = null; $("snippetModalHead").textContent = "New Snippet";
  const g = activeGrp();
  const ta = panes.querySelector('textarea[data-file="' + (g && g.files.find((f) => f.id === paneSel[focusedLang]) ? paneSel[focusedLang] : "") + '"]');
  let code = "";
  const f = g ? g.files.find((x) => x.id === paneSel[focusedLang]) : null;
  if (ta && f) { const s = ta.selectionStart, e = ta.selectionEnd; if (e > s) code = (f.content || "").slice(s, e); }
  $("snipName").value = ""; $("snipLang").value = focusedLang; $("snipCode").value = code;
  $("snippetModal").style.display = "grid";
}
function saveSnippetFromModal() {
  const name = $("snipName").value.trim(); if (!name) { window.alert("Snippet name required"); return; }
  const lang = $("snipLang").value, code = $("snipCode").value;
  if (snippetEditId) snippets = snippets.map((s) => (s.id === snippetEditId ? { ...s, name, lang, code } : s));
  else snippets.push({ id: "snip_" + Date.now(), name, lang, code });
  persistSnippets(); $("snippetModal").style.display = "none"; renderLibrary();
}

// ===== Search & replace =====
function buildRegex(q, o) {
  if (!q) return null;
  let src = o.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (o.word) src = "\\b" + src + "\\b";
  let flags = "g"; if (!o.case) flags += "i";
  try { return new RegExp(src, flags); } catch { return null; }
}
function openSearch(withReplace) { searchOpen = true; searchBar.style.display = "flex"; searchInput.focus(); if (withReplace) setReplaceOpen(true); }
function closeSearch() { searchOpen = false; searchBar.style.display = "none"; }
function setReplaceOpen(v) {
  replaceOpen = v;
  replaceInput.style.display = v ? "block" : "none";
  $("replaceBtn").style.display = v ? "inline-flex" : "none";
  $("replaceAllBtn").style.display = v ? "inline-flex" : "none";
  $("toggleReplaceBtn").textContent = (v ? "▾" : "▸") + " Replace";
}
function scheduleSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 200); }
function runSearch() {
  const results = [];
  if (searchQ) {
    const re = buildRegex(searchQ, searchOpts);
    if (re) for (const f of project.files) {
      const c = f.content || ""; re.lastIndex = 0; let m;
      while ((m = re.exec(c)) && results.length < 500) {
        const before = c.slice(0, m.index); const line = before.split("\n").length;
        results.push({ fileId: f.id, fileName: f.name, lang: f.lang, groupId: f.folderId || ROOT_GID, offset: m.index, length: m[0].length, line, preview: c.slice(m.index, m.index + 80).replace(/\n/g, " ") });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  }
  searchResults = results; searchIdx = 0; renderSearchResults();
}
function renderSearchResults() {
  searchCountEl.textContent = searchResults.length + " matches";
  searchResultsEl.innerHTML = "";
  searchResults.forEach((r, i) => {
    const row = document.createElement("div"); row.className = "he-search-res" + (i === searchIdx ? " active" : "");
    const loc = document.createElement("span"); loc.className = "he-res-loc"; loc.textContent = r.fileName + ":" + r.lang + ":" + r.line;
    const prev = document.createElement("span"); prev.style.overflow = "hidden"; prev.style.textOverflow = "ellipsis"; prev.textContent = r.preview;
    row.appendChild(loc); row.appendChild(prev);
    row.addEventListener("click", () => { searchIdx = i; renderSearchResults(); gotoResult(r); });
    searchResultsEl.appendChild(row);
  });
}
function gotoResult(r) {
  activeGroupId = r.groupId; paneSel[r.lang] = r.fileId; syncActive();
  const ta = panes.querySelector('textarea[data-file="' + r.fileId + '"]');
  if (ta) {
    ta.focus(); ta.selectionStart = r.offset; ta.selectionEnd = r.offset + r.length;
    const before = ta.value.slice(0, r.offset); const line = before.split("\n").length;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    ta.scrollTop = Math.max(0, (line - 5) * lh);
    const g = ta.parentElement.querySelector(".he-gutter"); if (g) g.scrollTop = ta.scrollTop;
  }
}
function searchStep(d) { if (!searchResults.length) return; searchIdx = (searchIdx + d + searchResults.length) % searchResults.length; renderSearchResults(); gotoResult(searchResults[searchIdx]); }
function replaceCurrent() {
  const r = searchResults[searchIdx]; if (!r) return;
  const f = project.files.find((x) => x.id === r.fileId); if (!f) return;
  f.content = (f.content || "").slice(0, r.offset) + replaceQ + (f.content || "").slice(r.offset + r.length);
  persistProject(); syncActive(); scheduleSearch();
}
function replaceAll() {
  const re = buildRegex(searchQ, searchOpts); if (!re) return;
  project.files.forEach((f) => { f.content = (f.content || "").replace(re, replaceQ); });
  persistProject(); syncActive(); scheduleSearch();
}
$("searchBtn").addEventListener("click", () => openSearch(false));
$("findInEditorBtn").addEventListener("click", () => openSearch(false));
$("closeSearchBtn").addEventListener("click", closeSearch);
$("toggleReplaceBtn").addEventListener("click", () => setReplaceOpen(!replaceOpen));
searchInput.addEventListener("input", () => { searchQ = searchInput.value; scheduleSearch(); });
replaceInput.addEventListener("input", () => { replaceQ = replaceInput.value; });
$("searchPrev").addEventListener("click", () => searchStep(-1));
$("searchNext").addEventListener("click", () => searchStep(1));
$("replaceBtn").addEventListener("click", replaceCurrent);
$("replaceAllBtn").addEventListener("click", replaceAll);
$("optCase").addEventListener("click", () => { searchOpts.case = !searchOpts.case; $("optCase").classList.toggle("on", searchOpts.case); scheduleSearch(); });
$("optWord").addEventListener("click", () => { searchOpts.word = !searchOpts.word; $("optWord").classList.toggle("on", searchOpts.word); scheduleSearch(); });
$("optRegex").addEventListener("click", () => { searchOpts.regex = !searchOpts.regex; $("optRegex").classList.toggle("on", searchOpts.regex); scheduleSearch(); });
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "f") { e.preventDefault(); openSearch(false); }
  else if ((e.ctrlKey || e.metaKey) && k === "h") { e.preventDefault(); openSearch(true); }
  else if (e.key === "Escape" && searchOpen) closeSearch();
});

// ===== Rendering =====
function renderTabs() {
  refreshGroups();
  tabbar.style.display = settings.sideTabs ? "none" : "flex";
  if (settings.sideTabs) { tabbar.innerHTML = ""; return; }
  tabbar.innerHTML = "";
  groups.forEach((g) => {
    const el = document.createElement("div");
    el.className = "he-tab" + (g.id === activeGroupId ? " active" : "");
    el.title = g.name;
    el.innerHTML = `<span class="he-tab-name"></span>`;
    el.querySelector(".he-tab-name").textContent = g.name;
    el.addEventListener("click", () => { activeGroupId = g.id; syncActive(); });
    if (g.folderId) el.addEventListener("contextmenu", (e) => { e.preventDefault(); openCtx(e.clientX, e.clientY, [
      { label: "✏️ Rename", fn: () => renameGroup(g.id) },
      { sep: true },
      { label: "🗑 Delete group", fn: () => deleteFolder(g.id) }
    ]); });
    tabbar.appendChild(el);
  });
  const plus = document.createElement("button"); plus.className = "he-newtab"; plus.title = "New group"; plus.textContent = "+"; plus.addEventListener("click", addGroup); tabbar.appendChild(plus);
}
function syncActive() {
  refreshGroups();
  renderTabs(); renderPages(); renderPanes();
  const g = activeGrp();
  if (activeGroupEl) activeGroupEl.textContent = g ? g.name : "";
  scheduleSearch(); schedulePreview();
}
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(() => { const c = combinedContent(); preview.srcdoc = withOverlay(buildDoc(c.htmlContent, c.cssContent, c.jsContent), settings); }, 400); }
function renderConsole() {
  if (!logs.length) { consoleBody.innerHTML = '<div style="color:var(--muted)">Console output from your JavaScript will appear here.</div>'; }
  else {
    consoleBody.innerHTML = logs.map((l) => `<div class="he-log ${l.level}"><span class="he-log-time">${l.time}</span><span class="he-log-msg"></span></div>`).join("");
    Array.from(consoleBody.querySelectorAll(".he-log")).forEach((el, i) => { el.querySelector(".he-log-msg").textContent = logs[i].message; });
  }
  updateShowConsole();
}
function updateShowConsole() {
  const btn = $("showConsole"); if (!btn) return;
  btn.style.display = consoleEl.style.display === "none" ? "inline-flex" : "none";
  btn.textContent = "🖥 Show console (" + logs.length + ")";
}
function renderTemplatesMenu() {
  const groups2 = {}; templates.forEach((t, i) => { (groups2[t.category] = groups2[t.category] || []).push({ ...t, _i: i }); });
  tplMenu.innerHTML = "";
  Object.entries(groups2).forEach(([cat, items]) => {
    const catEl = document.createElement("div"); catEl.className = "he-menu-cat"; catEl.textContent = cat; tplMenu.appendChild(catEl);
    items.forEach((t) => {
      const it = document.createElement("div"); it.className = "he-menu-item";
      it.innerHTML = `<span class="he-tpl-icon">${t.icon}</span><span></span>`;
      it.querySelector("span:last-child").textContent = t.name;
      it.addEventListener("click", () => addTemplate(t)); tplMenu.appendChild(it);
    });
  });
}

// ===== Combined editor panes =====
function renderGutterFor(gutterEl, file) {
  const lines = (file.content || "").split("\n");
  gutterEl.innerHTML = "";
  lines.forEach((l, i) => {
    const row = document.createElement("div"); row.className = "he-gutter-row";
    const fold = document.createElement("span"); fold.className = "he-gutter-fold";
    const num = document.createElement("span"); num.className = "he-gutter-num"; num.textContent = i + 1;
    const marker = isFoldMarker(l);
    const start = !marker && isFoldStart(lines, i, file.lang);
    fold.textContent = marker ? "▸" : (start ? "▾" : "");
    if (marker) fold.addEventListener("click", () => doUnfoldFile(file.id, i));
    else if (start) fold.addEventListener("click", () => doFoldFile(file.id, i));
    row.appendChild(fold); row.appendChild(num); gutterEl.appendChild(row);
  });
}
function renderPanes() {
  const g = activeGrp(); if (!g || !panes) return;
  panes.innerHTML = "";
  ["html", "css", "js"].forEach((lang) => {
    const langFiles = g.files.filter((f) => f.lang === lang);
    let fileId = paneSel[lang];
    if (!langFiles.some((f) => f.id === fileId)) fileId = langFiles.length ? langFiles[0].id : null;
    paneSel[lang] = fileId;
    const file = langFiles.find((f) => f.id === fileId) || null;
    const pane = document.createElement("div"); pane.className = "he-pane" + (focusedLang === lang ? " focused" : "");
    const head = document.createElement("div"); head.className = "he-pane-head";
    const badge = document.createElement("span"); badge.className = "he-pane-lang"; badge.textContent = lang.toUpperCase();
    const sel = document.createElement("select"); sel.className = "he-pane-file";
    if (langFiles.length) langFiles.forEach((f) => { const o = document.createElement("option"); o.value = f.id; o.textContent = f.name; if (f.id === fileId) o.selected = true; sel.appendChild(o); });
    else { const o = document.createElement("option"); o.value = ""; o.textContent = "no ." + lang + " file"; sel.appendChild(o); }
    sel.addEventListener("change", () => { paneSel[lang] = sel.value || null; renderPanes(); schedulePreview(); });
    head.appendChild(badge); head.appendChild(sel);
    const wrap = document.createElement("div"); wrap.className = "he-pane-wrap";
    if (file) {
      const gutterEl = document.createElement("div"); gutterEl.className = "he-gutter slim";
      const ta = document.createElement("textarea"); ta.className = "he-textarea he-pane-text"; ta.spellcheck = false;
      ta.placeholder = "Type " + lang.toUpperCase() + " here…"; ta.value = file.content || "";
      ta.dataset.file = file.id;
      const onInput = () => { file.content = ta.value; persistProject(); renderGutterFor(gutterEl, file); schedulePreview(); scheduleSearch(); };
      ta.addEventListener("input", onInput);
      ta.addEventListener("scroll", () => { gutterEl.scrollTop = ta.scrollTop; });
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd;
          ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(en);
          file.content = ta.value; persistProject(); renderGutterFor(gutterEl, file); schedulePreview();
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
        }
      });
      pane.addEventListener("mousedown", () => {
        focusedLang = lang;
        document.querySelectorAll(".he-pane").forEach((p) => p.classList.remove("focused"));
        pane.classList.add("focused");
      });
      renderGutterFor(gutterEl, file);
      wrap.appendChild(gutterEl); wrap.appendChild(ta);
    } else {
      const empty = document.createElement("div"); empty.className = "he-pane-empty";
      empty.textContent = "No ." + lang + " file in this group. Use 📄＋ in the explorer to add one.";
      wrap.appendChild(empty);
    }
    pane.appendChild(head); pane.appendChild(wrap);
    panes.appendChild(pane);
  });
}
function doFoldFile(fileId, lineIndex) {
  const f = project.files.find((x) => x.id === fileId); if (!f) return;
  const lines = (f.content || "").split("\n");
  const end = findBlockEnd(lines, lineIndex, f.lang);
  if (end <= lineIndex) return;
  const id = "f" + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  const { content, stored } = applyFold(f.content, lineIndex, end, f.lang, id);
  f.content = content;
  foldsByFile[fileId] = [...(foldsByFile[fileId] || []), { id, stored }];
  persistProject(); renderPanes(); schedulePreview();
}
function doUnfoldFile(fileId, lineIndex) {
  const f = project.files.find((x) => x.id === fileId); if (!f) return;
  const lines = (f.content || "").split("\n");
  const id = parseFoldMarker(lines[lineIndex]); if (!id) return;
  const fold = (foldsByFile[fileId] || []).find((x) => x.id === id); if (!fold) return;
  f.content = unfoldAt(f.content, id, fold.stored);
  foldsByFile[fileId] = foldsByFile[fileId].filter((x) => x.id !== id);
  persistProject(); renderPanes(); schedulePreview();
}

function renderTree(parentId, depth, container) {
  if (parentId === null) {
    const rootFiles = project.files.filter((f) => !f.folderId);
    if (rootFiles.length) {
      const head = document.createElement("div"); head.className = "he-exp-item"; head.style.paddingLeft = "4px";
      const chev = document.createElement("span"); chev.className = "he-exp-chevron"; chev.textContent = expanded[ROOT_GID] ? "▾" : "▸";
      const nm = document.createElement("span"); nm.textContent = "📦 Project";
      head.appendChild(chev); head.appendChild(nm);
      const toggle = (e) => { e.stopPropagation(); expanded[ROOT_GID] = !expanded[ROOT_GID]; renderExplorer(); };
      head.addEventListener("click", toggle);
      container.appendChild(head);
      if (expanded[ROOT_GID]) rootFiles.forEach((f) => container.appendChild(fileItem(f, 0)));
    }
  }
  project.folders.filter((f) => (f.parentId || null) === parentId).forEach((f) => {
    const row = document.createElement("div");
    const item = document.createElement("div");
    item.className = "he-exp-item"; item.style.paddingLeft = (depth * 14 + 4) + "px";
    item.innerHTML = `<span class="he-exp-chevron"></span><span></span><span class="he-exp-actions"><button class="he-exp-btn" title="New file">＋</button></span>`;
    item.querySelector(".he-exp-chevron").textContent = expanded[f.id] ? "▾" : "▸";
    item.querySelector("span:nth-of-type(2)").textContent = "📁 " + f.name;
    item.querySelector(".he-exp-chevron").addEventListener("click", (e) => { e.stopPropagation(); toggleExpand(f.id); });
    item.querySelector("span:nth-of-type(2)").addEventListener("click", () => toggleExpand(f.id));
    item.querySelector(".he-exp-btn").addEventListener("click", (e) => { e.stopPropagation(); createFile(f.id); });
    item.addEventListener("contextmenu", (e) => { e.preventDefault(); openCtx(e.clientX, e.clientY, [
      { label: "📄 New file", fn: () => createFile(f.id) },
      { label: "📁 New folder", fn: () => createFolder(f.id) },
      { label: "✎ Rename", fn: () => renameItem(f, true) },
      { sep: true },
      { label: "🗑 Delete", fn: () => deleteFolder(f.id) }
    ]); });
    row.appendChild(item);
    if (expanded[f.id]) { const sub = document.createElement("div"); renderTree(f.id, depth + 1, sub); row.appendChild(sub); }
    container.appendChild(row);
  });
  if (parentId !== null) project.files.filter((f) => (f.folderId || null) === parentId).forEach((f) => container.appendChild(fileItem(f, depth)));
}
function fileItem(f, depth) {
  const item = document.createElement("div");
  item.className = "he-exp-item"; item.style.paddingLeft = (depth * 14 + 18) + "px";
  item.innerHTML = `<span></span><span class="he-exp-actions"><button class="he-exp-btn" title="Rename">✎</button><button class="he-exp-btn" title="Delete">🗑</button></span>`;
  item.querySelector("span:first-child").textContent = "📄 " + f.name;
  item.addEventListener("click", () => openExplorerFile(f));
  item.querySelector("button[title=Rename]").addEventListener("click", (e) => { e.stopPropagation(); renameItem(f, false); });
  item.querySelector("button[title=Delete]").addEventListener("click", (e) => { e.stopPropagation(); deleteFile(f.id); });
  item.addEventListener("contextmenu", (e) => { e.preventDefault(); openCtx(e.clientX, e.clientY, [
    { label: "📂 Open", fn: () => openExplorerFile(f) },
    { label: "✎ Rename", fn: () => renameItem(f, false) },
    { sep: true },
    { label: "🗑 Delete", fn: () => deleteFile(f.id) }
  ]); });
  return item;
}
function openCtx(x, y, items) {
  ctxMenu.innerHTML = "";
  items.forEach((it) => {
    if (it.sep) { const s = document.createElement("div"); s.className = "he-ctx-sep"; ctxMenu.appendChild(s); return; }
    const el = document.createElement("div"); el.className = "he-ctx-item"; el.textContent = it.label;
    el.addEventListener("click", () => { it.fn(); hideCtx(); });
    ctxMenu.appendChild(el);
  });
  ctxMenu.style.left = x + "px"; ctxMenu.style.top = y + "px"; ctxMenu.style.display = "block";
}
function hideCtx() { ctxMenu.style.display = "none"; }
window.addEventListener("click", hideCtx);
window.addEventListener("scroll", hideCtx, true);

// ===== Actions =====
function createFile(folderId) {
  const name = window.prompt("File name (e.g. page.html, style.css, app.js):", "page.html"); if (!name || !name.trim()) return;
  const lang = langOfExt(name); const id = uid("file");
  project.files.push({ id, name: name.trim(), folderId, lang, content: "" }); persistProject(); renderExplorer();
  paneSel[lang] = paneSel[lang] || id;
  syncActive();
}
function addGroup() {
  const name = window.prompt("Group name (creates HTML, CSS and JS files):", "New Group"); if (!name || !name.trim()) return;
  const fid = uid("fld"); const n = name.trim();
  project.folders.push({ id: fid, name: n, parentId: null });
  ["html", "css", "js"].forEach((lang) => project.files.push({ id: uid("file"), name: n + "." + lang, folderId: fid, lang, content: "" }));
  persistProject(); expanded[fid] = true; activeGroupId = fid;
  renderExplorer(); syncActive();
}
function renameGroup(id) {
  const fo = project.folders.find((f) => f.id === id); const name = window.prompt("Group name:", fo ? fo.name : "");
  if (name && name.trim()) { fo.name = name.trim(); persistProject(); renderExplorer(); renderTabs(); }
}
function addTemplate(tpl) {
  const fid = uid("fld"); const base = tpl.name;
  project.folders.push({ id: fid, name: base, parentId: null });
  ["html", "css", "js"].forEach((lang) => project.files.push({ id: uid("file"), name: base + "." + lang, folderId: fid, lang, content: tpl.data[lang] || "" }));
  persistProject(); expanded[fid] = true; activeGroupId = fid;
  renderExplorer(); syncActive(); tplMenu.style.display = "none";
}
function openFile(file) {
  if (/\.zip$/i.test(file.name)) { importZipFile(file); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || ""); const lang = langOfExt(file.name); const id = uid("file");
    const g = activeGrp();
    project.files.push({ id, name: file.name, folderId: g ? g.folderId : null, lang, content: text });
    persistProject(); renderExplorer();
    paneSel[lang] = id;
    syncActive();
  };
  reader.readAsText(file);
}
function importZipFile(file) {
  importProjectZip(file).then(({ folders, files }) => {
    if (!files.length) { window.alert("No supported text files found in this zip (html, css, js, json, md, svg, txt)"); return; }
    project.folders.push(...folders);
    project.files.push(...files);
    persistProject();
    expanded[folders[0].id] = true;
    activeGroupId = folders[0].id;
    renderExplorer(); syncActive();
  }).catch(() => window.alert("Could not read that zip file"));
}
function onFilesPicked(files) { Array.from(files).forEach(openFile); }
function formatCurrent() {
  const g = activeGrp(); if (!g) return;
  const f = g.files.find((x) => x.id === paneSel[focusedLang]); if (!f) return;
  f.content = f.lang === "html" ? formatHTML(f.content || "") : f.lang === "css" ? formatCSS(f.content || "") : formatJS(f.content || "");
  foldsByFile[f.id] = [];
  persistProject(); syncActive();
}
function openInNewTab() { const c = combinedContent(); const doc = withOverlay(buildDoc(c.htmlContent, c.cssContent, c.jsContent), settings); const w = window.open("about:blank", "_blank"); if (w) { w.document.open(); w.document.write(doc); w.document.close(); } }
function refreshPreview() { const c = combinedContent(); preview.srcdoc = withOverlay(buildDoc(c.htmlContent, c.cssContent, c.jsContent), settings); }
function saveAll() { persistProject(); }
function openExplorerFile(file) {
  const g = groups.find((gr) => gr.files.some((f) => f.id === file.id));
  if (!g) return;
  activeGroupId = g.id; paneSel[file.lang] = file.id;
  syncActive();
}
function createFolder(parentId) { const name = window.prompt("Folder name:", "New Folder"); if (!name || !name.trim()) return; project.folders.push({ id: uid("fld"), name: name.trim(), parentId }); persistProject(); renderExplorer(); }
function renameItem(item, isFolder) { const name = window.prompt(isFolder ? "Folder name:" : "File name:", item.name); if (!name || !name.trim()) return; item.name = name.trim(); if (!isFolder) item.lang = langOfExt(name); persistProject(); renderExplorer(); renderTabs(); }
function deleteFolder(id) {
  if (!window.confirm("Delete group and all its contents?")) return;
  const toRemove = new Set([id]); let added = true;
  while (added) { added = false; for (const f of project.folders) { if (f.parentId && toRemove.has(f.parentId) && !toRemove.has(f.id)) { toRemove.add(f.id); added = true; } } }
  project.folders = project.folders.filter((f) => !toRemove.has(f.id));
  project.files = project.files.filter((f) => !toRemove.has(f.folderId));
  persistProject(); renderExplorer(); syncActive();
}
function deleteFile(id) {
  if (!window.confirm("Delete this file?")) return;
  project.files = project.files.filter((f) => f.id !== id);
  delete foldsByFile[id];
  persistProject(); renderExplorer(); syncActive();
}
function toggleExpand(id) { expanded[id] = !expanded[id]; renderExplorer(); }

// ===== Wiring =====
$("tplBtn").addEventListener("click", (e) => { e.stopPropagation(); tplMenu.style.display = tplMenu.style.display === "none" ? "block" : "none"; });
$("openBtn").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (e) => { onFilesPicked(e.target.files); e.target.value = ""; });
$("newBtn").addEventListener("click", addGroup);
$("fmtBtn").addEventListener("click", formatCurrent);
$("saveBtn").addEventListener("click", saveAll);
$("runBtn").addEventListener("click", refreshPreview);
$("newTabBtn").addEventListener("click", openInNewTab);
$("exportBtn").addEventListener("click", () => downloadProjectZip(project));
$("refreshBtn").addEventListener("click", refreshPreview);
$("openNewBtn").addEventListener("click", openInNewTab);
$("newFileBtn").addEventListener("click", () => createFile(activeGrp() ? activeGrp().folderId : null));
$("newFolderBtn").addEventListener("click", () => createFolder(null));
$("newSnippetBtn").addEventListener("click", openNewSnippet);
$("snipSave").addEventListener("click", saveSnippetFromModal);
$("snipCancel").addEventListener("click", () => { $("snippetModal").style.display = "none"; });
document.querySelectorAll(".he-view-tab").forEach((b) => b.addEventListener("click", () => {
  explorerView = b.dataset.view;
  document.querySelectorAll(".he-view-tab").forEach((x) => x.classList.toggle("active", x === b));
  $("newFileBtn").style.display = explorerView === "project" ? "inline-flex" : "none";
  $("newFolderBtn").style.display = explorerView === "project" ? "inline-flex" : "none";
  $("newSnippetBtn").style.display = explorerView === "library" ? "inline-flex" : "none";
  renderExplorer();
}));
$("clrBtn").addEventListener("click", () => { if (bottomTab === "console") { logs = []; renderConsole(); } else { termLines = [{ text: "", cls: "muted" }]; renderTerminal(); } });
$("hideConsole").addEventListener("click", () => { consoleEl.style.display = "none"; updateShowConsole(); });
$("showConsole").addEventListener("click", () => { consoleEl.style.display = "flex"; updateShowConsole(); });

editorWrap.addEventListener("dragover", (e) => { e.preventDefault(); dropOverlay.style.display = "grid"; });
editorWrap.addEventListener("dragleave", (e) => { if (e.target === editorWrap) dropOverlay.style.display = "none"; });
editorWrap.addEventListener("drop", (e) => { e.preventDefault(); dropOverlay.style.display = "none"; if (e.dataTransfer.files.length) onFilesPicked(e.dataTransfer.files); });

// ===== Settings (app name, themes, side tabs, backup) =====
const themeSelect = $("themeSelect");
themeSelect.addEventListener("change", (e) => { settings.theme = e.target.value; applyTheme(root, settings.theme, settings.customThemes); persistSettings(); });

const COLOR_FIELDS = [["bg","Background"],["panel","Panel"],["panel2","Panel alt"],["border","Border"],["text","Text"],["muted","Muted"],["accent","Accent"],["danger","Danger"],["tabActive","Active tab"]];

function persistSettings() { saveSettings(settings); }
function updateLogo() {
  const el = document.querySelector(".he-logo"); if (!el) return;
  el.textContent = "";
  const dot = document.createElement("span"); dot.className = "he-logo-dot"; el.appendChild(dot);
  el.appendChild(document.createTextNode(settings.appName || "HTML Studio"));
}
function refreshThemeSelects() {
  const opts = [
    { id: "black", label: "Black theme" }, { id: "grey", label: "Grey theme" },
    { id: "white", label: "White theme" }, { id: "retro", label: "Retro theme" }
  ].concat((settings.customThemes || []).map((t) => ({ id: t.id, label: t.name + " theme" })));
  [themeSelect, $("setTheme")].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = "";
    opts.forEach((o) => { const op = document.createElement("option"); op.value = o.id; op.textContent = o.label; sel.appendChild(op); });
    sel.value = settings.theme;
  });
}
function renderPages() {
  if (!pagesBody) return;
  pagesPanel.style.display = settings.sideTabs ? "flex" : "none";
  pagesBody.innerHTML = "";
  const cat1 = document.createElement("div"); cat1.className = "he-pages-cat"; cat1.textContent = "Groups"; pagesBody.appendChild(cat1);
  groups.forEach((g) => {
    const item = document.createElement("div"); item.className = "he-page-item" + (g.id === activeGroupId ? " active" : ""); item.title = g.name;
    item.innerHTML = `<span class="he-page-icon">📦</span><span class="he-page-name"></span>` + (g.folderId ? `<span class="he-exp-actions"><button class="he-exp-btn" title="Rename">✎</button></span>` : "");
    item.querySelector(".he-page-name").textContent = g.name;
    item.addEventListener("click", () => { activeGroupId = g.id; syncActive(); });
    const rb = item.querySelector("button[title=Rename]");
    if (rb) rb.addEventListener("click", (e) => { e.stopPropagation(); renameGroup(g.id); });
    pagesBody.appendChild(item);
  });
  const cat2 = document.createElement("div"); cat2.className = "he-pages-cat"; cat2.textContent = "HTML pages"; pagesBody.appendChild(cat2);
  const htmlFiles = project.files.filter((f) => f.lang === "html");
  if (!htmlFiles.length) { const e = document.createElement("div"); e.className = "he-pages-empty"; e.textContent = "No .html pages yet"; pagesBody.appendChild(e); }
  htmlFiles.forEach((f) => {
    const item = document.createElement("div"); item.className = "he-page-item"; item.title = f.name;
    item.innerHTML = `<span class="he-page-icon">🌐</span><span class="he-page-name"></span>`;
    item.querySelector(".he-page-name").textContent = f.name;
    item.addEventListener("click", () => openExplorerFile(f));
    pagesBody.appendChild(item);
  });
}
function renderCustomThemeList() {
  const list = $("customThemeList"); list.innerHTML = "";
  if (!(settings.customThemes || []).length) { list.innerHTML = '<div style="color:var(--muted);font-size:.78rem">No personal themes yet.</div>'; return; }
  settings.customThemes.forEach((t) => {
    const row = document.createElement("div"); row.className = "he-set-row";
    row.innerHTML = `<span style="flex:1"></span><button class="he-btn he-mini">Use</button><button class="he-btn he-mini">🗑</button>`;
    row.querySelector("span").textContent = t.name;
    const btns = row.querySelectorAll("button");
    btns[0].addEventListener("click", () => { settings.theme = t.id; applyTheme(root, settings.theme, settings.customThemes); refreshThemeSelects(); persistSettings(); });
    btns[1].addEventListener("click", () => {
      settings.customThemes = settings.customThemes.filter((x) => x.id !== t.id);
      if (settings.theme === t.id) settings.theme = "black";
      applyTheme(root, settings.theme, settings.customThemes); refreshThemeSelects(); renderCustomThemeList(); persistSettings();
    });
    list.appendChild(row);
  });
}
function renderColorGrid() {
  const grid = $("colorGrid"); grid.innerHTML = "";
  COLOR_FIELDS.forEach(([key, label]) => {
    const wrap = document.createElement("label"); wrap.className = "he-set-color";
    const span = document.createElement("span"); span.textContent = label;
    const inp = document.createElement("input"); inp.type = "color"; inp.value = themeDraftColors[key];
    inp.addEventListener("input", () => { themeDraftColors[key] = inp.value; });
    wrap.appendChild(span); wrap.appendChild(inp); grid.appendChild(wrap);
  });
}
function openSettings() {
  $("setName").value = settings.appName || "";
  $("setSideTabs").checked = !!settings.sideTabs;
  $("setFps").checked = !!settings.showFps;
  $("setRam").checked = !!settings.showRam;
  $("setDom").checked = !!settings.showDom;
  $("setTermPass").value = settings.terminalPassword || "admin";
  refreshThemeSelects(); renderCustomThemeList(); renderColorGrid();
  settingsModalEl.style.display = "grid";
}
function exportBackup() {
  const data = { version: 1, exported: new Date().toISOString(), settings, project, snippets };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "html-studio-backup.json"; a.click(); URL.revokeObjectURL(a.href);
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(String(reader.result || ""));
      if (!d || typeof d !== "object") throw new Error("bad");
      if (d.settings) settings = { ...loadSettings(), ...d.settings, customThemes: Array.isArray(d.settings.customThemes) ? d.settings.customThemes : [] };
      if (Array.isArray(d.snippets)) snippets = d.snippets;
      if (d.project && Array.isArray(d.project.files)) {
        project = d.project;
        activeGroupId = ROOT_GID;
      }
      persistProject(); persistSnippets(); persistSettings();
      applyTheme(root, settings.theme, settings.customThemes);
      refreshThemeSelects(); updateLogo(); renderExplorer(); syncActive();
      settingsModalEl.style.display = "none";
    } catch (backupErr) { window.alert("Invalid backup file"); }
  };
  reader.readAsText(file);
}
function initSettings() {
  $("settingsBtn").addEventListener("click", openSettings);
  $("settingsDone").addEventListener("click", () => { settingsModalEl.style.display = "none"; });
  $("setName").addEventListener("change", () => { settings.appName = $("setName").value.trim() || "HTML Studio"; updateLogo(); persistSettings(); });
  $("setSideTabs").addEventListener("change", () => { settings.sideTabs = $("setSideTabs").checked; persistSettings(); renderTabs(); renderPages(); });
  $("setTheme").addEventListener("change", (e) => { settings.theme = e.target.value; applyTheme(root, settings.theme, settings.customThemes); themeSelect.value = settings.theme; persistSettings(); });
  $("saveThemeBtn").addEventListener("click", () => {
    const name = $("themeName").value.trim(); if (!name) { window.alert("Theme name required"); return; }
    const id = uid("thm");
    settings.customThemes = [...(settings.customThemes || []), { id, name, colors: { ...themeDraftColors } }];
    settings.theme = id; $("themeName").value = "";
    applyTheme(root, settings.theme, settings.customThemes); refreshThemeSelects(); renderCustomThemeList(); persistSettings();
  });
  $("setFps").addEventListener("change", (e) => { settings.showFps = e.target.checked; persistSettings(); schedulePreview(); });
  $("setRam").addEventListener("change", (e) => { settings.showRam = e.target.checked; persistSettings(); schedulePreview(); });
  $("setDom").addEventListener("change", (e) => { settings.showDom = e.target.checked; persistSettings(); schedulePreview(); });
  $("setTermPass").addEventListener("change", (e) => { settings.terminalPassword = e.target.value.trim() || "admin"; persistSettings(); });
  $("slManual").innerHTML = MANUAL_HTML;
  $("exportBackupBtn").addEventListener("click", exportBackup);
  $("importBackupBtn").addEventListener("click", () => $("backupInput").click());
  $("backupInput").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ""; });
  $("pagesNewBtn").addEventListener("click", () => createFile(activeGrp() ? activeGrp().folderId : null));
}

// ===== Init =====
applyTheme(root, settings.theme, settings.customThemes);
refreshThemeSelects(); updateLogo();
refreshGroups();
renderTemplatesMenu(); renderExplorer(); renderConsole(); renderTerminal();
initPanelDnD(); initWinControls(); initSettings();
syncActive();
