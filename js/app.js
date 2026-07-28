(() => {
  const app=document.getElementById("app");
  const scannerDialog=document.getElementById("scannerDialog");
  const entryDialog=document.getElementById("entryDialog");
  const sessionDialog=document.getElementById("sessionDialog");
  const updateDialog=document.getElementById("updateDialog");
  const video=document.getElementById("scannerVideo");
  const status=document.getElementById("scannerStatus");
  const toast=document.getElementById("toast");

  let catalog=Store.catalog();
  let active=Store.active();
  let history=Store.history();
  let settings=Store.settings();
  let screen="scan";
  let editIndex=null;

  function normalizeCatalog(){
    Object.keys(catalog).forEach(barcode=>{
      const item=catalog[barcode]||{};
      catalog[barcode]={
        id:item.id||`local-${barcode}`,
        barcode,
        articleNumber:item.articleNumber||"",
        name:item.name||item.naam||"",
        unit:item.unit||item.eenheid||"stuk",
        supplier:item.supplier||"",
        favorite:Boolean(item.favorite)
      };
    });
    Store.saveCatalog(catalog);
  }

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const plural=(u,q)=>q===1?u:({stuk:"stuks",doos:"dozen",fles:"flessen",bus:"bussen",set:"sets"}[u]||`${u}s`);
  const showToast=m=>{toast.textContent=m;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),2200)};
  const save=()=>{Store.saveCatalog(catalog);Store.saveActive(active);Store.saveHistory(history);Store.saveSettings(settings);render()};
  const footer=()=>`<footer class="app-footer">Ontwikkeld door <strong>${esc(APP_CONFIG.developer)}</strong><br>${esc(APP_CONFIG.name)} · ${esc(APP_CONFIG.version)}</footer>`;

  function nav(){
    return `<nav class="nav">${[
      ["scan","⌁","Scannen"],["list","☷","Lijst"],["history","◷","Recente scans"],["settings","⚙","Instellingen"]
    ].map(([id,icon,label])=>`<button data-screen="${id}" class="${screen===id?"active":""}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}</nav>`;
  }

  function listHtml(items, editable=false){
    if(!items.length)return`<div class="empty">Nog niets gescand.</div>`;
    return `<div class="list">${items.map((item,index)=>`
      <article class="card item">
        <div>
          <h3>${esc(item.name)}</h3>
          <div class="meta">${esc(item.barcode)}${item.note?` · ${esc(item.note)}`:""}</div>
        </div>
        ${editable?`
          <div class="item-actions">
            <button class="round-action" data-minus="${index}" aria-label="Aantal verminderen">−</button>
            <div class="badge">${item.quantity} ${esc(plural(item.unit,item.quantity))}</div>
            <button class="round-action" data-plus="${index}" aria-label="Aantal verhogen">+</button>
            <button class="round-action edit-action" data-edit="${index}" aria-label="Bewerken">✎</button>
          </div>`:
          `<div class="badge">${item.quantity} ${esc(plural(item.unit,item.quantity))}</div>`}
      </article>`).join("")}</div>`;
  }

  function render(){
    app.innerHTML=`<div class="app">
      <header class="topbar">
        <img class="brand-icon" src="./icons/icon-192.png" alt="">
        <div class="brand-copy"><h1>Van Beijsterveld B.V.</h1><p>Scannen en bestellen</p></div>
        <div class="version">${APP_CONFIG.version}</div>
      </header>

      <section class="screen ${screen==="scan"?"active":""}">
        <div class="hero">
          <h2>Nieuwe scan</h2>
          <p>Scan een barcode en voeg het gewenste aantal toe aan de huidige lijst.</p>
          <button class="dark-button" id="openScanner">Barcode scannen</button>
        </div>
        <div class="stats">
          <div class="card stat"><strong>${active.length}</strong><span>regels in huidige lijst</span></div>
          <div class="card stat"><strong>${Object.keys(catalog).length}</strong><span>bekende artikelen</span></div>
        </div>
        ${footer()}
      </section>

      <section class="screen ${screen==="list"?"active":""}">
        <div class="heading"><h2>Huidige lijst</h2><button class="link-button danger" id="clearActive">Leegmaken</button></div>
        ${listHtml(active,true)}
        <button class="primary" id="finishSession" style="margin-top:14px">Scanronde afronden</button>
        <button class="secondary" id="emailActive" style="margin-top:9px">Openen in e-mail</button>
        ${footer()}
      </section>

      <section class="screen ${screen==="history"?"active":""}">
        <div class="heading"><h2>Recente scans</h2></div>
        ${history.length?`<div class="list">${history.map((s,i)=>`
          <button class="card history-row" data-history="${i}">
            <strong>${esc(new Date(s.createdAt).toLocaleString("nl-NL"))}</strong>
            <span>${s.items.length} regels</span>
          </button>`).join("")}</div>`:`<div class="empty">Nog geen afgeronde scanrondes.</div>`}
        ${footer()}
      </section>

      <section class="screen ${screen==="settings"?"active":""}">
        <div class="heading"><h2>Instellingen</h2></div>
        <div class="card settings-group">
          <div><strong>E-mailadressen</strong><div class="small">Deze worden ingevuld wanneer je een lijst in jouw mailapp opent.</div></div>
          <div id="emailRows">${settings.emails.map((email,i)=>`
            <div class="email-row">
              <input type="email" value="${esc(email)}" data-email-index="${i}" placeholder="inkoop@bedrijf.nl">
              <button data-remove-email="${i}">×</button>
            </div>`).join("")}</div>
          <button class="secondary" id="addEmail">E-mailadres toevoegen</button>
          <button class="primary" id="saveSettings">Instellingen opslaan</button>
        </div>

        <div class="card about-card">
          <img class="about-logo" src="./icons/icon-192.png" alt="">
          <div class="about-title">Van Beijsterveld B.V.</div>
          <div class="about-subtitle">Scannen en bestellen</div>
          <div class="about-divider"></div>
          <div class="credit">
            Ontwikkeld door <strong>${esc(APP_CONFIG.developer)}</strong><br>
            Versie ${esc(APP_CONFIG.version)}<br>
            Build ${esc(APP_CONFIG.build)}<br>
            Scannertechniek via ZXing
          </div>
        </div>
      </section>
      ${nav()}
    </div>`;
  }

  function openEntry(code,index=null){
    editIndex=index;
    const form=document.getElementById("entryForm");
    form.reset();
    document.getElementById("quantity").value=1;

    const order=index===null?null:active[index];
    const known=catalog[code];

    document.getElementById("barcode").value=order?.barcode||code;
    document.getElementById("productName").value=order?.name||known?.name||"";
    document.getElementById("quantity").value=order?.quantity||1;
    document.getElementById("unit").value=order?.unit||known?.unit||"stuk";
    document.getElementById("note").value=order?.note||"";

    const nameInput=document.getElementById("productName");
    nameInput.classList.toggle("entry-name",Boolean(known));
    nameInput.readOnly=Boolean(known)&&index===null;

    document.getElementById("entryTitle").textContent=index!==null?"Bestelregel aanpassen":known?"Hoeveel wil je bestellen?":"Nieuwe barcode";
    document.getElementById("entryNotice").textContent=index!==null
      ?"Pas het aantal, de eenheid of de opmerking aan."
      :known
        ?"Artikel herkend. Je hoeft alleen het aantal te controleren."
        :"Vul één keer een artikelnaam en standaardeenheid in.";

    entryDialog.showModal();
    setTimeout(()=>known?document.getElementById("quantity").focus():nameInput.focus(),100);
  }

  async function startScanner(){
    scannerDialog.showModal();
    status.textContent="Camera starten.";
    try{
      await Scanner.start(video,code=>{scannerDialog.close();openEntry(code)},text=>status.textContent=text);
    }catch(error){
      status.textContent=error.message==="library"
        ?"De scanner kon niet worden geladen. Controleer internet en ververs de app."
        :"De camera kon niet worden geopend. Controleer de cameratoestemming.";
    }
  }

  function mailText(items,date=new Date()){
    const lines=items.map(item=>`${item.quantity} ${plural(item.unit,item.quantity)} · ${item.name}${item.note?`\n   ${item.note}`:""}`);
    return `BESTELLIJST\n\nDatum: ${date.toLocaleDateString("nl-NL")}\nTijd: ${date.toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}\n\n${lines.join("\n\n")}\n\nVerzonden vanuit Van Beijsterveld B.V.`;
  }

  function openEmail(items,date=new Date()){
    if(!items.length)return showToast("De lijst is leeg.");
    const recipients=settings.emails.filter(Boolean).join(",");
    const subject=encodeURIComponent(`Bestellijst Van Beijsterveld B.V. ${date.toLocaleDateString("nl-NL")}`);
    const body=encodeURIComponent(mailText(items,date));
    location.href=`mailto:${recipients}?subject=${subject}&body=${body}`;
  }

  app.addEventListener("click",e=>{
    const navButton=e.target.closest("[data-screen]");
    if(navButton){screen=navButton.dataset.screen;render();return;}

    if(e.target.id==="openScanner")startScanner();

    if(e.target.dataset.plus!==undefined){
      active[Number(e.target.dataset.plus)].quantity+=1;
      save();
    }

    if(e.target.dataset.minus!==undefined){
      const index=Number(e.target.dataset.minus);
      active[index].quantity-=1;
      if(active[index].quantity<=0)active.splice(index,1);
      save();
    }

    if(e.target.dataset.edit!==undefined){
      const index=Number(e.target.dataset.edit);
      openEntry(active[index].barcode,index);
    }

    if(e.target.id==="clearActive"&&active.length&&confirm("Huidige lijst leegmaken?")){
      active=[];save();
    }

    if(e.target.id==="emailActive")openEmail(active);

    if(e.target.id==="finishSession"){
      if(!active.length)return showToast("De lijst is leeg.");
      history.unshift({
        id:crypto.randomUUID?.()||String(Date.now()),
        createdAt:new Date().toISOString(),
        items:JSON.parse(JSON.stringify(active))
      });
      active=[];
      save();
      screen="history";
      render();
      showToast("Scanronde opgeslagen.");
    }

    if(e.target.dataset.history!==undefined){
      const session=history[Number(e.target.dataset.history)];
      document.getElementById("sessionTitle").textContent=new Date(session.createdAt).toLocaleString("nl-NL");
      document.getElementById("sessionDetail").innerHTML=`
        ${listHtml(session.items)}
        <button class="primary" id="emailHistory" style="margin-top:13px">Opnieuw openen in e-mail</button>`;
      document.getElementById("emailHistory").onclick=()=>openEmail(session.items,new Date(session.createdAt));
      sessionDialog.showModal();
    }

    if(e.target.id==="addEmail"){
      settings.emails.push("");
      save();screen="settings";render();
    }

    if(e.target.dataset.removeEmail!==undefined){
      settings.emails.splice(Number(e.target.dataset.removeEmail),1);
      if(!settings.emails.length)settings.emails=[""];
      save();screen="settings";render();
    }

    if(e.target.id==="saveSettings"){
      document.querySelectorAll("[data-email-index]").forEach(input=>{
        settings.emails[Number(input.dataset.emailIndex)]=input.value.trim();
      });
      settings.emails=settings.emails.filter(Boolean);
      if(!settings.emails.length)settings.emails=[""];
      save();screen="settings";render();
      showToast("Instellingen opgeslagen.");
    }
  });

  document.querySelector("[data-close-scanner]").onclick=()=>{Scanner.stop();scannerDialog.close()};
  document.querySelector("[data-close-entry]").onclick=()=>entryDialog.close();
  document.querySelector("[data-close-session]").onclick=()=>sessionDialog.close();

  document.getElementById("manualBarcode").onclick=()=>{
    Scanner.stop();
    scannerDialog.close();
    const code=prompt("Voer de barcode in.");
    if(code?.trim())openEntry(code.trim());
  };

  document.getElementById("entryForm").onsubmit=e=>{
    e.preventDefault();

    const item={
      barcode:document.getElementById("barcode").value.trim(),
      name:document.getElementById("productName").value.trim(),
      quantity:Math.max(1,Number(document.getElementById("quantity").value)||1),
      unit:document.getElementById("unit").value,
      note:document.getElementById("note").value.trim()
    };

    catalog[item.barcode]={
      id:catalog[item.barcode]?.id||`local-${item.barcode}`,
      barcode:item.barcode,
      articleNumber:catalog[item.barcode]?.articleNumber||"",
      name:item.name,
      unit:item.unit,
      supplier:catalog[item.barcode]?.supplier||"",
      favorite:Boolean(catalog[item.barcode]?.favorite)
    };

    if(editIndex!==null){
      active[editIndex]=item;
      showToast("Bestelregel aangepast.");
    }else{
      const existing=active.find(x=>x.barcode===item.barcode&&x.unit===item.unit&&x.note===item.note);
      if(existing)existing.quantity+=item.quantity;
      else active.push(item);
      showToast("Artikel toegevoegd.");
    }

    editIndex=null;
    entryDialog.close();
    save();
  };

  document.getElementById("updateLater").onclick=()=>updateDialog.close();
  document.getElementById("updateNow").onclick=()=>Updates.apply();

  normalizeCatalog();
  Updates.init(()=>{if(!updateDialog.open)updateDialog.showModal()}).catch(()=>{});
  render();
})();