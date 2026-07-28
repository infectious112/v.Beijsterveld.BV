window.Scanner = (() => {
  let controls = null, locked = false, loadingPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureLibrary() {
    if (window.ZXingBrowser) return true;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      for (const src of window.APP_CONFIG.scannerSources) {
        try {
          await loadScript(src);
          if (window.ZXingBrowser) return true;
        } catch {}
      }
      return false;
    })();
    return loadingPromise;
  }

  async function start(video, onResult, onStatus) {
    locked = false;
    onStatus("Scanner laden.");
    const ready = await ensureLibrary();
    if (!ready) throw new Error("library");

    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    controls = await reader.decodeFromConstraints(
      { video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1920 }, height:{ ideal:1080 } }, audio:false },
      video,
      (result, error, localControls) => {
        if (!result || locked) return;
        locked = true;
        const code = result.getText().trim();
        onStatus(`Barcode gevonden, ${code}`);
        if (navigator.vibrate) navigator.vibrate(80);
        setTimeout(() => {
          try { localControls.stop(); } catch {}
          controls = null;
          onResult(code);
        }, 180);
      }
    );
    onStatus("Houd de barcode rustig binnen het kader.");
  }

  function stop() {
    locked = true;
    try { controls?.stop(); } catch {}
    controls = null;
  }

  return { start, stop };
})();