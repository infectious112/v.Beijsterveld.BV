window.Updates = (() => {
  let waitingWorker = null;
  async function init(onAvailable) {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.register("./service-worker.js");

    const notify = worker => {
      waitingWorker = worker;
      onAvailable();
    };

    if (registration.waiting) notify(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) notify(worker);
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    window.addEventListener("focus", () => registration.update());
    setInterval(() => registration.update(), 60 * 60 * 1000);
  }

  function apply() { waitingWorker?.postMessage({ type:"SKIP_WAITING" }); }
  return { init, apply };
})();