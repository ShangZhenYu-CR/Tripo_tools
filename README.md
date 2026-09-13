# Tripo Tools

Standalone Edge / Chromium tools for Tripo3D workflows.

## Tripo Multiview Paste

A standalone Edge extension for clipboard-first Tripo3D Multiview uploads.

### Current development version

- `v0.3.3` on `main`
- `main` is the sole development baseline for this tool; future changes should continue directly from `main` unless explicitly requested otherwise.
- Based directly on the existing `v0.3.2` sparse 3-view implementation.
- Keeps sparse 3-view sets: any one of `FRONT / LEFT / RIGHT / BACK` may be empty.
- Empty slots remain valid drag targets.
- `Fill Tripo` remains enabled for both 3-view and 4-view sets.
- Empty directions are skipped without shifting later views into the wrong slot.
- Adds **清空 Tripo** to remove the current Tripo Multiview images without deleting images stored in the extension.
- Adds **Fill 前清空**, enabled by default. When enabled, `Fill Tripo` first clears the existing Tripo Multiview state, then fills the current 3-view or 4-view set.

### Current workflow

1. Open Tripo3D and switch to **Multiview** mode.
2. Open `edge://extensions/` and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.
4. Refresh the already-open Tripo tab once after installing or updating the extension.
5. Click the **Tripo Multiview Paste** extension icon to toggle the in-page floating panel.
6. Paste images with `Ctrl+V`.
7. Images are collected into four directional slots per set. A set may contain either 3 or 4 images.
8. The verified Tripo order is:
   - `FRONT`
   - `LEFT`
   - `RIGHT`
   - `BACK`
9. Drag cards within the current set to correct the direction. Empty slots also accept drops.
10. Use the small `SET 01 / SET 02 / ... / ALL SETS` buttons to switch sets.
11. Keep **Fill 前清空** enabled if the previous Tripo Multiview images should be removed automatically.
12. Click **Fill Tripo** when the current set has at least 3 images. Only occupied directions are sent.
13. Use **清空 Tripo** when you only want to clear Tripo without changing the extension's saved sets.

### Floating panel UI

Clicking the extension icon toggles a **760 × 600 px** floating panel inside the Tripo page instead of opening a new browser tab.

The four current views occupy most of the panel as a 2 × 2 grid. `ALL SETS` is only for overview/navigation.

### Storage

- Images are stored in the extension's own IndexedDB.
- Set order/state and the auto-clear preference are stored in the extension's own `storage.local`.
- Sparse slots are preserved, so moving an image to `BACK` does not collapse the set back into sequential order.
- It does not depend on Reference Hub, Reference Image Downloader, Native Messaging, a local server, or Tripo API keys.

### Tripo transfer

Each occupied image is sent to the Tripo content script one at a time, then the set is committed. Both 3-view and 4-view sets are supported. Empty directions are not sent, and later views keep their original directional slot instead of shifting forward.

When auto-clear is enabled, the content script first looks for explicit Tripo clear/remove controls around the Multiview upload slots. It only uses controls with clear/remove/delete/close semantics; if the page still appears to contain uploaded previews but no safe clear control can be resolved, the transfer stops and returns a diagnostic instead of blindly clicking the page.

The adapter first tries to resolve upload slots from nearby direction labels; if the page exposes four generic image inputs, the verified fallback order is `FRONT / LEFT / RIGHT / BACK`.

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
- `popup.js` — clipboard grouping, IndexedDB persistence, sparse set slots, drag reorder, Tripo clear/fill flow
- `panel-close.js` — closes the in-page floating panel
- `content-tripo.js` — Tripo page upload/clear adapter and floating panel host
- `pack-extension.cmd` / `pack-extension.ps1` — local CRX packaging helpers
