const LS_SETTINGS = "htmlStudio.settings.v1";

export const DEFAULT_SETTINGS = { appName: "HTML Studio", sideTabs: true, theme: "black", customThemes: [], showFps: true, showRam: false, showDom: false, terminalPassword: "admin" };

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS));
    if (s && typeof s === "object") return { ...DEFAULT_SETTINGS, ...s, customThemes: Array.isArray(s.customThemes) ? s.customThemes : [] };
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s) {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch (e) {}
}

// Applies the active theme to the editor root: built-ins via data-theme,
// personal themes via inline CSS variable overrides.
export function applyTheme(rootEl, themeId, customThemes) {
  if (!rootEl) return;
  const custom = (customThemes || []).find((t) => t.id === themeId);
  if (custom) {
    rootEl.setAttribute("data-theme", "black"); // base fallback; vars below override it
    const c = custom.colors || {};
    const vars = {
      "--bg": c.bg, "--panel": c.panel, "--panel-2": c.panel2, "--border": c.border,
      "--text": c.text, "--muted": c.muted, "--accent": c.accent,
      "--accent-fg": c.bg, "--danger": c.danger || "#f28b82", "--tab-active": c.tabActive || c.panel2
    };
    Object.entries(vars).forEach(([k, v]) => { if (v) rootEl.style.setProperty(k, v); });
  } else {
    rootEl.removeAttribute("style");
    rootEl.setAttribute("data-theme", themeId);
  }
}
