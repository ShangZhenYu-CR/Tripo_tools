# Tripo Tools

Standalone Edge / Chromium tools for Tripo3D workflows.

## Tripo Multiview Paste

A standalone Edge extension for clipboard-first Tripo3D Multiview uploads.

### Current workflow

1. Open Tripo3D and switch to **Multiview** mode.
2. Open `edge://extensions/` and enable **Developer mode**.
3. Install the extension either by loading this repository as unpacked, or by using a locally packed CRX.
4. Refresh the already-open Tripo tab once after installing or updating the extension.
5. Click the **Tripo Multiview Paste** extension icon.
6. A floating panel opens inside the Tripo page.
7. Paste images with `Ctrl+V`.
8. Every 4 images automatically become one set.
9. The verified Tripo order is:
   - `FRONT`
   - `LEFT`
   - `RIGHT`
   - `BACK`
10. Drag cards within the current set if the order needs correction.
11. Use the small `SET 01 / SET 02 / ... / ALL SETS` buttons to switch sets.
12. Click **Fill Tripo** to populate the current set into the Tripo Multiview upload UI.

### Floating panel UI

The extension opens a **760 × 600 px** floating panel inside the Tripo page instead of opening a new browser tab.

The four current views occupy most of the panel as a 2 × 2 grid. `ALL SETS` is only for overview/navigation.

### Storage

- Images are stored in the extension's own IndexedDB.
- Set order/state is stored in the extension's own `storage.local`.
- It does not depend on Reference Hub, Reference Image Downloader, Native Messaging, a local server, or Tripo API keys.

### Tripo transfer

Each image is staged to the Tripo content script one at a time, then the four-view set is committed. The adapter first tries to resolve upload slots from nearby direction labels; if the page only exposes four generic image inputs, the verified fallback order is `FRONT / LEFT / RIGHT / BACK`.

If Tripo changes its DOM and the adapter cannot safely resolve the upload targets, the panel shows an error and the content script returns a diagnostic instead of silently filling uncertain inputs.

## Install with Developer Mode

### Option A — Load unpacked

1. Open `edge://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository root folder.
5. Refresh the Tripo page once.

### Option B — Pack and install CRX

The repository includes a Windows one-click packer:

- `pack-extension.cmd` — double-click launcher
- `pack-extension.ps1` — packaging logic

Double-click `pack-extension.cmd`.

On the **first** run it creates:

```text
private/TripoMultiviewPaste.pem
dist/TripoMultiviewPaste-vX.X.X.crx
```

On later runs the same PEM key is reused automatically, so the extension ID stays stable.

Important:

- **Back up `private/TripoMultiviewPaste.pem`.**
- **Never upload the PEM file to GitHub or share it publicly.**
- `private/`, `dist/`, `*.pem`, and `*.crx` are ignored by Git.
- When releasing a new internal version, update `manifest.json` version first, then run `pack-extension.cmd` again.

To install the CRX, keep **Developer mode** enabled and try dragging the generated `.crx` onto `edge://extensions/`. If the local Edge build or company policy rejects local CRX installation, use **Load unpacked** as the fallback; the CRX can still be kept as the signed/archive package.

## Files

- `manifest.json` — standalone MV3 extension manifest
- `background.js` — extension icon → Tripo floating panel toggle
- `popup.html` — floating-panel document
- `popup.css` — ColdRain-style floating-panel UI
- `popup.js` — clipboard grouping, IndexedDB persistence, set navigation, drag reorder, Tripo transfer
- `panel-close.js` — floating-panel close action
- `content-tripo.js` — Tripo page panel host + upload adapter
- `pack-extension.cmd` — one-click Windows CRX packer
- `pack-extension.ps1` — Edge CRX packaging script
