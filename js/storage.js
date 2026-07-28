window.Store = (() => {
  const p = window.APP_CONFIG.storagePrefix;
  const keys = { catalog:`${p}:catalog`, active:`${p}:active`, history:`${p}:history`, settings:`${p}:settings` };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  return {
    catalog: () => read(keys.catalog, {}),
    saveCatalog: value => write(keys.catalog, value),
    active: () => read(keys.active, []),
    saveActive: value => write(keys.active, value),
    history: () => read(keys.history, []),
    saveHistory: value => write(keys.history, value),
    settings: () => read(keys.settings, { emails:[""], lastUpdateDismissed:"" }),
    saveSettings: value => write(keys.settings, value)
  };
})();