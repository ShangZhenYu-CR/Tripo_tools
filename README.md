# Tripo Tools

Standalone Edge / Chromium tools for Tripo3D workflows.

## Tripo Multiview Paste

A standalone Edge extension for clipboard-first Tripo3D Multiview uploads.

### Current workflow

1. Open Tripo3D and switch to **Multiview** mode.
2. Open `edge://extensions/` and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.
4. Refresh the already-open Tripo tab once after installing or updating the extension.
5. Click the **Tripo Multiview Paste** extension icon.
6. Keep the popup open and paste images with `Ctrl+V`.
7. Every 4 images automatically become one set.
8. The verified Tripo order is:
   - `FRONT`
   - `LEFT`
   - `RIGHT`
   - `BACK`
9. Drag cards within the current set if the order needs correction.
10. Use the small `SET 01 / SET 02 / ... / ALL SETS` buttons to switch sets.
11. Click **Fill Tripo** to populate the current set into the Tripo Multiview upload UI.

### Popup UI

The extension uses an Edge action popup instead of opening a new browser tab.

Current popup target size: **760 × 600 px**.

The four current views occupy most of the popup as a 2 × 2 grid. `ALL SETS` is only for overview/navigation.

### Storage

- Images are stored in the extension's own IndexedDB.
- Set order/state is stored in the extension's own `storage.local`.
- It does not depend on Reference Hub, Reference Image Downloader, Native Messaging, a local server, or Tripo API keys.

### Tripo transfer

Each image is sent to the Tripo content script one at a time, then the four-view set is committed. The adapter first tries to resolve upload slots from nearby direction labels; if the page only exposes four generic image inputs, the verified fallback order is `FRONT / LEFT / RIGHT / BACK`.

If Tripo changes its DOM and the adapter cannot safely resolve the upload targets, the popup shows an error and the content script returns a diagnostic instead of silently filling uncertain inputs.

## Files

- `manifest.json` — standalone MV3 extension manifest
- `popup.html` — compact popup shell
- `popup.css` — ColdRain-style popup UI
- `popup.js` — clipboard grouping, IndexedDB persistence, set navigation, drag reorder, Tripo transfer
- `content-tripo.js` — Tripo page upload adapter
