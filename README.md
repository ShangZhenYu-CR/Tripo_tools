# Tripo Tools

Standalone Edge / Chromium tools for Tripo3D workflows.

## Tripo Multiview Paste

A standalone Edge extension for clipboard-first Tripo3D Multiview uploads.

### Current packaged release

- `v0.3.1`
- CRX package: `releases/v0.3.1/TripoMultiviewPaste-v0.3.1.crx`
- Release notes: `releases/v0.3.1/README.md`

### Current workflow

1. Open Tripo3D and switch to **Multiview** mode.
2. Open `edge://extensions/` and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder, or install the packaged CRX from `releases/v0.3.1/`.
4. Refresh the already-open Tripo tab once after installing or updating the extension.
5. Click the **Tripo Multiview Paste** extension icon.
6. Paste images with `Ctrl+V`.
7. Every 4 images automatically become one set.
8. The verified Tripo order is:
   - `FRONT`
   - `LEFT`
   - `RIGHT`
   - `BACK`
9. Drag cards within the current set if the order needs correction.
10. Use the small `SET 01 / SET 02 / ... / ALL SETS` buttons to switch sets.
11. Click **Fill Tripo** to populate the current set into the Tripo Multiview upload UI.

### Floating panel UI

Clicking the extension icon toggles a **760 × 600 px** floating panel inside the Tripo page instead of opening a new browser tab.

The four current views occupy most of the panel as a 2 × 2 grid. `ALL SETS` is only for overview/navigation.

### Storage

- Images are stored in the extension's own IndexedDB.
- Set order/state is stored in the extension's own `storage.local`.
- It does not depend on Reference Hub, Reference Image Downloader, Native Messaging, a local server, or Tripo API keys.

### Tripo transfer

Each image is sent to the Tripo content script one at a time, then the four-view set is committed. The adapter first tries to resolve upload slots from nearby direction labels; if the page only exposes four generic image inputs, the verified fallback order is `FRONT / LEFT / RIGHT / BACK`.

If Tripo changes its DOM and the adapter cannot safely resolve the upload targets, the panel shows an error and the content script returns a diagnostic instead of silently filling uncertain inputs.

## Developer mode + CRX packaging

Run `pack-extension.cmd` on Windows to build a CRX with the local Edge executable.

- First run generates `private/TripoMultiviewPaste.pem` and a CRX under `dist/`.
- Future runs reuse the same PEM so the Extension ID remains unchanged.
- `private/`, `dist/`, `*.pem`, `*.crx`, `*private-key*`, `.env*`, `*.key`, `*.p12`, and `*.pfx` are ignored to reduce the chance of exposing private material.
- The signing PEM must never be committed to this public repository.

## Files

- `manifest.json` — standalone MV3 extension manifest
- `background.js` — action click handler that toggles the Tripo in-page panel
- `popup.html` — floating panel shell
- `popup.css` — ColdRain-style panel UI
- `popup.js` — clipboard grouping, IndexedDB persistence, set navigation, drag reorder, Tripo transfer
- `panel-close.js` — closes the in-page floating panel
- `content-tripo.js` — Tripo page upload adapter and floating panel host
- `pack-extension.cmd` / `pack-extension.ps1` — local CRX packaging helpers
