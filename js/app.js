(() => {
  const app=document.getElementById("app");
  const scannerDialog=document.getElementById("scannerDialog");
  const entryDialog=document.getElementById("entryDialog");
  const sessionDialog=document.getElementById("sessionDialog");
  const updateDialog=document.getElementById("updateDialog");
  const importDialog=document.getElementById("importDialog");
  const articleDialog=document.getElementById("articleDialog");
  const video=document.getElementById("scannerVideo");
  const status=document.getElementById("scannerStatus");
  const toast=document.getElementById("toast");
  const importFile=document.getElementById("importFile");
  const restoreFile=document.getElementById("restoreFile");

  let catalog=Store.catalog();
  let active=Store.active();
  let history=Store.history();
  let settings=Store.settings();
  let screen="scan";
  let editIndex=null;
  let importRows=[];
  let importStats=null;
  let articleSearch="";
  let editingArticleBarcode="";

  const units=["stuk","doos","pak","rol","zak","krat","fles","bus","set","meter","paar"];

  function normalizeCatalog(){
    Object.keys(catalog).forEach(barcode=>{
      const item=catalog[barcode]||{};
      catalog[barcode]={
        id:item.id||`local-${barcode}`,
        barcode:String(item.barcode||barcode).trim(),
        articleNumber:item.articleNumber||item.artikelnummer||"",
        name:item.name||item.naam||"",
        unit:item.unit||item.eenheid||"stuk",
        category:item.category||item.categorie||"",
        supplier:item.supplier||item.leverancier||"",
        brand:item.brand||item.merk||"",
        location:item.location||item.opslaglocatie||"",
        remarks:item.remarks||item.opmerking||item.opmerkingen||"",
        active:item.active===undefined ? true : !["nee","false","0",false,0].includes(item.active),
        favorite:Boolean(item.favorite)
      };
    });
    Store.saveCatalog(catalog);
  }

  function applyHistoryRetention(){
    if(settings.historyRetention==="unlimited") return;
    const days=Number(settings.historyRetention);
    if(!days) return;
    const cutoff=Date.now()-(days*86400000);
    history=history.filter(item=>new Date(item.createdAt).getTime()>=cutoff);
    Store.saveHistory(history);
  }

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const plural=(u,q)=>q===1?u:({stuk:"stuks",doos:"dozen",fles:"flessen",bus:"bussen",set:"sets",pak:"pakken",zak:"zakken",krat:"kratten",paar:"paren"}[u]||u);
  const showToast=m=>{toast.textContent=m;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),2400)};
  const persist=()=>{Store.saveCatalog(catalog);Store.saveActive(active);Store.saveHistory(history);Store.saveSettings(settings)};
  const save=()=>{persist();render()};
  const footer=()=>`<footer class="app-footer">Ontwikkeld door <strong>${esc(APP_CONFIG.developer)}</strong><br>${esc(APP_CONFIG.name)} · ${esc(APP_CONFIG.version)}</footer>`;

  function download(name,content,type="application/json"){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function csvEscape(value){
    const text=String(value??"");
    return /[",;\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  }

  function catalogCsv(){
    const rows=[["barcode","artikelnummer","naam","eenheid","categorie","leverancier","merk","opslaglocatie","opmerking","actief"]];
    Object.values(catalog)
      .sort((a,b)=>a.name.localeCompare(b.name,"nl"))
      .forEach(item=>rows.push([
        item.barcode,item.articleNumber,item.name,item.unit,item.category||"",
        item.supplier||"",item.brand||"",item.location||"",item.remarks||"",
        item.active===false?"nee":"ja"
      ]));
    return rows.map(row=>row.map(csvEscape).join(";")).join("\n");
  }

  function nav(){
    return `<nav class="nav">${[
      ["scan","⌁","Scannen"],["list","☷","Lijst"],["history","◷","Recente scans"],["settings","⚙","Instellingen"]
    ].map(([id,icon,label])=>`<button data-screen="${id}" class="${screen===id?"active":""}"><span class="nav-icon">${icon}</span>${label}</button>`).join("")}</nav>`;
  }

  function listHtml(items,editable=false){
    if(!items.length)return`<div class="empty">Nog niets gescand.</div>`;
    return `<div class="list">${items.map((item,index)=>`
      <article class="card item">
        <div>
          <h3>${esc(item.name)}</h3>
          <div class="meta">${esc(item.barcode)}${item.supplier?` · ${esc(item.supplier)}`:""}${item.note?` · ${esc(item.note)}`:""}</div>
        </div>
        ${editable?`
          <div class="item-actions">
            <button class="round-action" data-minus="${index}" aria-label="Aantal verminderen">−</button>
            <div class="badge">${item.quantity} ${esc(plural(item.unit,item.quantity))}</div>
            <button class="round-action" data-plus="${index}" aria-label="Aantal verhogen">+</button>
            <button class="round-action edit-action" data-edit="${index}" aria-label="Bewerken">✎</button>
          </div>`:`<div class="badge">${item.quantity} ${esc(plural(item.unit,item.quantity))}</div>`}
      </article>`).join("")}</div>`;
  }

  function settingToggle(id,label,description,checked){
    return `<label class="toggle-row" for="${id}">
      <span><strong>${label}</strong><small>${description}</small></span>
      <input id="${id}" type="checkbox" ${checked?"checked":""}>
    </label>`;
  }


  function supplierGroupsHtml(items){
    if(!items.length)return "";
    const groups={};
    items.forEach(item=>{
      const supplier=item.supplier?.trim()||"Geen leverancier";
      (groups[supplier] ||= []).push(item);
    });
    const names=Object.keys(groups).sort((a,b)=>a.localeCompare(b,"nl"));
    return `<section class="supplier-summary">
      <div class="heading compact-heading"><h3>Per leverancier</h3><span>${names.length} leverancier${names.length===1?"":"s"}</span></div>
      <div class="supplier-groups">${names.map((name,index)=>{
        const quantity=groups[name].reduce((sum,item)=>sum+Number(item.quantity||0),0);
        return `<article class="card supplier-group">
          <div><strong>${esc(name)}</strong><span>${groups[name].length} regels · ${quantity} eenheden</span></div>
          <button class="secondary supplier-mail" data-email-supplier="${esc(name)}">E-mail</button>
        </article>`;
      }).join("")}</div>
    </section>`;
  }

  function renderSettings(){
    return `
      <div class="heading"><h2>Instellingen</h2></div>

      <section class="card settings-section">
        <div class="section-title"><strong>E-mail</strong><span>Ontvangers en standaardbericht</span></div>
        <div id="emailRows">${settings.emails.map((email,i)=>`
          <div class="email-row">
            <input type="email" value="${esc(email)}" data-email-index="${i}" placeholder="inkoop@bedrijf.nl">
            <button data-remove-email="${i}" aria-label="Verwijderen">×</button>
          </div>`).join("")}</div>
        <button class="secondary" id="addEmail">E-mailadres toevoegen</button>
        <label>CC-adres<input id="ccAddress" type="email" value="${esc(settings.cc)}" placeholder="optioneel@bedrijf.nl"></label>
        <label>Standaard onderwerp<input id="emailSubject" value="${esc(settings.emailSubject)}"></label>
      </section>

      <section class="card settings-section">
        <div class="section-title"><strong>Scannen</strong><span>Gedrag na een gescande barcode</span></div>
        <label>Standaardeenheid
          <select id="defaultUnit">${units.map(unit=>`<option ${settings.defaultUnit===unit?"selected":""}>${unit}</option>`).join("")}</select>
        </label>
        ${settingToggle("vibrateSetting","Trilling bij scan","Korte bevestiging als een barcode is gelezen.",settings.vibrate)}
        ${settingToggle("reopenScannerSetting","Scanner opnieuw openen","Na toevoegen direct doorgaan met de volgende scan.",settings.reopenScanner)}
        ${settingToggle("alwaysConfirmSetting","Aantal altijd bevestigen","Ook bekende artikelen tonen eerst het aantal-scherm.",settings.alwaysConfirm)}
      </section>

      <section class="card settings-section">
        <div class="section-title"><strong>Artikelen</strong><span>${Object.keys(catalog).length} bekende artikelen</span></div>
        <button class="primary" id="importArticles">Artikelen importeren</button>
        <div class="button-grid">
          <button class="secondary" id="downloadTemplate">Voorbeeld CSV</button>
          <button class="secondary" id="exportCatalogCsv">Export CSV</button>
        </div>
        <button class="secondary" id="manageArticles">Bekende artikelen beheren</button>
        <p class="small settings-hint">Met categorie, leverancier, merk, opslaglocatie, favorieten en actief/inactief.</p>
      </section>

      <section class="card settings-section">
        <div class="section-title"><strong>Gegevens</strong><span>Back-up en bewaartermijn</span></div>
        <label>Recente scans bewaren
          <select id="historyRetention">
            <option value="30" ${settings.historyRetention==="30"?"selected":""}>30 dagen</option>
            <option value="90" ${settings.historyRetention==="90"?"selected":""}>90 dagen</option>
            <option value="365" ${settings.historyRetention==="365"?"selected":""}>1 jaar</option>
            <option value="unlimited" ${settings.historyRetention==="unlimited"?"selected":""}>Onbeperkt</option>
          </select>
        </label>
        <div class="button-grid">
          <button class="secondary" id="exportBackup">Back-up maken</button>
          <button class="secondary" id="restoreBackup">Back-up herstellen</button>
        </div>
        <button class="link-button danger data-danger" id="clearAllData">Alle lokale gegevens wissen</button>
      </section>

      <button class="primary settings-save" id="saveSettings">Instellingen opslaan</button>

      <section class="card about-card">
        <img class="about-logo" src="./icons/icon-192.png" alt="">
        <div class="about-title">Van Beijsterveld B.V.</div>
        <div class="about-subtitle">Scannen en bestellen</div>
        <div class="about-divider"></div>
        <div class="credit">
          Versie ${esc(APP_CONFIG.version)}<br>
          Build ${esc(APP_CONFIG.build)}<br>
          Scannertechniek via ZXing
        </div>
        <button class="secondary about-update" id="checkUpdates">Controleren op updates</button>
      </section>`;
  }

  function render(){
    app.innerHTML=`<div class="app">
      <header class="topbar">
        <img class="brand-icon" src="./icons/icon-192.png" alt="">
        <div class="brand-copy"><h1>Van Beijsterveld B.V.</h1><p>Scannen en bestellen</p></div>
        <div class="version">${APP_CONFIG.version}</div>
      </header>

      <section class="screen ${screen==="scan"?"active":""}">
        <div class="screen-content">
          <div class="hero">
            <h2>Nieuwe scan</h2>
            <p>Scan een barcode en voeg het gewenste aantal toe aan de huidige lijst.</p>
            <button class="dark-button" id="openScanner">Barcode scannen</button>
          </div>
          <div class="stats">
            <div class="card stat"><strong>${active.length}</strong><span>regels in huidige lijst</span></div>
            <div class="card stat"><strong>${Object.keys(catalog).length}</strong><span>bekende artikelen</span></div>
          </div>
        </div>${footer()}
      </section>

      <section class="screen ${screen==="list"?"active":""}">
        <div class="screen-content">
          <div class="heading"><h2>Huidige lijst</h2><button class="link-button danger" id="clearActive">Leegmaken</button></div>
          ${listHtml(active,true)}
          ${supplierGroupsHtml(active)}
          <button class="primary" id="finishSession" style="margin-top:14px">Scanronde afronden</button>
          <button class="secondary" id="emailActive" style="margin-top:9px">Openen in e-mail</button>
        </div>${footer()}
      </section>

      <section class="screen ${screen==="history"?"active":""}">
        <div class="screen-content">
          <div class="heading"><h2>Recente scans</h2></div>
          ${history.length?`<div class="list">${history.map((s,i)=>`
            <button class="card history-row" data-history="${i}">
              <strong>${esc(new Date(s.createdAt).toLocaleString("nl-NL"))}</strong>
              <span>${s.items.length} regels</span>
            </button>`).join("")}</div>`:`<div class="empty">Nog geen afgeronde scanrondes.</div>`}
        </div>${footer()}
      </section>

      <section class="screen ${screen==="settings"?"active":""}">
        <div class="screen-content">${renderSettings()}</div>${footer()}
      </section>
      ${nav()}
    </div>`;
  }

  function openEntry(code,index=null){
    editIndex=index;
    const form=document.getElementById("entryForm");
    form.reset();
    const order=index===null?null:active[index];
    const known=catalog[code];
    if(index===null && known?.active===false){showToast("Dit artikel staat op inactief.");return;}

    document.getElementById("barcode").value=order?.barcode||code;
    document.getElementById("productName").value=order?.name||known?.name||"";
    document.getElementById("quantity").value=order?.quantity||1;
    document.getElementById("unit").innerHTML=units.map(unit=>`<option>${unit}</option>`).join("");
    document.getElementById("unit").value=order?.unit||known?.unit||settings.defaultUnit||"stuk";
    document.getElementById("note").value=order?.note||"";

    const nameInput=document.getElementById("productName");
    nameInput.classList.toggle("entry-name",Boolean(known));
    nameInput.readOnly=Boolean(known)&&index===null;

    document.getElementById("entryTitle").textContent=index!==null?"Bestelregel aanpassen":known?"Hoeveel wil je bestellen?":"Nieuwe barcode";
    document.getElementById("entryNotice").textContent=index!==null
      ?"Pas het aantal, de eenheid of de opmerking aan."
      :known?"Artikel herkend. Controleer het gewenste aantal.":"Vul één keer de artikelnaam en standaardeenheid in.";

    entryDialog.showModal();
    requestAnimationFrame(()=>{
      const activeElement=document.activeElement;
      if(activeElement&&["INPUT","SELECT","TEXTAREA"].includes(activeElement.tagName))activeElement.blur();
      entryDialog.scrollTop=0;
    });
  }

  function addKnownDirectly(code){
    const known=catalog[code];
    if(!known) return false;
    if(known.active===false){showToast("Dit artikel staat op inactief.");return true;}
    const existing=active.find(item=>item.barcode===code&&item.unit===known.unit&&!item.note);
    if(existing) existing.quantity+=1;
    else active.push({
      barcode:code,name:known.name,quantity:1,unit:known.unit,note:"",
      articleNumber:known.articleNumber||"",category:known.category||"",
      supplier:known.supplier||"",brand:known.brand||"",location:known.location||""
    });
    if(settings.vibrate&&navigator.vibrate)navigator.vibrate(35);
    persist();render();showToast(`${known.name} toegevoegd.`);
    if(settings.reopenScanner)setTimeout(startScanner,350);
    return true;
  }

  function handleScan(code){
    if(settings.vibrate&&navigator.vibrate)navigator.vibrate(35);
    scannerDialog.close();
    if(!settings.alwaysConfirm&&catalog[code])addKnownDirectly(code);
    else openEntry(code);
  }

  async function startScanner(){
    scannerDialog.showModal();
    status.textContent="Camera starten.";
    try{
      await Scanner.start(video,handleScan,text=>status.textContent=text);
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

  function openEmail(items,date=new Date(),supplier=""){
    if(!items.length)return showToast("De lijst is leeg.");
    const recipients=settings.emails.filter(Boolean).join(",");
    const cc=settings.cc?`&cc=${encodeURIComponent(settings.cc)}`:"";
    const subject=encodeURIComponent(`${settings.emailSubject}${supplier?` – ${supplier}`:""} ${date.toLocaleDateString("nl-NL")}`.trim());
    const body=encodeURIComponent(mailText(items,date));
    location.href=`mailto:${recipients}?subject=${subject}${cc}&body=${body}`;
  }

  function detectDelimiter(line){
    const semicolons=(line.match(/;/g)||[]).length;
    const commas=(line.match(/,/g)||[]).length;
    return semicolons>=commas?";":",";
  }

  function parseCsvLine(line,delimiter){
    const result=[];let current="";let quoted=false;
    for(let i=0;i<line.length;i++){
      const char=line[i];
      if(char==='"'){
        if(quoted&&line[i+1]==='"'){current+='"';i++;}
        else quoted=!quoted;
      }else if(char===delimiter&&!quoted){result.push(current.trim());current="";}
      else current+=char;
    }
    result.push(current.trim());
    return result;
  }

  function parseCsv(text){
    const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());
    if(lines.length<2)throw new Error("Het bestand bevat geen artikelregels.");
    const delimiter=detectDelimiter(lines[0]);
    const headers=parseCsvLine(lines[0],delimiter).map(h=>h.toLowerCase().replace(/\s/g,""));
    const aliases={
      barcode:["barcode","ean","ean13","code"],
      articleNumber:["artikelnummer","articleNumber","artikelnr","sku"].map(v=>v.toLowerCase()),
      name:["naam","artikelnaam","name","omschrijving"],
      unit:["eenheid","unit"],
      category:["categorie","category"],
      supplier:["leverancier","supplier"],
      brand:["merk","brand"],
      location:["opslaglocatie","location","locatie"],
      remarks:["opmerking","opmerkingen","remarks","remark"],
      active:["actief","active"]
    };
    const index={};
    Object.entries(aliases).forEach(([key,names])=>index[key]=headers.findIndex(header=>names.includes(header)));
    if(index.barcode<0||index.name<0||index.unit<0)throw new Error("Verplichte kolommen ontbreken: barcode, naam en eenheid.");

    return lines.slice(1).map((line,rowIndex)=>{
      const values=parseCsvLine(line,delimiter);
      return {
        row:rowIndex+2,
        barcode:String(values[index.barcode]||"").trim(),
        articleNumber:index.articleNumber>=0?String(values[index.articleNumber]||"").trim():"",
        name:String(values[index.name]||"").trim(),
        unit:String(values[index.unit]||"").trim().toLowerCase(),
        category:index.category>=0?String(values[index.category]||"").trim():"",
        supplier:index.supplier>=0?String(values[index.supplier]||"").trim():"",
        brand:index.brand>=0?String(values[index.brand]||"").trim():"",
        location:index.location>=0?String(values[index.location]||"").trim():"",
        remarks:index.remarks>=0?String(values[index.remarks]||"").trim():"",
        active:index.active>=0?!["nee","false","0"].includes(String(values[index.active]||"ja").trim().toLowerCase()):true
      };
    });
  }

  function prepareImport(rows){
    const seen=new Set();
    const valid=[];const errors=[];
    rows.forEach(item=>{
      if(!item.barcode||!item.name||!item.unit){errors.push(`Regel ${item.row}: gegevens ontbreken.`);return;}
      if(seen.has(item.barcode)){errors.push(`Regel ${item.row}: dubbele barcode in bestand.`);return;}
      seen.add(item.barcode);valid.push(item);
    });
    let added=0,updated=0,unchanged=0;
    valid.forEach(item=>{
      const existing=catalog[item.barcode];
      if(!existing)added++;
      else if(
        existing.name!==item.name||existing.unit!==item.unit||existing.articleNumber!==item.articleNumber||
        (existing.category||"")!==item.category||(existing.supplier||"")!==item.supplier||
        (existing.brand||"")!==item.brand||(existing.location||"")!==item.location||
        (existing.remarks||"")!==item.remarks||existing.active!==item.active
      )updated++;
      else unchanged++;
    });
    return {valid,errors,added,updated,unchanged};
  }

  function showImportPreview(result){
    importRows=result.valid;importStats=result;
    document.getElementById("importSummary").innerHTML=`
      <div class="import-stats">
        <div><strong>${result.added}</strong><span>nieuw</span></div>
        <div><strong>${result.updated}</strong><span>bijwerken</span></div>
        <div><strong>${result.unchanged}</strong><span>ongewijzigd</span></div>
      </div>
      ${result.errors.length?`<div class="import-errors"><strong>${result.errors.length} regels overgeslagen</strong>${result.errors.slice(0,6).map(error=>`<span>${esc(error)}</span>`).join("")}</div>`:""}
      <p class="small">Bestaande artikelen met dezelfde barcode worden bijgewerkt. Huidige lijsten en scanrondes blijven behouden.</p>`;
    document.getElementById("confirmImport").disabled=!result.valid.length;
    importDialog.showModal();
  }

  function catalogOptions(field){
    return [...new Set(Object.values(catalog).map(item=>String(item[field]||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"nl"));
  }

  function articleListHtml(){
    const query=articleSearch.trim().toLowerCase();
    const category=document.getElementById("articleCategoryFilter")?.value||"";
    const supplier=document.getElementById("articleSupplierFilter")?.value||"";
    const statusFilter=document.getElementById("articleStatusFilter")?.value||"all";
    const favoriteOnly=document.getElementById("articleFavoriteFilter")?.checked||false;
    const items=Object.values(catalog)
      .filter(item=>!query||[
        item.barcode,item.articleNumber,item.name,item.unit,item.category,item.supplier,item.brand,item.location
      ].some(value=>String(value||"").toLowerCase().includes(query)))
      .filter(item=>!category||item.category===category)
      .filter(item=>!supplier||item.supplier===supplier)
      .filter(item=>statusFilter==="all"||(statusFilter==="active"?item.active!==false:item.active===false))
      .filter(item=>!favoriteOnly||item.favorite)
      .sort((a,b)=>(Number(Boolean(b.favorite))-Number(Boolean(a.favorite)))||a.name.localeCompare(b.name,"nl"));
    if(!items.length)return`<div class="empty">Geen artikelen gevonden.</div>`;
    return `<div class="article-list">${items.map(item=>`
      <article class="article-row ${item.active===false?"inactive":""}">
        <button class="favorite-button ${item.favorite?"active":""}" data-favorite-article="${esc(item.barcode)}" aria-label="Favoriet">${item.favorite?"★":"☆"}</button>
        <button class="article-main" data-open-article="${esc(item.barcode)}">
          <strong>${esc(item.name)}${item.active===false?' <em>Inactief</em>':""}</strong>
          <span>${esc(item.articleNumber||"Geen artikelnummer")} · ${esc(item.unit)}${item.category?` · ${esc(item.category)}`:""}</span>
          <small>${esc(item.supplier||"Geen leverancier")}${item.brand?` · ${esc(item.brand)}`:""} · ${esc(item.barcode)}</small>
        </button>
        <button class="article-more" data-duplicate-article="${esc(item.barcode)}" aria-label="Dupliceren">⧉</button>
        <button class="article-delete" data-delete-article="${esc(item.barcode)}" aria-label="Artikel verwijderen">×</button>
      </article>`).join("")}</div>`;
  }

  function refreshArticleManager(){
    const categoryFilter=document.getElementById("articleCategoryFilter");
    const supplierFilter=document.getElementById("articleSupplierFilter");
    if(categoryFilter){
      const current=categoryFilter.value;
      categoryFilter.innerHTML=`<option value="">Alle categorieën</option>${catalogOptions("category").map(value=>`<option>${esc(value)}</option>`).join("")}`;
      categoryFilter.value=current;
    }
    if(supplierFilter){
      const current=supplierFilter.value;
      supplierFilter.innerHTML=`<option value="">Alle leveranciers</option>${catalogOptions("supplier").map(value=>`<option>${esc(value)}</option>`).join("")}`;
      supplierFilter.value=current;
    }
    const categorySuggestions=document.getElementById("categorySuggestions");
    const supplierSuggestions=document.getElementById("supplierSuggestions");
    if(categorySuggestions)categorySuggestions.innerHTML=catalogOptions("category").map(value=>`<option value="${esc(value)}"></option>`).join("");
    if(supplierSuggestions)supplierSuggestions.innerHTML=catalogOptions("supplier").map(value=>`<option value="${esc(value)}"></option>`).join("");
    document.getElementById("articleList").innerHTML=articleListHtml();
  }

  function openArticleManager(){
    document.getElementById("articleSearch").value=articleSearch;
    document.getElementById("articleEdit").hidden=true;
    refreshArticleManager();
    articleDialog.showModal();
  }

  function fillArticleForm(item={}, title="Nieuw artikel"){
    editingArticleBarcode=item.barcode||"";
    document.getElementById("articleEditTitle").textContent=title;
    document.getElementById("articleBarcode").value=item.barcode||"";
    document.getElementById("articleNumber").value=item.articleNumber||"";
    document.getElementById("articleName").value=item.name||"";
    document.getElementById("articleUnit").innerHTML=units.map(unit=>`<option>${unit}</option>`).join("");
    if(item.unit&&!units.includes(item.unit))document.getElementById("articleUnit").innerHTML+=`<option>${esc(item.unit)}</option>`;
    document.getElementById("articleUnit").value=item.unit||settings.defaultUnit||"stuk";
    document.getElementById("articleCategory").value=item.category||"";
    document.getElementById("articleSupplier").value=item.supplier||"";
    document.getElementById("articleBrand").value=item.brand||"";
    document.getElementById("articleLocation").value=item.location||"";
    document.getElementById("articleRemarks").value=item.remarks||"";
    document.getElementById("articleActive").checked=item.active!==false;
    document.getElementById("articleFavorite").checked=Boolean(item.favorite);
    document.getElementById("articleEdit").hidden=false;
    document.getElementById("articleEdit").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function openArticleEdit(barcode){
    const item=catalog[barcode];
    if(item)fillArticleForm(item,"Artikel bewerken");
  }

  function collectSettings(){
    document.querySelectorAll("[data-email-index]").forEach(input=>{
      settings.emails[Number(input.dataset.emailIndex)]=input.value.trim();
    });
    settings.emails=settings.emails.filter(Boolean);
    if(!settings.emails.length)settings.emails=[""];
    settings.cc=document.getElementById("ccAddress").value.trim();
    settings.emailSubject=document.getElementById("emailSubject").value.trim()||"Bestellijst Van Beijsterveld B.V.";
    settings.defaultUnit=document.getElementById("defaultUnit").value;
    settings.vibrate=document.getElementById("vibrateSetting").checked;
    settings.reopenScanner=document.getElementById("reopenScannerSetting").checked;
    settings.alwaysConfirm=document.getElementById("alwaysConfirmSetting").checked;
    settings.historyRetention=document.getElementById("historyRetention").value;
  }

  app.addEventListener("click",e=>{
    const navButton=e.target.closest("[data-screen]");
    if(navButton){screen=navButton.dataset.screen;render();return;}
    if(e.target.id==="openScanner")startScanner();

    if(e.target.dataset.plus!==undefined){active[Number(e.target.dataset.plus)].quantity+=1;save();}
    if(e.target.dataset.minus!==undefined){
      const index=Number(e.target.dataset.minus);active[index].quantity-=1;
      if(active[index].quantity<=0)active.splice(index,1);save();
    }
    if(e.target.dataset.edit!==undefined){const index=Number(e.target.dataset.edit);openEntry(active[index].barcode,index);}
    if(e.target.id==="clearActive"&&active.length&&confirm("Huidige lijst leegmaken?")){active=[];save();}
    if(e.target.id==="emailActive")openEmail(active);
    if(e.target.dataset.emailSupplier!==undefined){
      const supplier=e.target.dataset.emailSupplier;
      const items=active.filter(item=>(item.supplier?.trim()||"Geen leverancier")===supplier);
      openEmail(items,new Date(),supplier);
    }

    if(e.target.id==="finishSession"){
      if(!active.length)return showToast("De lijst is leeg.");
      history.unshift({id:crypto.randomUUID?.()||String(Date.now()),createdAt:new Date().toISOString(),items:JSON.parse(JSON.stringify(active))});
      active=[];applyHistoryRetention();save();screen="history";render();showToast("Scanronde opgeslagen.");
    }

    if(e.target.dataset.history!==undefined){
      const session=history[Number(e.target.dataset.history)];
      document.getElementById("sessionTitle").textContent=new Date(session.createdAt).toLocaleString("nl-NL");
      document.getElementById("sessionDetail").innerHTML=`${listHtml(session.items)}<button class="primary" id="emailHistory" style="margin-top:13px">Opnieuw openen in e-mail</button>`;
      document.getElementById("emailHistory").onclick=()=>openEmail(session.items,new Date(session.createdAt));
      sessionDialog.showModal();
    }

    if(e.target.id==="addEmail"){collectSettings();settings.emails.push("");persist();render();}
    if(e.target.dataset.removeEmail!==undefined){
      collectSettings();settings.emails.splice(Number(e.target.dataset.removeEmail),1);
      if(!settings.emails.length)settings.emails=[""];persist();render();
    }
    if(e.target.id==="saveSettings"){collectSettings();applyHistoryRetention();save();showToast("Instellingen opgeslagen.");}

    if(e.target.id==="downloadTemplate"){
      download("voorbeeld-artikelen.csv","barcode;artikelnummer;naam;eenheid;categorie;leverancier;merk;opslaglocatie;opmerking;actief\n8712345678901;100245;Tie-wrap zwart 300 mm;zak;Bevestigingsmateriaal;Würth;Würth;A01-B02;UV-bestendig;ja\n8712345678918;100246;Tape 50 mm;rol;Tape en lijm;Technische Unie;3M;B03-C01;;ja\n","text/csv;charset=utf-8");
    }
    if(e.target.id==="exportCatalogCsv"){
      download(`artikelen-${new Date().toISOString().slice(0,10)}.csv`,catalogCsv(),"text/csv;charset=utf-8");
    }
    if(e.target.id==="importArticles")importFile.click();
    if(e.target.id==="manageArticles"){articleSearch="";document.getElementById("articleEdit").hidden=true;openArticleManager();}

    if(e.target.id==="exportBackup"){
      download(`van-beijsterveld-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(Store.backup(),null,2));
    }
    if(e.target.id==="restoreBackup")restoreFile.click();

    if(e.target.id==="clearAllData"&&confirm("Alle artikelen, lijsten, geschiedenis en instellingen wissen? Dit kan niet ongedaan worden gemaakt.")){
      Store.clearAll();location.reload();
    }

    if(e.target.id==="checkUpdates"){
      if(navigator.serviceWorker?.controller)navigator.serviceWorker.controller.postMessage({type:"CHECK_UPDATE"});
      showToast("Controleren op updates.");
      setTimeout(()=>location.reload(),650);
    }
  });

  document.querySelector("[data-close-scanner]").onclick=()=>{Scanner.stop();scannerDialog.close()};
  document.querySelector("[data-close-entry]").onclick=()=>entryDialog.close();
  document.querySelector("[data-close-session]").onclick=()=>sessionDialog.close();
  document.querySelector("[data-close-import]").onclick=()=>importDialog.close();
  document.querySelector("[data-close-articles]").onclick=()=>articleDialog.close();

  document.getElementById("manualBarcode").onclick=()=>{
    Scanner.stop();scannerDialog.close();
    const code=prompt("Voer de barcode in.");
    if(code?.trim())handleScan(code.trim());
  };

  document.getElementById("entryForm").onsubmit=e=>{
    e.preventDefault();
    const item={
      barcode:document.getElementById("barcode").value.trim(),
      name:document.getElementById("productName").value.trim(),
      quantity:Math.max(1,Number(document.getElementById("quantity").value)||1),
      unit:document.getElementById("unit").value,
      note:document.getElementById("note").value.trim(),
      articleNumber:catalog[document.getElementById("barcode").value.trim()]?.articleNumber||"",
      category:catalog[document.getElementById("barcode").value.trim()]?.category||"",
      supplier:catalog[document.getElementById("barcode").value.trim()]?.supplier||"",
      brand:catalog[document.getElementById("barcode").value.trim()]?.brand||"",
      location:catalog[document.getElementById("barcode").value.trim()]?.location||""
    };
    catalog[item.barcode]={
      id:catalog[item.barcode]?.id||`local-${item.barcode}`,
      barcode:item.barcode,
      articleNumber:catalog[item.barcode]?.articleNumber||"",
      name:item.name,unit:item.unit,supplier:catalog[item.barcode]?.supplier||"",
      favorite:Boolean(catalog[item.barcode]?.favorite)
    };
    if(editIndex!==null){active[editIndex]=item;showToast("Bestelregel aangepast.");}
    else{
      const existing=active.find(x=>x.barcode===item.barcode&&x.unit===item.unit&&x.note===item.note);
      if(existing)existing.quantity+=item.quantity;else active.push(item);
      showToast("Artikel toegevoegd.");
    }
    editIndex=null;entryDialog.close();persist();render();
    if(settings.reopenScanner)setTimeout(startScanner,350);
  };

  importFile.onchange=async()=>{
    const file=importFile.files?.[0];importFile.value="";
    if(!file)return;
    try{
      const text=await file.text();
      const rows=file.name.toLowerCase().endsWith(".json")
        ?JSON.parse(text).map((item,index)=>({
          row:index+1,barcode:String(item.barcode||""),articleNumber:String(item.articleNumber||item.artikelnummer||""),
          name:String(item.name||item.naam||""),unit:String(item.unit||item.eenheid||""),
          category:String(item.category||item.categorie||""),supplier:String(item.supplier||item.leverancier||""),
          brand:String(item.brand||item.merk||""),location:String(item.location||item.opslaglocatie||""),
          remarks:String(item.remarks||item.opmerking||item.opmerkingen||""),
          active:item.active===undefined?true:!["nee","false","0",false,0].includes(item.active)
        }))
        :parseCsv(text);
      showImportPreview(prepareImport(rows));
    }catch(error){showToast(error.message||"Importeren is niet gelukt.");}
  };

  document.getElementById("confirmImport").onclick=()=>{
    importRows.forEach(item=>{
      catalog[item.barcode]={
        id:catalog[item.barcode]?.id||`import-${item.barcode}`,
        barcode:item.barcode,articleNumber:item.articleNumber,name:item.name,unit:item.unit,
        category:item.category||"",supplier:item.supplier||"",brand:item.brand||"",
        location:item.location||"",remarks:item.remarks||"",active:item.active!==false,
        favorite:Boolean(catalog[item.barcode]?.favorite)
      };
    });
    persist();importDialog.close();render();
    showToast(`${importRows.length} artikelen geïmporteerd.`);
  };

  restoreFile.onchange=async()=>{
    const file=restoreFile.files?.[0];restoreFile.value="";
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!confirm("De huidige lokale gegevens vervangen door deze back-up?"))return;
      Store.restore(data);location.reload();
    }catch(error){showToast(error.message||"Back-up herstellen is niet gelukt.");}
  };

  document.getElementById("articleSearch").oninput=e=>{
    articleSearch=e.target.value;
    refreshArticleManager();
  };
  ["articleCategoryFilter","articleSupplierFilter","articleStatusFilter","articleFavoriteFilter"].forEach(id=>{
    document.getElementById(id).onchange=refreshArticleManager;
  });
  document.getElementById("newArticle").onclick=()=>fillArticleForm({active:true},"Nieuw artikel");

  document.getElementById("articleList").onclick=e=>{
    const open=e.target.closest("[data-open-article]");
    const remove=e.target.closest("[data-delete-article]");
    const duplicate=e.target.closest("[data-duplicate-article]");
    const favorite=e.target.closest("[data-favorite-article]");
    if(open)openArticleEdit(open.dataset.openArticle);
    if(favorite){
      const barcode=favorite.dataset.favoriteArticle;
      catalog[barcode].favorite=!catalog[barcode].favorite;
      persist();refreshArticleManager();render();
    }
    if(duplicate){
      const source=catalog[duplicate.dataset.duplicateArticle];
      if(source)fillArticleForm({...source,barcode:"",articleNumber:"",name:`${source.name} kopie`},"Artikel dupliceren");
    }
    if(remove&&confirm("Dit bekende artikel verwijderen?")){
      delete catalog[remove.dataset.deleteArticle];persist();
      document.getElementById("articleEdit").hidden=true;
      refreshArticleManager();render();showToast("Artikel verwijderd.");
    }
  };

  document.getElementById("articleEditForm").onsubmit=e=>{
    e.preventDefault();
    const oldBarcode=editingArticleBarcode;
    const barcode=document.getElementById("articleBarcode").value.trim();
    if(!barcode)return showToast("Vul een barcode in.");
    if(barcode!==oldBarcode&&catalog[barcode])return showToast("Deze barcode bestaat al.");
    const updated={
      id:catalog[oldBarcode]?.id||`local-${barcode}`,barcode,
      articleNumber:document.getElementById("articleNumber").value.trim(),
      name:document.getElementById("articleName").value.trim(),
      unit:document.getElementById("articleUnit").value,
      category:document.getElementById("articleCategory").value.trim(),
      supplier:document.getElementById("articleSupplier").value.trim(),
      brand:document.getElementById("articleBrand").value.trim(),
      location:document.getElementById("articleLocation").value.trim(),
      remarks:document.getElementById("articleRemarks").value.trim(),
      active:document.getElementById("articleActive").checked,
      favorite:document.getElementById("articleFavorite").checked
    };
    if(oldBarcode&&barcode!==oldBarcode)delete catalog[oldBarcode];
    catalog[barcode]=updated;
    if(oldBarcode){
      active=active.map(item=>item.barcode===oldBarcode?{
        ...item,barcode,name:updated.name,unit:updated.unit,articleNumber:updated.articleNumber,
        category:updated.category,supplier:updated.supplier,brand:updated.brand,location:updated.location
      }:item);
    }
    persist();document.getElementById("articleEdit").hidden=true;
    refreshArticleManager();render();
    showToast("Artikel opgeslagen.");
  };

  document.getElementById("cancelArticleEdit").onclick=()=>document.getElementById("articleEdit").hidden=true;
  document.getElementById("updateLater").onclick=()=>updateDialog.close();
  document.getElementById("updateNow").onclick=()=>Updates.apply();

  normalizeCatalog();applyHistoryRetention();
  Updates.init(()=>{if(!updateDialog.open)updateDialog.showModal()}).catch(()=>{});
  render();
})();