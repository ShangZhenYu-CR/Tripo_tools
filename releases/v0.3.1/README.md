# Tripo Multiview Paste v0.3.1

First public packaged release.

## Download

- `TripoMultiviewPaste-v0.3.1.crx`

## Install

1. Open `edge://extensions/`.
2. Enable **Developer mode**.
3. Drag `TripoMultiviewPaste-v0.3.1.crx` onto the extensions page.
4. Confirm installation.
5. Refresh an already-open Tripo3D tab once after installation.
6. Open Tripo Multiview mode and click the extension icon.

## Current workflow

- Paste clipboard images with `Ctrl+V`.
- Every 4 images become one set.
- Verified direction order: `FRONT / LEFT / RIGHT / BACK`.
- Switch between sets or open `ALL SETS`.
- Drag images within the current set to reorder.
- `删除当前` removes only the active set.
- `全部删除` clears all sets and local image data.
- `Fill Tripo` fills the active 4-view set into Tripo Multiview.
- UI opens as a 760×600 in-page floating panel on Tripo.

## Package identity

- Version: `0.3.1`
- Extension ID: `bmejmmejadcfecpknjdijgjmjdjlhfca`
- SHA-256: `20c4799abafc7366a2baad6d601f083dc817d063c20dc819ff03547c050d32d2`

## Signing key

The `.pem` signing key is intentionally **not** included in this public repository or package. Future CRX builds must reuse the same private key so the Extension ID remains unchanged.
