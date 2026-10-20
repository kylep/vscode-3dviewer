# 3D Viewer (Reviewed Local)

Local read-only build of stef-levesque/vscode-3dviewer, based on upstream
95408588d4f2987f0ae579b83e543f3f364bc467. This is a locally modified edition,
not an official upstream release. Extension ID: local-reviewed.vscode-3dviewer.

Supports local STL, OBJ and PLY files up to 32 MiB and 500,000 triangles.
Open a file, then choose **Reopen Editor With → 3D Mesh Viewer (Reviewed Local)**.
Drag to rotate; scroll to zoom. Use Fit and Wireframe in the toolbar.

This package has no editor/export commands, URL preview, model-referenced
textures/material downloads, scene scripting, telemetry, or file write handlers.
Old 3DS/DAE/FBX preview and THREE.js editor features are excluded. It uses
Three.js 0.186.1 with a strict no-network, nonce-only script policy. Only the
selected file is read by the host; no workspace files are exposed as webview
resources. Current dependencies are pinned in package-lock.json and fetched
with lifecycle scripts disabled. The source retains upstream files for review;
only the explicitly listed reviewed files enter the VSIX.

Rebuild: npm ci --ignore-scripts; npm run compile; python3 scripts/build-vsix.py
Checks: npm test; npx playwright install chromium; npm run test:browser
Browser checks use the pinned Playwright development dependency.

Install: code --install-extension artifacts/3d-viewer-reviewed-0.2.3.vsix
A VSIX install is pinned with auto-update disabled. Check the per-extension
Auto Update setting before opting into any later version. This build uses its
own local publisher ID to avoid replacing it with the upstream Marketplace build.

Detailed security findings, package hashes and limitations are in
SECURITY-REVIEW.md. This is a focused review, not a claim
of formal verification or protection from OS/GPU/VS Code vulnerabilities.
