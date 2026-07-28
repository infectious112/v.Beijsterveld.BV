window.Store = (() => {
  const p = window.APP_CONFIG.storagePrefix;
  const keys = {
    catalog:`${p}:catalog`,
    active:`${p}:active`,
    history:`${p}:history`,
    settings:`${p}:settings`
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };

  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const defaultSettings = {
    emails:[""],
    cc:"",
    emailSubject:"Bestellijst Van Beijsterveld B.V.",
    defaultUnit:"stuk",
    vibrate:true,
    reopenScanner:false,
    alwaysConfirm:true,
    historyRetention:"unlimited",
    lastUpdateDismissed:""
  };

  return {
    catalog: () => read(keys.catalog, {}),
    saveCatalog: value => write(keys.catalog, value),
    active: () => read(keys.active, []),
    saveActive: value => write(keys.active, value),
    history: () => read(keys.history, []),
    saveHistory: value => write(keys.history, value),
    settings: () => ({...defaultSettings, ...read(keys.settings, {})}),
    saveSettings: value => write(keys.settings, {...defaultSettings, ...value}),
    backup: () => ({
      format:"van-beijsterveld-backup",
      version:window.APP_CONFIG.version,
      exportedAt:new Date().toISOString(),
      catalog:read(keys.catalog, {}),
      active:read(keys.active, []),
      history:read(keys.history, []),
      settings:{...defaultSettings, ...read(keys.settings, {})}
    }),
    restore: data => {
      if(!data || data.format!=="van-beijsterveld-backup") throw new Error("Ongeldig back-upbestand.");
      write(keys.catalog, data.catalog || {});
      write(keys.active, data.active || []);
      write(keys.history, data.history || []);
      write(keys.settings, {...defaultSettings, ...(data.settings || {})});
    },
    clearAll: () => Object.values(keys).forEach(key => localStorage.removeItem(key))
  };
})();