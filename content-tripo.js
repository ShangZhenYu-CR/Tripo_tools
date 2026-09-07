const ext = globalThis.browser ?? globalThis.chrome;
// Current Tripo Multiview slot order verified by the real page: FRONT / LEFT / RIGHT / BACK.
const DIRECTION_ORDER = ['front', 'left', 'right', 'back'];
const stagedImages = new Array(4).fill(null);
const PANEL_HOST_ID = 'tripo-multiview-paste-floating-panel';

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'TMP_TOGGLE_PANEL') {
    const open = toggleFloatingPanel();
    sendResponse({ ok: true, open });
    return;
  }

  if (message.type === 'TMP_STAGE_IMAGE') {
    try {
      const index = Number(message.index);
      if (!Number.isInteger(index) || index < 0 || index > 3 || !message.image?.dataUrl) {
        throw new Error('Invalid staged image.');
      }
      stagedImages[index] = message.image;
      sendResponse({ ok: true, staged: index });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
    return;
  }

  if (message.type === 'TMP_COMMIT_MULTIVIEW') {
    const images = stagedImages.slice();
    stagedImages.fill(null);
    applyMultiview(images)
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: String(error?.message || error),
        diagnostic: inspectUploadUi()
      }));
    return true;
  }

  if (message.type === 'TMP_INSPECT_TRIPO') {
    sendResponse({ ok: true, diagnostic: inspectUploadUi() });
  }
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'tripo-multiview-paste') return;
  if (data.type === 'TMP_CLOSE_PANEL') closeFloatingPanel();
});

function toggleFloatingPanel() {
  const existing = document.getElementById(PANEL_HOST_ID);
  if (existing) {
    existing.remove();
    return false;
  }

  const host = document.createElement('div');
  host.id = PANEL_HOST_ID;
  host.setAttribute('data-tripo-multiview-paste', 'panel');

  const styles = {
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: 'min(760px, calc(100vw - 32px))',
    height: 'min(600px, calc(100vh - 32px))',
    zIndex: '2147483647',
    border: '0',
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'transparent',
    boxShadow: '0 18px 54px rgba(0, 0, 0, 0.42)',
    isolation: 'isolate',
    pointerEvents: 'auto'
  };
  for (const [key, value] of Object.entries(styles)) host.style[key] = value;

  const shadow = host.attachShadow({ mode: 'closed' });
  const iframe = document.createElement('iframe');
  iframe.src = ext.runtime.getURL('popup.html');
  iframe.title = 'Tripo Multiview Paste';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.display = 'block';
  iframe.style.border = '0';
  iframe.style.margin = '0';
  iframe.style.padding = '0';
  iframe.style.background = 'transparent';
  iframe.style.borderRadius = '16px';
  shadow.appendChild(iframe);

  (document.body || document.documentElement).appendChild(host);
  return true;
}

function closeFloatingPanel() {
  document.getElementById(PANEL_HOST_ID)?.remove();
}

async function applyMultiview(images) {
  if (!Array.isArray(images) || images.length !== 4 || images.some((image) => !image?.dataUrl)) {
    throw new Error('Expected exactly 4 staged multiview images.');
  }

  const normalized = DIRECTION_ORDER.map((direction, index) => ({
    direction,
    file: dataUrlToFile(
      images[index].dataUrl,
      images[index].name || `${direction}.png`,
      images[index].type
    )
  }));

  const resolution = resolveUploadInputs();
  if (resolution.mode === 'four-inputs') {
    for (let i = 0; i < 4; i++) {
      await applyFileToInput(resolution.inputs[i], normalized[i].file);
      await wait(180);
    }
    return {
      ok: true,
      message: 'Filled Tripo multiview inputs.',
      strategy: resolution.strategy,
      order: DIRECTION_ORDER
    };
  }

  if (resolution.mode === 'single-multiple-input') {
    await applyFilesToInput(resolution.input, normalized.map((entry) => entry.file));
    return {
      ok: true,
      message: 'Filled Tripo multiview input with 4 files.',
      strategy: 'single-multiple-input',
      order: DIRECTION_ORDER
    };
  }

  const dropResult = await tryDirectionalDropZones(normalized);
  if (dropResult.ok) return dropResult;

  throw new Error(
    `Could not resolve four Tripo image upload targets. Open Tripo Multiview mode first. Inputs found: ${resolution.totalInputs}.`
  );
}

function resolveUploadInputs() {
  const inputs = [...document.querySelectorAll('input[type="file"]')]
    .filter(isLikelyImageInput);

  if (inputs.length === 1 && inputs[0].multiple) {
    return { mode: 'single-multiple-input', input: inputs[0], totalInputs: 1 };
  }

  // First choice: map by nearby FRONT / LEFT / RIGHT / BACK context.
  const mapped = new Map();
  const used = new Set();
  for (const direction of DIRECTION_ORDER) {
    const match = inputs.find((input) => {
      if (used.has(input)) return false;
      return directionMatches(direction, getInputContext(input));
    });
    if (match) {
      mapped.set(direction, match);
      used.add(match);
    }
  }

  if (DIRECTION_ORDER.every((direction) => mapped.has(direction))) {
    return {
      mode: 'four-inputs',
      strategy: 'direction-context',
      inputs: DIRECTION_ORDER.map((direction) => mapped.get(direction)),
      totalInputs: inputs.length
    };
  }

  // Verified fallback for the current Tripo UI.
  if (inputs.length === 4) {
    return {
      mode: 'four-inputs',
      strategy: 'document-order-front-left-right-back',
      inputs,
      totalInputs: 4
    };
  }

  const likelyMultiview = inputs.filter((input) =>
    /(multi\s*view|multiview|reference|image|upload)/i.test(getInputContext(input))
  );
  if (likelyMultiview.length === 4) {
    return {
      mode: 'four-inputs',
      strategy: 'multiview-context-front-left-right-back',
      inputs: likelyMultiview,
      totalInputs: inputs.length
    };
  }

  return { mode: 'unresolved', inputs, totalInputs: inputs.length };
}

function isLikelyImageInput(input) {
  const accept = String(input.accept || '').toLowerCase();
  return !accept || accept.includes('image') || /\.png|\.jpe?g|\.webp|\.gif/.test(accept);
}

function getInputContext(input) {
  const chunks = [
    input.getAttribute('aria-label'),
    input.getAttribute('title'),
    input.getAttribute('name'),
    input.id,
    input.accept
  ].filter(Boolean);

  let node = input.parentElement;
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    const label = node.getAttribute?.('aria-label');
    const title = node.getAttribute?.('title');
    if (label) chunks.push(label);
    if (title) chunks.push(title);
    const text = String(node.innerText || '').trim();
    if (text && text.length <= 300) chunks.push(text);
  }
  return chunks.join(' ').toLowerCase();
}

function directionMatches(direction, text) {
  const patterns = {
    front: /\bfront\b|front view|正面|前视/,
    left: /\bleft\b|left view|左面|左视/,
    right: /\bright\b|right view|右面|右视/,
    back: /\bback\b|\brear\b|back view|背面|后视/
  };
  return patterns[direction].test(text);
}

async function applyFileToInput(input, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  setInputFiles(input, dt.files);
  dispatchInputEvents(input);
}

async function applyFilesToInput(input, files) {
  const dt = new DataTransfer();
  for (const file of files) dt.items.add(file);
  setInputFiles(input, dt.files);
  dispatchInputEvents(input);
}

function setInputFiles(input, fileList) {
  try {
    input.files = fileList;
    return;
  } catch (_) {}

  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  if (!descriptor?.set) throw new Error('Browser does not allow assigning files to this input.');
  descriptor.set.call(input, fileList);
}

function dispatchInputEvents(input) {
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

async function tryDirectionalDropZones(entries) {
  const targets = {};
  for (const entry of entries) {
    const target = findDirectionalDropTarget(entry.direction);
    if (!target) return { ok: false };
    targets[entry.direction] = target;
  }

  for (const entry of entries) {
    const dt = new DataTransfer();
    dt.items.add(entry.file);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      targets[entry.direction].dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        dataTransfer: dt
      }));
    }
    await wait(180);
  }

  return {
    ok: true,
    message: 'Dropped 4 views into Tripo multiview zones.',
    strategy: 'directional-drop-zones',
    order: DIRECTION_ORDER
  };
}

function findDirectionalDropTarget(direction) {
  const candidates = [...document.querySelectorAll(
    'button, label, [role="button"], [class*="upload"], [class*="drop"]'
  )];
  const scored = [];

  for (const node of candidates) {
    const text = `${node.getAttribute?.('aria-label') || ''} ${node.getAttribute?.('title') || ''} ${node.innerText || ''}`
      .trim().toLowerCase();
    if (!text || !directionMatches(direction, text)) continue;

    let score = 0;
    if (/upload|drop|image|reference/.test(text)) score += 10;
    if (node.matches('button, label, [role="button"]')) score += 5;
    const rect = node.getBoundingClientRect();
    if (rect.width > 80 && rect.height > 60) score += 3;
    scored.push({ node, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.node || null;
}

function dataUrlToFile(dataUrl, name, explicitType) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(String(dataUrl || ''));
  if (!match) throw new Error('Invalid clipboard image payload.');

  const type = explicitType || match[1] || 'image/png';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type, lastModified: Date.now() });
}

function inspectUploadUi() {
  const inputs = [...document.querySelectorAll('input[type="file"]')].map((input, index) => ({
    index,
    accept: input.accept || '',
    multiple: Boolean(input.multiple),
    name: input.name || '',
    id: input.id || '',
    context: getInputContext(input).slice(0, 280)
  }));

  return {
    url: location.href,
    title: document.title,
    verifiedOrder: DIRECTION_ORDER,
    fileInputCount: inputs.length,
    inputs
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
