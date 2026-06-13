const groups = {
  A: [["México", "MEX"], ["África do Sul", "RSA"], ["Coreia do Sul", "KOR"], ["Rep. Tcheca", "CZE"]],
  B: [["Canadá", "CAN"], ["Bósnia", "BIH"], ["Catar", "QAT"], ["Suíça", "SUI"]],
  C: [["Brasil", "BRA"], ["Marrocos", "MAR"], ["Haiti", "HAI"], ["Escócia", "SCO"]],
  D: [["Estados Unidos", "USA"], ["Paraguai", "PAR"], ["Austrália", "AUS"], ["Turquia", "TUR"]],
  E: [["Alemanha", "GER"], ["Curaçao", "CUW"], ["Costa do Marfim", "CIV"], ["Equador", "ECU"]],
  F: [["Holanda", "NED"], ["Japão", "JPN"], ["Suécia", "SWE"], ["Tunísia", "TUN"]],
  G: [["Bélgica", "BEL"], ["Egito", "EGY"], ["Irã", "IRN"], ["Nova Zelândia", "NZL"]],
  H: [["Espanha", "ESP"], ["Cabo Verde", "CPV"], ["Arábia Saudita", "KSA"], ["Uruguai", "URU"]],
  I: [["França", "FRA"], ["Senegal", "SEN"], ["Iraque", "IRQ"], ["Noruega", "NOR"]],
  J: [["Argentina", "ARG"], ["Argélia", "ALG"], ["Áustria", "AUT"], ["Jordânia", "JOR"]],
  K: [["Portugal", "POR"], ["Congo", "COD"], ["Uzbequistão", "UZB"], ["Colômbia", "COL"]],
  L: [["Inglaterra", "ENG"], ["Croácia", "CRO"], ["Gana", "GHA"], ["Panamá", "PAN"]]
};

const sections = [
  { name: "Abertura & História", code: "FWC", group: "Extra", stickers: ["00", ...Array.from({ length: 19 }, (_, i) => `FWC${i + 1}`)] },
  ...Object.entries(groups).flatMap(([group, teams]) => teams.map(([name, code]) => ({
    name, code, group, stickers: Array.from({ length: 20 }, (_, i) => `${code}${i + 1}`)
  }))),
  { name: "Coca-Cola", code: "CC", group: "Extra", stickers: Array.from({ length: 14 }, (_, i) => `CC${i + 1}`) }
];

const allStickers = sections.flatMap(section => section.stickers);
const total = allStickers.length;
const byCode = new Map(sections.flatMap(section => section.stickers.map(code => [code, section])));
let collection = loadCollection();
let activeGroup = "Todos";
let toastTimer;
let longPressTimer;
let longPressHandled = false;
let scannerStream;
let scannerWorker;
let scannerTimer;
let scannerBusy = false;
let scannerCode = "";
let flashEnabled = false;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

function loadCollection() {
  try {
    const parsed = JSON.parse(localStorage.getItem("album-2026-collection") || "{}");
    return Object.fromEntries(Object.entries(parsed).filter(([code, quantity]) => byCode.has(code) && Number.isInteger(quantity) && quantity > 0));
  } catch {
    return {};
  }
}

function saveCollection() {
  localStorage.setItem("album-2026-collection", JSON.stringify(collection));
}

function getStats() {
  const owned = allStickers.filter(code => collection[code] > 0).length;
  const duplicates = Object.values(collection).reduce((sum, quantity) => sum + Math.max(0, quantity - 1), 0);
  return { owned, missing: total - owned, duplicates, percent: Math.round((owned / total) * 100) };
}

function sectionStats(section) {
  const owned = section.stickers.filter(code => collection[code] > 0).length;
  const duplicates = section.stickers.reduce((sum, code) => sum + Math.max(0, (collection[code] || 0) - 1), 0);
  return { owned, missing: section.stickers.length - owned, duplicates, percent: Math.round((owned / section.stickers.length) * 100) };
}

function groupStats(group) {
  const stickers = sections.filter(section => section.group === group).flatMap(section => section.stickers);
  const owned = stickers.filter(code => collection[code] > 0).length;
  return { owned, total: stickers.length, percent: Math.round((owned / stickers.length) * 100) };
}

function setQuantity(code, quantity, message = true) {
  const next = Math.max(0, quantity);
  if (next) collection[code] = next;
  else delete collection[code];
  saveCollection();
  renderAll();
  if (message) showToast(next === 0 ? `${code} removida` : next === 1 ? `${code} adicionada` : `${code}: ${next} unidades`);
}

function renderAll() {
  renderDashboard();
  renderAlbum();
  renderCodeLists();
}

function renderDashboard() {
  const stats = getStats();
  $("#owned-count").textContent = stats.owned;
  $("#missing-count").textContent = stats.missing;
  $("#duplicate-count").textContent = stats.duplicates;
  $("#progress-percent").textContent = `${stats.percent}%`;
  $("#hero-progress-bar").style.width = `${stats.percent}%`;
  $("#progress-orbit").style.background = `conic-gradient(var(--green-bright) ${stats.percent * 3.6}deg, rgba(255,255,255,.12) 0)`;
  $("#hero-message").textContent = stats.owned === total ? "Álbum completo. Que campanha!" : stats.owned ? `Você já garantiu ${stats.owned} de ${total} figurinhas.` : "Comece registrando sua primeira figurinha.";

  $("#group-grid").innerHTML = Object.keys(groups).map(group => {
    const stat = groupStats(group);
    return `<button class="group-card" data-open-group="${group}">
      <div class="group-card-head"><span class="group-letter">${group}</span><small>${stat.owned}/${stat.total}</small></div>
      <strong>Grupo ${group}</strong><div class="mini-progress"><span style="width:${stat.percent}%"></span></div>
    </button>`;
  }).join("");

  const ranking = sections.filter(section => !["Extra"].includes(section.group)).sort((a, b) => sectionStats(b).percent - sectionStats(a).percent || a.name.localeCompare(b.name)).slice(0, 6);
  $("#ranking-list").innerHTML = ranking.map(section => {
    const stat = sectionStats(section);
    return `<div class="ranking-item"><span class="rank-badge">${section.code}</span><div><strong>${section.name}</strong><small>${stat.missing} ${stat.missing === 1 ? "faltando" : "faltando"}</small></div><strong>${stat.percent}%</strong></div>`;
  }).join("");
}

function renderGroupFilters() {
  $("#group-filters").innerHTML = ["Todos", ...Object.keys(groups), "Extra"].map(group => `<button class="filter-chip ${activeGroup === group ? "active" : ""}" data-group="${group}">${group === "Todos" || group === "Extra" ? group : `Grupo ${group}`}</button>`).join("");
}

function renderAlbum() {
  renderGroupFilters();
  const openSections = new Set($$(".country-card[open]").map(card => card.dataset.section));
  const query = normalize($("#album-search")?.value || "");
  const filtered = sections.filter(section => {
    const inGroup = activeGroup === "Todos" || section.group === activeGroup;
    const matches = !query || normalize(section.name).includes(query) || section.stickers.some(code => code.includes(query));
    return inGroup && matches;
  });
  $("#album-empty").hidden = filtered.length > 0;
  $("#album-list").innerHTML = filtered.map(section => {
    const stat = sectionStats(section);
    const matchingStickers = query && section.stickers.some(code => code.includes(query)) ? section.stickers.filter(code => code.includes(query)) : section.stickers;
    return `<details class="country-card" data-section="${section.code}" ${query || openSections.has(section.code) ? "open" : ""}>
      <summary><span class="country-badge">${section.code}</span><span class="country-info"><strong>${section.name}</strong><small>${section.group === "Extra" ? "Coleção especial" : `Grupo ${section.group}`} · ${stat.owned}/${section.stickers.length}</small></span><span class="country-progress"><span style="width:${stat.percent}%"></span></span><span class="country-percent">${stat.percent}%</span></summary>
      <div class="sticker-grid">${matchingStickers.map(stickerButton).join("")}</div>
    </details>`;
  }).join("");
}

function stickerButton(code) {
  const quantity = collection[code] || 0;
  return `<button class="sticker ${quantity ? "owned" : ""} ${quantity > 1 ? "has-duplicates" : ""}" data-sticker="${code}" data-quantity="${quantity}">${code}</button>`;
}

function renderCodeLists() {
  const missingQuery = normalize($("#missing-search")?.value || "");
  const missingSections = sections.map(section => ({ section, codes: section.stickers.filter(code => !collection[code] && (!missingQuery || code.includes(missingQuery) || normalize(section.name).includes(missingQuery))) })).filter(item => item.codes.length);
  const duplicateSections = sections.map(section => ({ section, codes: section.stickers.filter(code => collection[code] > 1) })).filter(item => item.codes.length);
  $("#missing-subtitle").textContent = `${getStats().missing} figurinhas ainda separam você do álbum completo.`;
  $("#duplicates-subtitle").textContent = `${getStats().duplicates} extras disponíveis para trocar.`;
  $("#missing-list").innerHTML = missingSections.length ? missingSections.map(item => codeSection(item, false)).join("") : emptyMarkup("Nenhuma figurinha faltando", "Seu álbum está completo ou a busca não encontrou resultados.");
  $("#duplicates-list").innerHTML = duplicateSections.length ? duplicateSections.map(item => codeSection(item, true)).join("") : emptyMarkup("Nenhuma repetida", "Quando você registrar a segunda unidade, ela aparecerá aqui.");
}

function codeSection({ section, codes }, duplicate) {
  return `<article class="code-section"><header><div><strong>${section.name}</strong><small>${section.group === "Extra" ? "Especial" : `Grupo ${section.group}`}</small></div><span>${codes.length}</span></header><div class="codes">${codes.map(code => `<button class="code-pill ${duplicate ? "duplicate" : ""}" data-${duplicate ? "remove-duplicate" : "add-missing"}="${code}">${code}${duplicate ? `<span>×${collection[code] - 1}</span>` : ""}</button>`).join("")}</div></article>`;
}

function emptyMarkup(title, copy) {
  return `<div class="empty-state"><span>✓</span><h3>${title}</h3><p>${copy}</p></div>`;
}

function navigate(view) {
  $$(".view").forEach(item => item.classList.toggle("active", item.id === `view-${view}`));
  $$(".bottom-nav button").forEach(item => item.classList.toggle("active", item.dataset.viewTarget === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "missing" || view === "duplicates") renderCodeLists();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function quickAdd(event) {
  event.preventDefault();
  const input = $("#quick-add-input");
  const code = normalize(input.value);
  const result = $("#quick-result");
  if (!byCode.has(code)) {
    result.hidden = false;
    result.innerHTML = `<strong>${code || "Código vazio"}</strong> não foi encontrado no álbum. Confira e tente novamente.`;
    return;
  }
  setQuantity(code, (collection[code] || 0) + 1);
  const section = byCode.get(code);
  result.hidden = false;
  result.innerHTML = `<strong>${code}</strong> registrada em ${section.name}. Agora você tem ${collection[code]} ${collection[code] === 1 ? "unidade" : "unidades"}.`;
  input.value = "";
  input.focus();
}

function updateScannerStatus(title, copy) {
  $("#scanner-status").innerHTML = `<span class="scanner-pulse"></span><div><strong>${title}</strong><small>${copy}</small></div>`;
}

async function prepareScannerWorker() {
  if (scannerWorker) return scannerWorker;
  updateScannerStatus("Carregando reconhecimento...", "Isso acontece somente na primeira leitura");
  scannerWorker = await Tesseract.createWorker("eng", 1, {
    workerPath: "vendor/tesseract/worker.min.js",
    langPath: "vendor/tesseract/",
    corePath: "vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
    logger: message => {
      if (message.status === "recognizing text") updateScannerStatus("Lendo código...", `${Math.round(message.progress * 100)}% processado`);
    }
  });
  await scannerWorker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    tessedit_pageseg_mode: "7"
  });
  return scannerWorker;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function findStickerCode(text) {
  const chunks = normalize(text).match(/[A-Z0-9]{2,8}/g) || [];
  for (const chunk of chunks) {
    if (byCode.has(chunk)) return chunk;
  }

  const numberLookalikes = { O: "0", I: "1", L: "1", S: "5", B: "8" };
  const corrected = allStickers.filter(code => chunks.some(chunk => {
    if (chunk.length !== code.length) return false;
    return [...code].every((character, index) => character === chunk[index] || (/\d/.test(character) && numberLookalikes[chunk[index]] === character));
  }));
  if (corrected.length === 1) return corrected[0];

  const fuzzy = allStickers.filter(code => chunks.some(chunk => chunk.length === code.length && editDistance(chunk, code) === 1));
  return fuzzy.length === 1 ? fuzzy[0] : "";
}

function showScannerResult(code) {
  scannerCode = code;
  const section = byCode.get(code);
  const quantity = collection[code] || 0;
  $("#scanner-result").hidden = false;
  $("#scanner-result").innerHTML = `<span class="country-badge">${section.code}</span><div><strong>${code}</strong><small>${section.name} · ${section.group === "Extra" ? "Especial" : `Grupo ${section.group}`}</small></div><span>${quantity ? `Você tem ${quantity}` : "Está faltando"}</span>`;
  $("#scanner-add").hidden = false;
  $("#scanner-add").textContent = quantity ? "Adicionar outra" : "Adicionar figurinha";
  updateScannerStatus("Código encontrado", quantity ? "Ela já está na sua coleção" : "Você ainda não possui esta figurinha");
  navigator.vibrate?.(45);
}

async function scanCameraFrame() {
  if (scannerBusy || !scannerStream || $("#scanner-modal").hidden) return;
  const video = $("#scanner-video");
  if (!video.videoWidth) return;
  scannerBusy = true;
  try {
    const canvas = $("#scanner-canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const cropWidth = Math.round(video.videoWidth * .82);
    const cropHeight = Math.round(video.videoHeight * .28);
    const sourceX = Math.round((video.videoWidth - cropWidth) / 2);
    const sourceY = Math.round((video.videoHeight - cropHeight) / 2);
    canvas.width = 1200;
    canvas.height = Math.round(1200 * cropHeight / cropWidth);
    context.filter = "grayscale(1) contrast(1.8)";
    context.drawImage(video, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const worker = await prepareScannerWorker();
    const { data } = await worker.recognize(canvas);
    const code = findStickerCode(data.text);
    if (code) showScannerResult(code);
    else updateScannerStatus("Procurando código...", "Aproxime, centralize o código e mantenha firme");
  } catch (error) {
    console.error(error);
    updateScannerStatus("Não consegui ler", "Tente aproximar a câmera ou melhorar a iluminação");
  } finally {
    scannerBusy = false;
    if (scannerStream && !$("#scanner-modal").hidden) scannerTimer = setTimeout(scanCameraFrame, scannerCode ? 4000 : 1800);
  }
}

async function openScanner() {
  $("#scanner-modal").hidden = false;
  $("#scanner-loading").hidden = false;
  $("#scanner-result").hidden = true;
  $("#scanner-add").hidden = true;
  scannerCode = "";
  document.body.style.overflow = "hidden";
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    const video = $("#scanner-video");
    video.srcObject = scannerStream;
    await video.play();
    const track = scannerStream.getVideoTracks()[0];
    $("#toggle-flash").hidden = !track.getCapabilities?.().torch;
    await prepareScannerWorker();
    $("#scanner-loading").hidden = true;
    updateScannerStatus("Procurando código...", "Mantenha a câmera firme e com boa iluminação");
    scanCameraFrame();
  } catch (error) {
    console.error(error);
    $("#scanner-loading").hidden = true;
    const denied = error.name === "NotAllowedError";
    updateScannerStatus(denied ? "Câmera não autorizada" : "Não foi possível abrir a câmera", denied ? "Libere a permissão da câmera nas configurações do navegador" : "Use o cadastro digitando o código");
  }
}

function closeScanner() {
  clearTimeout(scannerTimer);
  scannerStream?.getTracks().forEach(track => track.stop());
  scannerStream = null;
  flashEnabled = false;
  $("#scanner-modal").hidden = true;
  document.body.style.overflow = "";
}

async function toggleFlash() {
  const track = scannerStream?.getVideoTracks()[0];
  if (!track?.getCapabilities?.().torch) return;
  flashEnabled = !flashEnabled;
  await track.applyConstraints({ advanced: [{ torch: flashEnabled }] });
  $("#toggle-flash").classList.toggle("active", flashEnabled);
}

async function shareList(type) {
  const duplicate = type === "duplicates";
  const title = duplicate ? "Minhas figurinhas repetidas" : "Figurinhas que faltam";
  const codes = sections.flatMap(section => {
    const list = section.stickers.filter(code => duplicate ? collection[code] > 1 : !collection[code]);
    return list.length ? [`\n${section.name}:`, ...list.map(code => duplicate ? `${code} (${collection[code] - 1}x)` : code)] : [];
  });
  const text = `${title} — Copa 2026\n${codes.join(" ")}`;
  try {
    if (navigator.share) await navigator.share({ title, text });
    else {
      await navigator.clipboard.writeText(text);
      showToast("Lista copiada");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("Não foi possível compartilhar");
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({ app: "Meu Álbum 2026", version: 1, exportedAt: new Date().toISOString(), collection }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `meu-album-2026-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Backup exportado");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const imported = data.collection || data;
      collection = Object.fromEntries(Object.entries(imported).filter(([code, quantity]) => byCode.has(code) && Number.isInteger(quantity) && quantity > 0));
      saveCollection();
      renderAll();
      showToast("Backup importado");
    } catch {
      showToast("Arquivo de backup inválido");
    }
  };
  reader.readAsText(file);
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-view-target]");
  if (nav) navigate(nav.dataset.viewTarget);

  const group = event.target.closest("[data-group]");
  if (group) {
    activeGroup = group.dataset.group;
    renderAlbum();
  }

  const openGroup = event.target.closest("[data-open-group]");
  if (openGroup) {
    activeGroup = openGroup.dataset.openGroup;
    renderAlbum();
    navigate("album");
  }

  const sticker = event.target.closest("[data-sticker]");
  if (sticker && !longPressHandled) setQuantity(sticker.dataset.sticker, (collection[sticker.dataset.sticker] || 0) + 1);
  longPressHandled = false;

  const missing = event.target.closest("[data-add-missing]");
  if (missing) setQuantity(missing.dataset.addMissing, 1);

  const duplicate = event.target.closest("[data-remove-duplicate]");
  if (duplicate) setQuantity(duplicate.dataset.removeDuplicate, collection[duplicate.dataset.removeDuplicate] - 1);
});

document.addEventListener("pointerdown", event => {
  const sticker = event.target.closest("[data-sticker]");
  if (!sticker) return;
  longPressHandled = false;
  longPressTimer = setTimeout(() => {
    longPressHandled = true;
    const code = sticker.dataset.sticker;
    if (collection[code]) {
      setQuantity(code, collection[code] - 1);
      navigator.vibrate?.(35);
    } else {
      showToast(`${code} ainda não foi adicionada`);
    }
  }, 550);
});

document.addEventListener("pointerup", () => clearTimeout(longPressTimer));
document.addEventListener("pointercancel", () => clearTimeout(longPressTimer));
document.addEventListener("pointermove", () => clearTimeout(longPressTimer));
document.addEventListener("contextmenu", event => {
  if (event.target.closest("[data-sticker]")) event.preventDefault();
});

$("#quick-add-form").addEventListener("submit", quickAdd);
$("#open-scanner").addEventListener("click", openScanner);
$("#close-scanner").addEventListener("click", closeScanner);
$("#toggle-flash").addEventListener("click", toggleFlash);
$("#scan-now").addEventListener("click", () => {
  scannerCode = "";
  clearTimeout(scannerTimer);
  scanCameraFrame();
});
$("#scanner-add").addEventListener("click", () => {
  if (!scannerCode) return;
  setQuantity(scannerCode, (collection[scannerCode] || 0) + 1);
  showScannerResult(scannerCode);
});
$("#album-search").addEventListener("input", renderAlbum);
$("#missing-search").addEventListener("input", renderCodeLists);
$("#share-missing").addEventListener("click", () => shareList("missing"));
$("#share-duplicates").addEventListener("click", () => shareList("duplicates"));
$("#export-data").addEventListener("click", exportData);
$("#import-data").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", event => event.target.files[0] && importData(event.target.files[0]));
$("#clear-data").addEventListener("click", () => $("#confirm-modal").hidden = false);
$("#cancel-clear").addEventListener("click", () => $("#confirm-modal").hidden = true);
$("#confirm-clear").addEventListener("click", () => {
  collection = {};
  saveCollection();
  renderAll();
  $("#confirm-modal").hidden = true;
  showToast("Coleção limpa");
});
$("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("album-2026-theme", document.body.classList.contains("dark") ? "dark" : "light");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && scannerStream) closeScanner();
});

if (localStorage.getItem("album-2026-theme") === "dark" || (!localStorage.getItem("album-2026-theme") && matchMedia("(prefers-color-scheme: dark)").matches)) document.body.classList.add("dark");
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
renderAll();
