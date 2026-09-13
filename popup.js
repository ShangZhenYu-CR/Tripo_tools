const ext = globalThis.browser ?? globalThis.chrome;

const DB_NAME = 'tripo-multiview-paste';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const STORAGE_KEY = 'tmpPopupState';
const SETTINGS_KEY = 'tmpSettings';
const DEFAULT_SETTINGS = { autoClearBeforeFill: true };
// Tripo's current Multiview order is FRONT / LEFT / RIGHT / BACK.
const DIRECTIONS = ['FRONT', 'LEFT', 'RIGHT', 'BACK'];
const MIN_SEND_VIEWS = 3;

let dbPromise = null;
let state = { order: [], activeSet: 0, showAll: false };
let settings = { ...DEFAULT_SETTINGS };
let objectUrls = [];
let dragSourceIndex = null;
let toastTimer = null;
let transferBusy = false;

const els = {
  tabs: document.getElementById('set-tabs'),
  setStatus: document.getElementById('set-status'),
  fill: document.getElementById('fill-tripo'),
  clearTripo: document.getElementById('clear-tripo'),
  autoClearTripo: document.getElementById('auto-clear-tripo'),
  single: document.getElementById('single-set-view'),
  grid: document.getElementById('view-grid'),
  all: document.getElementById('all-sets-view'),
  allList: document.getElementById('all-sets-list'),
  tripoStatus: document.getElementById('tripo-status'),
  clearCurrent: document.getElementById('delete-current'),
  clearAll: document.getElementById('clear-all'),
  toast: document.getElementById('toast')
};

boot().catch((error) => showToast(String(error?.message || error), 'error'));

async function boot() {
  await openDb();
  await loadState();
  await loadSettings();
  await sanitizeState();
  bindEvents();
  await render();
  await refreshTripoStatus();
}

function bindEvents() {
  window.addEventListener('paste', handlePaste);
  els.fill.addEventListener('click', fillCurrentSetToTripo);
  els.clearTripo.addEventListener('click', clearTripoOnly);
  els.autoClearTripo.addEventListener('change', async () => {
    settings.autoClearBeforeFill = Boolean(els.autoClearTripo.checked);
    await saveSettings();
  });
  els.clearCurrent.addEventListener('click', deleteCurrentSet);
  els.clearAll.addEventListener('click', clearAll);
}

async function handlePaste(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const files = [];
  for (const item of clipboard.items || []) {
    if (item.kind !== 'file' || !String(item.type || '').startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  if (!files.length) return;

  event.preventDefault();
  let lastPlacedIndex = 0;
  for (const file of files) {
    const id = crypto.randomUUID();
    await putImage({
      id,
      blob: file,
      type: file.type || 'image/png',
      name: file.name || `clipboard-${Date.now()}.png`,
      createdAt: Date.now()
    });
    lastPlacedIndex = placeImageInNextAvailableSlot(id);
  }

  state.activeSet = Math.floor(lastPlacedIndex / 4);
  state.showAll = false;
  await saveState();
  await render();
  showToast(`${files.length} image${files.length === 1 ? '' : 's'} pasted.`, 'success');
}

function placeImageInNextAvailableSlot(id) {
  if (!state.order.length) {
    state.order[0] = id;
    return 0;
  }

  const lastSetIndex = Math.max(0, Math.ceil(state.order.length / 4) - 1);
  const start = lastSetIndex * 4;
  for (let index = start; index < start + 4; index++) {
    if (!state.order[index]) {
      state.order[index] = id;
      return index;
    }
  }

  const nextIndex = (lastSetIndex + 1) * 4;
  state.order[nextIndex] = id;
  return nextIndex;
}

async function render() {
  revokeObjectUrls();
  let sets = getSets();
  if (!sets.length) sets = [[]];
  state.activeSet = Math.min(Math.max(0, state.activeSet), sets.length - 1);

  renderTabs(sets);
  if (state.showAll) {
    els.single.hidden = true;
    els.all.hidden = false;
    await renderAllSets(sets);
  } else {
    els.single.hidden = false;
    els.all.hidden = true;
    await renderSingleSet(sets[state.activeSet] || []);
  }
  updateActions(sets[state.activeSet] || []);
}

function renderTabs(sets) {
  els.tabs.replaceChildren();
  for (let index = 0; index < sets.length; index++) {
    const set = sets[index] || [];
    const count = countImages(set);
    const button = document.createElement('button');
    button.className = 'set-tab';
    if (!state.showAll && state.activeSet === index) button.classList.add('active');
    if ((state.showAll || state.activeSet !== index) && count > 0 && count < MIN_SEND_VIEWS) {
      button.classList.add('collecting');
    }
    if ((state.showAll || state.activeSet !== index) && count >= MIN_SEND_VIEWS && count < 4) {
      button.classList.add('partial-ready');
    }
    button.textContent = count > 0 && count < 4
      ? `SET ${pad(index + 1)} · ${count}/4`
      : `SET ${pad(index + 1)}`;
    button.addEventListener('click', async () => {
      state.activeSet = index;
      state.showAll = false;
      await saveState();
      await render();
    });
    els.tabs.appendChild(button);
  }

  const allButton = document.createElement('button');
  allButton.className = 'set-tab';
  if (state.showAll) allButton.classList.add('active');
  allButton.textContent = 'ALL SETS';
  allButton.addEventListener('click', async () => {
    state.showAll = true;
    await saveState();
    await render();
  });
  els.tabs.appendChild(allButton);
}

async function renderSingleSet(setIds) {
  els.grid.replaceChildren();
  const baseIndex = state.activeSet * 4;
  for (let slot = 0; slot < 4; slot++) {
    const id = setIds[slot];
    const record = id ? await getImage(id) : null;
    els.grid.appendChild(makeViewCard(record, DIRECTIONS[slot], {
      draggable: Boolean(record),
      globalIndex: baseIndex + slot
    }));
  }
}

async function renderAllSets(sets) {
  els.allList.replaceChildren();
  for (let setIndex = 0; setIndex < sets.length; setIndex++) {
    const set = sets[setIndex] || [];
    const count = countImages(set);
    const wrapper = document.createElement('article');
    wrapper.className = 'set-overview';

    const header = document.createElement('div');
    header.className = 'set-overview-header';
    const title = document.createElement('div');
    title.className = 'set-overview-title';
    title.textContent = `SET ${pad(setIndex + 1)}`;
    const chip = document.createElement('span');
    const ready = count >= MIN_SEND_VIEWS;
    chip.className = `chip ${ready ? 'chip-success' : 'chip-warning'}`;
    chip.textContent = ready ? `${count} / 4 READY` : `${count} / 4 COLLECTING`;
    header.append(title, chip);

    const grid = document.createElement('div');
    grid.className = 'set-overview-grid';
    for (let slot = 0; slot < 4; slot++) {
      const record = set[slot] ? await getImage(set[slot]) : null;
      grid.appendChild(makeViewCard(record, DIRECTIONS[slot], {}));
    }

    wrapper.append(header, grid);
    wrapper.addEventListener('dblclick', async () => {
      state.activeSet = setIndex;
      state.showAll = false;
      await saveState();
      await render();
    });
    els.allList.appendChild(wrapper);
  }
}

function makeViewCard(record, direction, options = {}) {
  const card = document.createElement('div');
  card.className = `view-card${record ? '' : ' empty'}`;
  if (options.draggable) card.draggable = true;
  if (Number.isInteger(options.globalIndex)) card.dataset.globalIndex = String(options.globalIndex);

  const label = document.createElement('div');
  label.className = 'view-label';
  label.textContent = direction;

  const preview = document.createElement('div');
  preview.className = `preview${record ? '' : ' preview-empty'}`;
  if (record?.blob) {
    const url = URL.createObjectURL(record.blob);
    objectUrls.push(url);
    const img = document.createElement('img');
    img.src = url;
    img.alt = direction;
    preview.appendChild(img);
  } else {
    preview.textContent = 'NO IMAGE';
  }
  card.append(label, preview);

  if (options.draggable) {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend', onDragEnd);
  }
  if (Number.isInteger(options.globalIndex)) {
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop', onDrop);
  }
  return card;
}

function onDragStart(event) {
  dragSourceIndex = Number(event.currentTarget.dataset.globalIndex);
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(dragSourceIndex));
}

function onDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.view-card.drag-over').forEach((node) => node.classList.remove('drag-over'));
  dragSourceIndex = null;
}

function onDragOver(event) {
  const targetIndex = Number(event.currentTarget.dataset.globalIndex);
  if (!Number.isInteger(dragSourceIndex) || !sameSet(dragSourceIndex, targetIndex)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function onDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

async function onDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
  const targetIndex = Number(event.currentTarget.dataset.globalIndex);
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) return;
  if (!sameSet(sourceIndex, targetIndex) || sourceIndex === targetIndex) return;

  const sourceId = state.order[sourceIndex] || null;
  if (!sourceId) return;
  const targetId = state.order[targetIndex] || null;
  state.order[sourceIndex] = targetId;
  state.order[targetIndex] = sourceId;
  trimTrailingEmptySlots();
  await saveState();
  await render();
}

function sameSet(a, b) {
  return Math.floor(a / 4) === Math.floor(b / 4);
}

function countImages(set) {
  return (set || []).filter((id) => typeof id === 'string' && id).length;
}

function updateActions(set) {
  const count = countImages(set);
  const ready = count >= MIN_SEND_VIEWS;
  els.setStatus.className = `chip ${ready ? 'chip-success' : 'chip-warning'}`;
  els.setStatus.textContent = ready ? `${count} / 4 READY` : `${count} / 4 COLLECTING`;
  els.fill.disabled = transferBusy || !ready || state.showAll;
  els.clearTripo.disabled = transferBusy;
  els.clearCurrent.disabled = state.showAll || count === 0;
  els.clearAll.disabled = !state.order.some((id) => typeof id === 'string' && id);
}

async function clearTripoOnly() {
  const tab = await findTripoTab();
  if (!tab?.id) {
    showToast('Open Tripo3D Multiview in another tab first.', 'error');
    await refreshTripoStatus();
    return;
  }

  transferBusy = true;
  els.clearTripo.textContent = 'Clearing…';
  updateActions(getSets()[state.activeSet] || []);
  try {
    const result = await ext.tabs.sendMessage(tab.id, { type: 'TMP_CLEAR_MULTIVIEW' });
    if (!result?.ok) {
      const detail = result?.diagnostic ? `\n${JSON.stringify(result.diagnostic)}` : '';
      throw new Error((result?.error || 'Unable to clear Tripo.') + detail);
    }
    const removed = Number(result.removed || 0);
    showToast(removed ? `Cleared ${removed} Tripo view${removed === 1 ? '' : 's'}.` : 'Tripo multiview is already clear.', 'success');
  } catch (error) {
    showToast(
      String(error?.message || error).includes('Receiving end does not exist')
        ? 'Refresh the Tripo tab once after installing/updating this extension.'
        : String(error?.message || error),
      'error'
    );
  } finally {
    transferBusy = false;
    els.clearTripo.textContent = '清空 Tripo';
    updateActions(getSets()[state.activeSet] || []);
  }
}

async function fillCurrentSetToTripo() {
  const set = getSets()[state.activeSet] || [];
  const count = countImages(set);
  if (count < MIN_SEND_VIEWS) return;

  const tab = await findTripoTab();
  if (!tab?.id) {
    showToast('Open Tripo3D Multiview in another tab first.', 'error');
    await refreshTripoStatus();
    return;
  }

  transferBusy = true;
  els.fill.textContent = 'Filling…';
  updateActions(set);
  try {
    if (settings.autoClearBeforeFill !== false) {
      const cleared = await ext.tabs.sendMessage(tab.id, { type: 'TMP_CLEAR_MULTIVIEW' });
      if (!cleared?.ok) {
        const detail = cleared?.diagnostic ? `\n${JSON.stringify(cleared.diagnostic)}` : '';
        throw new Error((cleared?.error || 'Auto-clear Tripo failed.') + detail);
      }
    }

    const reset = await ext.tabs.sendMessage(tab.id, { type: 'TMP_RESET_MULTIVIEW' });
    if (!reset?.ok) throw new Error('Refresh the Tripo tab once after updating this extension.');

    // Stage only occupied slots. Empty directions stay empty instead of shifting later views forward.
    for (let i = 0; i < 4; i++) {
      const id = set[i];
      if (!id) continue;
      const record = await getImage(id);
      if (!record?.blob) throw new Error(`Missing ${DIRECTIONS[i]} image.`);
      const payload = {
        direction: DIRECTIONS[i].toLowerCase(),
        name: `${DIRECTIONS[i].toLowerCase()}.${extensionFor(record.type)}`,
        type: record.type || 'image/png',
        dataUrl: await blobToDataUrl(record.blob)
      };
      const staged = await ext.tabs.sendMessage(tab.id, {
        type: 'TMP_STAGE_IMAGE',
        index: i,
        image: payload
      });
      if (!staged?.ok) throw new Error(staged?.error || `Failed to stage ${DIRECTIONS[i]}.`);
    }

    const result = await ext.tabs.sendMessage(tab.id, { type: 'TMP_COMMIT_MULTIVIEW' });
    if (!result?.ok) {
      const detail = result?.diagnostic ? `\n${JSON.stringify(result.diagnostic)}` : '';
      throw new Error((result?.error || 'Unable to fill Tripo.') + detail);
    }
    showToast(result.message || `Filled ${count} Tripo multiview slots.`, 'success');
  } catch (error) {
    showToast(
      String(error?.message || error).includes('Receiving end does not exist')
        ? 'Refresh the Tripo tab once after installing/updating this extension.'
        : String(error?.message || error),
      'error'
    );
  } finally {
    transferBusy = false;
    els.fill.textContent = 'Fill Tripo';
    updateActions(getSets()[state.activeSet] || []);
  }
}

async function findTripoTab() {
  const tabs = await ext.tabs.query({ url: ['*://tripo3d.ai/*', '*://*.tripo3d.ai/*'] });
  if (!tabs.length) return null;
  const active = tabs.find((tab) => tab.active);
  return active || tabs[tabs.length - 1];
}

async function refreshTripoStatus() {
  try {
    const tab = await findTripoTab();
    if (tab?.id) {
      els.tripoStatus.className = 'chip chip-success';
      els.tripoStatus.textContent = 'TRIPO CONNECTED';
      els.tripoStatus.title = tab.title || tab.url || '';
    } else {
      els.tripoStatus.className = 'chip chip-warning';
      els.tripoStatus.textContent = 'TRIPO NOT FOUND';
      els.tripoStatus.title = 'Open tripo3d.ai in another tab.';
    }
  } catch (_) {
    els.tripoStatus.className = 'chip chip-warning';
    els.tripoStatus.textContent = 'TRIPO UNKNOWN';
  }
}

async function deleteCurrentSet() {
  const sets = getSets();
  const current = sets[state.activeSet] || [];
  const currentIds = current.filter((id) => typeof id === 'string' && id);
  if (!currentIds.length || state.showAll) return;

  const setLabel = `SET ${pad(state.activeSet + 1)}`;
  if (!confirm(`删除 ${setLabel} 及其中的 ${currentIds.length} 张图片？`)) return;

  await deleteImages(currentIds);
  state.order.splice(state.activeSet * 4, 4);
  trimTrailingEmptySlots();

  const remainingSets = getSets();
  state.activeSet = remainingSets.length
    ? Math.min(state.activeSet, remainingSets.length - 1)
    : 0;
  state.showAll = false;

  await saveState();
  await render();
  showToast(`${setLabel} 已删除。`, 'success');
}

async function clearAll() {
  if (!state.order.some((id) => typeof id === 'string' && id)) return;
  if (!confirm('删除全部组和所有图片？')) return;
  await clearImages();
  state = { order: [], activeSet: 0, showAll: false };
  await saveState();
  await render();
  showToast('全部图片已删除。', 'success');
}

function getSets() {
  const sets = [];
  for (let i = 0; i < state.order.length; i += 4) sets.push(state.order.slice(i, i + 4));
  return sets;
}

function trimTrailingEmptySlots() {
  while (state.order.length && !state.order[state.order.length - 1]) state.order.pop();
}

async function loadState() {
  const stored = await ext.storage.local.get(STORAGE_KEY);
  const saved = stored[STORAGE_KEY];
  if (!saved || typeof saved !== 'object') return;
  state.order = Array.isArray(saved.order)
    ? saved.order.map((id) => (typeof id === 'string' && id ? id : null))
    : [];
  trimTrailingEmptySlots();
  state.activeSet = Number.isInteger(saved.activeSet) ? saved.activeSet : 0;
  state.showAll = Boolean(saved.showAll);
}

async function saveState() {
  trimTrailingEmptySlots();
  await ext.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadSettings() {
  const stored = await ext.storage.local.get(SETTINGS_KEY);
  settings = { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) };
  els.autoClearTripo.checked = settings.autoClearBeforeFill !== false;
}

async function saveSettings() {
  await ext.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function sanitizeState() {
  const existing = new Set(await getAllImageIds());
  state.order = state.order.map((id) => (
    typeof id === 'string' && existing.has(id) ? id : null
  ));
  trimTrailingEmptySlots();
  await saveState();
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function putImage(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    const request = tx.objectStore(STORE_IMAGES).put(record);
    request.onsuccess = () => resolve(record.id);
    request.onerror = () => reject(request.error);
  });
}

async function getImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readonly');
    const request = tx.objectStore(STORE_IMAGES).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllImageIds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readonly');
    const request = tx.objectStore(STORE_IMAGES).getAllKeys();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteImages(ids) {
  const validIds = (ids || []).filter((id) => typeof id === 'string' && id);
  if (!validIds.length) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_IMAGES);
    for (const id of validIds) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Delete transaction aborted.'));
  });
}

async function clearImages() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    const request = tx.objectStore(STORE_IMAGES).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read clipboard image.'));
    reader.readAsDataURL(blob);
  });
}

function extensionFor(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return map[String(type || '').toLowerCase()] || 'png';
}

function revokeObjectUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function showToast(message, kind = '') {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast ${kind}`.trim();
  els.toast.hidden = false;
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4200);
}
