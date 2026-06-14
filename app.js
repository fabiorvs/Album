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
const byPrefix = new Map(sections.map(section => [section.code, section]));
let collection = loadCollection();
let activeGroup = "Todos";
let toastTimer;
let longPressState;
let suppressedStickerClick;
let scannerStream;
let scannerWorker;
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
  const action = quantity ? `Você tem ${quantity}. Segure para remover uma unidade.` : "Você ainda não tem. Toque para adicionar.";
  return `<button class="sticker ${quantity ? "owned" : ""} ${quantity > 1 ? "has-duplicates" : ""}" data-sticker="${code}" data-quantity="${quantity}" aria-label="${code}. ${action}" title="${action}">${code}</button>`;
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

function showQuickLookup(code) {
  const input = $("#quick-add-input");
  const result = $("#quick-result");
  if (!byCode.has(code)) {
    result.hidden = false;
    result.innerHTML = `<strong>${code || "Código vazio"}</strong> não foi encontrado no álbum. Confira e tente novamente.`;
    return;
  }
  const section = byCode.get(code);
  const quantity = collection[code] || 0;
  result.hidden = false;
  result.innerHTML = `<div class="quick-result-card"><span class="country-badge">${section.code}</span><div><strong>${code}: ${quantity ? `você tem ${quantity}` : "está faltando"}</strong><small>${section.name} · ${section.group === "Extra" ? "Especial" : `Grupo ${section.group}`}</small></div><button data-quick-add="${code}">${quantity ? "Adicionar outra" : "Adicionar"}</button></div>`;
  input.value = code;
  hideQuickSuggestions();
}

function quickAdd(event) {
  event.preventDefault();
  showQuickLookup(normalize($("#quick-add-input").value).replace(/\s+/g, ""));
}

function setQuickInputMode(query) {
  const input = $("#quick-add-input");
  const numeric = [...byPrefix.keys()].some(prefix => query.startsWith(prefix) && query.length >= prefix.length);
  const nextMode = numeric ? "numeric" : "text";
  if (input.inputMode === nextMode) return;
  input.inputMode = nextMode;
  if (document.activeElement === input) {
    input.blur();
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
}

function hideQuickSuggestions() {
  $("#quick-suggestions").hidden = true;
  $("#quick-add-input").setAttribute("aria-expanded", "false");
}

function renderQuickSuggestions() {
  const input = $("#quick-add-input");
  const query = normalize(input.value).replace(/[^A-Z0-9]/g, "");
  input.value = query;
  setQuickInputMode(query);
  const suggestions = $("#quick-suggestions");
  if (!query) {
    hideQuickSuggestions();
    return;
  }

  const exactPrefix = byPrefix.get(query);
  const matchingCodes = /\d/.test(query) ? allStickers.filter(code => code.startsWith(query)).slice(0, 10) : [];
  const matchingSections = sections
    .filter(section => section.code.startsWith(query) || normalize(section.name).startsWith(query))
    .sort((a, b) => Number(b.code.startsWith(query)) - Number(a.code.startsWith(query)) || a.code.localeCompare(b.code))
    .slice(0, 8);
  const codes = exactPrefix ? exactPrefix.stickers : matchingCodes;
  const items = codes.length ? codes : matchingSections;
  suggestions.innerHTML = codes.length
    ? codes.map(code => {
      const section = byCode.get(code);
      const quantity = collection[code] || 0;
      return `<button type="button" class="quick-suggestion" data-quick-code="${code}"><span class="country-badge">${section.code}</span><div><strong>${code}</strong><small>${section.name}</small></div><span>${quantity ? `Tenho ${quantity}` : "Falta"}</span></button>`;
    }).join("")
    : items.map(section => `<button type="button" class="quick-suggestion" data-quick-prefix="${section.code}"><span class="country-badge">${section.code}</span><div><strong>${section.code}</strong><small>${section.name}</small></div><span>Ver números</span></button>`).join("");
  suggestions.hidden = !items.length;
  input.setAttribute("aria-expanded", String(Boolean(items.length)));
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

function stickerTextChunks(text) {
  const normalized = normalize(text);
  const joinedCodes = [...normalized.matchAll(/([A-Z]{2,4})[\s:_-]*([0-9OILSBGDQZ]{1,2})/g)].map(match => `${match[1]}${match[2]}`);
  const rawChunks = [...joinedCodes, ...(normalized.match(/[A-Z0-9]{2,10}/g) || [])];
  const chunks = [...new Set(rawChunks.flatMap(chunk => {
    const simplified = chunk.replaceAll("IVI", "M").replace(/^I(?=[A-Z]{3,4}[0-9])/, "").replace(/K(?=[0-9OILSBGDQZ]{1,2}$)/, "R");
    const suffix = simplified.match(/([A-Z]+)([0-9OILSBGDQZ]{1,2})$/);
    if (!suffix) return [chunk, simplified];
    const [, letters, number] = suffix;
    return [chunk, simplified, ...[2, 3, 4].filter(length => letters.length >= length).map(length => `${letters.slice(-length)}${number}`)];
  }))];
  return { rawChunks, chunks };
}

function scoreStickerCodes(text) {
  const { rawChunks, chunks } = stickerTextChunks(text);
  const scores = new Map();
  const addScore = (code, score) => scores.set(code, Math.max(scores.get(code) || 0, score));
  rawChunks.filter(chunk => byCode.has(chunk)).forEach(code => addScore(code, 6));
  chunks.filter(chunk => byCode.has(chunk)).forEach(code => addScore(code, 3));

  const numberLookalikes = { O: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "9", Q: "9" };
  allStickers.forEach(code => {
    if (chunks.some(chunk => chunk.length === code.length && [...code].every((character, index) => character === chunk[index] || (/\d/.test(character) && numberLookalikes[chunk[index]] === character)))) addScore(code, 2);
    else if (chunks.some(chunk => chunk.length === code.length && editDistance(chunk, code) === 1)) addScore(code, 1);
  });
  return scores;
}

function findStickerCode(text) {
  const { chunks } = stickerTextChunks(text);
  for (const chunk of chunks) {
    if (byCode.has(chunk)) return chunk;
  }

  const numberLookalikes = { O: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "9", Q: "9" };
  const corrected = allStickers.filter(code => chunks.some(chunk => {
    if (chunk.length !== code.length) return false;
    return [...code].every((character, index) => character === chunk[index] || (/\d/.test(character) && numberLookalikes[chunk[index]] === character));
  }));
  if (corrected.length === 1) return corrected[0];

  const fuzzy = allStickers.filter(code => chunks.some(chunk => chunk.length === code.length && editDistance(chunk, code) === 1));
  return fuzzy.length === 1 ? fuzzy[0] : "";
}

function stickerGuideSourceRect(video) {
  const stageRect = $(".scanner-stage").getBoundingClientRect();
  const guideRect = $(".scanner-guide").getBoundingClientRect();
  const scale = Math.max(stageRect.width / video.videoWidth, stageRect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (stageRect.width - renderedWidth) / 2;
  const offsetY = (stageRect.height - renderedHeight) / 2;
  return {
    x: Math.max(0, (guideRect.left - stageRect.left - offsetX) / scale),
    y: Math.max(0, (guideRect.top - stageRect.top - offsetY) / scale),
    width: Math.min(video.videoWidth, guideRect.width / scale),
    height: Math.min(video.videoHeight, guideRect.height / scale)
  };
}

function createOCRImage(source, sticker, region, filter = "grayscale(1) contrast(1.7)") {
  const canvas = document.createElement("canvas");
  const sourceX = sticker.x + sticker.width * region.x;
  const sourceY = sticker.y + sticker.height * region.y;
  const sourceWidth = sticker.width * region.width;
  const sourceHeight = sticker.height * region.height;
  const padding = 70;
  const contentWidth = 1400;
  const contentHeight = Math.round(contentWidth * sourceHeight / sourceWidth);
  canvas.width = contentWidth + padding * 2;
  canvas.height = contentHeight + padding * 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = filter;
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, padding, padding, contentWidth, contentHeight);
  return canvas;
}

function binarizeOCRImage(source, invert = false) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let average = 0;
  for (let index = 0; index < image.data.length; index += 4) average += image.data[index];
  average /= image.data.length / 4;
  for (let index = 0; index < image.data.length; index += 4) {
    let value = image.data[index] > average * .92 ? 255 : 0;
    if (invert) value = 255 - value;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function createOCRCandidates(source, sticker) {
  const codeRegion = { x: .38, y: 0, width: .62, height: .27 };
  const topBand = { x: 0, y: 0, width: 1, height: .31 };
  const codeGray = createOCRImage(source, sticker, codeRegion);
  return [
    { image: codeGray, pageMode: "7", label: "tarja" },
    { image: createOCRImage(source, sticker, codeRegion, "grayscale(1) contrast(1.8) invert(1)"), pageMode: "7", label: "tarja invertida" },
    { image: binarizeOCRImage(codeGray), pageMode: "7", label: "tarja em alto contraste" },
    { image: createOCRImage(source, sticker, topBand, "grayscale(1) contrast(1.5)"), pageMode: "6", label: "faixa superior" }
  ];
}

function showScannerResult(code) {
  scannerCode = code;
  const section = byCode.get(code);
  const quantity = collection[code] || 0;
  $("#scanner-result").hidden = false;
  $("#scanner-result").innerHTML = `<span class="country-badge">${section.code}</span><div><strong>${code}</strong><small>${section.name} · ${section.group === "Extra" ? "Especial" : `Grupo ${section.group}`}</small></div><span>${quantity ? `Você tem ${quantity}` : "Está faltando"}</span>`;
  $("#scanner-add").hidden = false;
  $("#scanner-add").textContent = quantity ? "Adicionar outra" : "Adicionar figurinha";
  $("#scan-now").classList.remove("capture-button");
  $("#scan-now").innerHTML = `<svg><use href="#icon-camera"></use></svg>Tirar outra`;
  updateScannerStatus("Código encontrado", quantity ? "Ela já está na sua coleção" : "Você ainda não possui esta figurinha");
  navigator.vibrate?.(45);
}

function resetScannerPhoto(copy = "Enquadre o verso e alinhe o código na área laranja") {
  scannerCode = "";
  $("#scanner-result").hidden = true;
  $("#scanner-add").hidden = true;
  $("#scanner-photo").hidden = true;
  $("#scanner-video").hidden = false;
  $(".scanner-guide").hidden = false;
  $("#scan-now").classList.add("capture-button");
  $("#scan-now").innerHTML = `<svg><use href="#icon-camera"></use></svg>Capturar e ler`;
  updateScannerStatus("Pronto para fotografar", copy);
}

async function scanCameraFrame() {
  if (scannerBusy || !scannerStream || $("#scanner-modal").hidden) return;
  const video = $("#scanner-video");
  if (!video.videoWidth) return;
  scannerBusy = true;
  const sticker = stickerGuideSourceRect(video);
  const photo = $("#scanner-photo");
  photo.width = video.videoWidth;
  photo.height = video.videoHeight;
  photo.getContext("2d").drawImage(video, 0, 0);
  photo.hidden = false;
  video.hidden = true;
  $(".scanner-guide").hidden = true;
  $("#scan-now").disabled = true;
  $("#scan-now").classList.remove("capture-button");
  $("#scan-now").innerHTML = `<span class="spinner"></span>Processando foto`;
  try {
    const worker = await prepareScannerWorker();
    const candidates = createOCRCandidates(photo, sticker);
    const readings = [];
    const totals = new Map();
    const occurrences = new Map();
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      updateScannerStatus("Analisando foto...", `Tentativa ${index + 1} de ${candidates.length}: ${candidate.label}`);
      await worker.setParameters({ tessedit_pageseg_mode: candidate.pageMode });
      const { data } = await worker.recognize(candidate.image);
      readings.push(data.text);
      scoreStickerCodes(data.text).forEach((score, code) => {
        totals.set(code, (totals.get(code) || 0) + score);
        occurrences.set(code, (occurrences.get(code) || 0) + 1);
      });
    }
    const ranked = [...totals].sort((a, b) => b[1] - a[1]);
    const [best, second] = ranked;
    const code = best && occurrences.get(best[0]) >= 2 && best[1] >= 6 && best[1] - (second?.[1] || 0) >= 2 ? best[0] : "";
    if (code) showScannerResult(code);
    else {
      $("#scan-now").innerHTML = `<svg><use href="#icon-camera"></use></svg>Tirar outra`;
      const readText = normalize(readings.join(" ")).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28);
      updateScannerStatus("Código não encontrado", readText ? `O leitor enxergou: ${readText}` : "Aproxime a figurinha e evite reflexos na tarja");
    }
  } catch (error) {
    console.error(error);
    $("#scan-now").innerHTML = `<svg><use href="#icon-camera"></use></svg>Tirar outra`;
    updateScannerStatus("Não consegui ler", "Tente aproximar a câmera ou melhorar a iluminação");
  } finally {
    scannerBusy = false;
    $("#scan-now").disabled = false;
  }
}

async function openScanner() {
  $("#scanner-modal").hidden = false;
  $("#scanner-loading").hidden = false;
  $("#scanner-result").hidden = true;
  $("#scanner-add").hidden = true;
  scannerCode = "";
  resetScannerPhoto();
  document.body.style.overflow = "hidden";
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 }, focusMode: { ideal: "continuous" } },
      audio: false
    });
    const video = $("#scanner-video");
    video.srcObject = scannerStream;
    await video.play();
    const track = scannerStream.getVideoTracks()[0];
    $("#toggle-flash").hidden = !track.getCapabilities?.().torch;
    await prepareScannerWorker();
    $("#scanner-loading").hidden = true;
    updateScannerStatus("Pronto para fotografar", "Enquadre o verso e alinhe o código na área laranja");
  } catch (error) {
    console.error(error);
    $("#scanner-loading").hidden = true;
    const denied = error.name === "NotAllowedError";
    updateScannerStatus(denied ? "Câmera não autorizada" : "Não foi possível abrir a câmera", denied ? "Libere a permissão da câmera nas configurações do navegador" : "Use o cadastro digitando o código");
  }
}

function closeScanner() {
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
  const quickPrefix = event.target.closest("[data-quick-prefix]");
  if (quickPrefix) {
    $("#quick-add-input").value = quickPrefix.dataset.quickPrefix;
    renderQuickSuggestions();
    $("#quick-add-input").focus();
  }

  const quickCode = event.target.closest("[data-quick-code]");
  if (quickCode) showQuickLookup(quickCode.dataset.quickCode);

  const quickAddButton = event.target.closest("[data-quick-add]");
  if (quickAddButton) {
    const code = quickAddButton.dataset.quickAdd;
    setQuantity(code, (collection[code] || 0) + 1);
    showQuickLookup(code);
  }

  if (!event.target.closest("#quick-add-form")) hideQuickSuggestions();

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
  const stickerClickSuppressed = sticker && suppressedStickerClick?.code === sticker.dataset.sticker && Date.now() < suppressedStickerClick.until;
  if (sticker && !stickerClickSuppressed) setQuantity(sticker.dataset.sticker, (collection[sticker.dataset.sticker] || 0) + 1);

  const missing = event.target.closest("[data-add-missing]");
  if (missing) setQuantity(missing.dataset.addMissing, 1);

  const duplicate = event.target.closest("[data-remove-duplicate]");
  if (duplicate) setQuantity(duplicate.dataset.removeDuplicate, collection[duplicate.dataset.removeDuplicate] - 1);
});

document.addEventListener("pointerdown", event => {
  const sticker = event.target.closest("[data-sticker]");
  if (!sticker) return;
  cancelLongPress();
  sticker.classList.add("long-pressing");
  longPressState = {
    sticker,
    startX: event.clientX,
    startY: event.clientY,
    timer: setTimeout(() => {
      suppressedStickerClick = { code: sticker.dataset.sticker, until: Date.now() + 800 };
      sticker.classList.remove("long-pressing");
      sticker.classList.add("removing");
      longPressState = null;
      const code = sticker.dataset.sticker;
      if (collection[code]) {
        const next = collection[code] - 1;
        setQuantity(code, next, false);
        showToast(next ? `${code}: uma unidade removida` : `${code} removida da coleção`);
        navigator.vibrate?.([35, 30, 35]);
      } else {
        showToast(`${code} ainda não foi adicionada`);
      }
    }, 650)
  };
});

function cancelLongPress() {
  if (!longPressState) return;
  clearTimeout(longPressState.timer);
  longPressState.sticker.classList.remove("long-pressing");
  longPressState = null;
}

document.addEventListener("pointerup", cancelLongPress);
document.addEventListener("pointercancel", cancelLongPress);
document.addEventListener("pointermove", event => {
  if (!longPressState) return;
  const distance = Math.hypot(event.clientX - longPressState.startX, event.clientY - longPressState.startY);
  if (distance > 18) cancelLongPress();
});
document.addEventListener("contextmenu", event => {
  if (event.target.closest("[data-sticker]")) event.preventDefault();
});

$("#quick-add-form").addEventListener("submit", quickAdd);
$("#quick-add-input").addEventListener("input", renderQuickSuggestions);
$("#quick-add-input").addEventListener("focus", renderQuickSuggestions);
$("#open-scanner").addEventListener("click", openScanner);
$("#close-scanner").addEventListener("click", closeScanner);
$("#toggle-flash").addEventListener("click", toggleFlash);
$("#scan-now").addEventListener("click", () => {
  if (!$("#scanner-photo").hidden) resetScannerPhoto("Ajuste a próxima figurinha e capture quando estiver nítida");
  else scanCameraFrame();
});
$("#scanner-add").addEventListener("click", () => {
  if (!scannerCode) return;
  setQuantity(scannerCode, (collection[scannerCode] || 0) + 1);
  resetScannerPhoto("Figurinha adicionada. Enquadre a próxima");
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
