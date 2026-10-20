# Focused security review — 2026-10-19

## Decision and scope

Deploy the modified read-only local build, not the unmodified upstream package.
This is a focused source, dependency, package and behavior review, not a formal
security audit or a guarantee against all parser, browser, GPU or VS Code bugs.
No intentional credential theft, telemetry or host command execution was found
in the reviewed first-party entry points. The findings below still warrant
hardening before use on a development machine.

Upstream: https://github.com/stef-levesque/vscode-3dviewer
Commit: `95408588d4f2987f0ae579b83e543f3f364bc467` (2021-02-14).
Fork: https://github.com/kylep/vscode-3dviewer
Published Marketplace package reviewed: `slevesque.vscode-3dviewer` 0.2.2.
Decompressed VSIX SHA-256:
`68ea9d65892c20f8735a86fd3f84eb1ddf8cf2ff585a8873b8f122014237a299`.

The 454-file published VSIX contains additional stale compiled entry points
not represented by the current four-file TypeScript source tree. The source
and published package must not be treated as equivalent builds. Raw downloaded
package and detailed local test evidence are intentionally not committed.

## Findings and resolution

1. **High: message-driven JavaScript evaluation in bundled renderer.**
   Upstream `media/build/three.js:8-10` installs a window message listener that
   calls `eval(event.data.eval)` without sender/schema validation. The published
   VSIX also contains this hook. This establishes an execution primitive in
   the webview, not demonstrated host/OS remote code execution. The local
   package replaces that modified vendored renderer and exposes no eval message.
2. **High: webview policy permits evaluated and data/blob scripts.**
   Upstream `src/MeshViewerProvider.ts:165` and `src/MeshEditorProvider.ts:270`
   allow unsafe-eval and broad script sources despite comments claiming nonce
   restrictions. No explicit localResourceRoots restrict the default workspace
   resource access. The replacement uses nonce-only scripts, default-src none,
   connect-src none, and asset-only local roots. Only the explicitly opened
   model is read by the host and passed as bounded data; paths never come from
   renderer messages. Command URIs and forms are disabled.
3. **Medium: unchecked editor-to-host writes in current GitHub source.**
   Upstream `src/MeshEditorProvider.ts:308-310` uses message.extension and
   message.text directly to compute and write an export without a suffix
   allowlist, size limit or save confirmation. Path traversal was not separately
   demonstrated. This handler is absent from the older published provider;
   the finding applies to the reviewed GitHub source. The local build excludes
   the editor entirely and contains no write message handler.
4. **High: vulnerable untracked vendored dependencies.**
   Three.js identifies itself as 89dev, within the affected range for
   [CVE-2020-28496](https://github.com/advisories/GHSA-fq6p-x6j3-cmmq).
   The old dat.gui copy predates the fixed release for
   [CVE-2020-7755](https://github.com/advisories/GHSA-chwr-hf3w-c984).
   Original npm audit reports zero because these runtime assets are copied
   files outside its dependency graph. Checked npm's bulk advisory API as well
   as the GitHub advisories. The replacement pins Three.js 0.186.1 and removes
   dat.gui and every legacy runtime asset from the installable package.
5. **Low: unnecessary package surface and stale outputs.**
   Package only an explicit 12-file allowlist, including the two VSIX metadata
   files, and compare every archived byte to the build inputs. Legacy source
   remains in Git history and the checkout for comparison, but is not shipped.

## Installed build behavior

Extension ID: `local-reviewed.vscode-3dviewer`, version 0.2.3. It is a local
modified edition and is not published to the Marketplace. Supports STL, OBJ
and PLY only, up to 32 MiB, 500,000 triangles and 1,500,000 vertices. The old
THREE.js editor, exports, URL previews, 3DS/DAE/FBX scenes, animations and external
textures/material loading are excluded. This is a deliberate reduction to the
mesh-viewing use case; it is not feature-equivalent to upstream.

The extension host reads only the user-opened file with a bounded file-handle
read. It has no command runner, network client, or file writes. The browser
bundle includes generic renderer loading utilities, but this entry point uses
only parse APIs, rejects resource URLs via LoadingManager, and additionally
blocks requests in CSP. The host accepts only readiness/render notifications,
never file paths, commands or save payloads. Arbitrary model strings are never
inserted as HTML. Nonce generation uses crypto.randomBytes.

VSIX installation pins the local extension with auto-update disabled. Verify
the installed metadata after installation. The local publisher identity also
avoids silently replacing this package with an upstream Marketplace release.
Do not enable automatic updates without reviewing the replacement version.

## Build and verification

- `npm ci --ignore-scripts`: exact lockfile; no dependency lifecycle hooks.
  esbuild's platform executable is supplied by its pinned optional package.
- `npm audit`: zero known advisories across build and bundled dependencies.
- `npm test`: five focused host/file boundary tests passed.
- `npm run test:browser`: real WebGL rendering of the 12-triangle cube, wireframe
  and fit controls, inline script blocking, ignored eval messages, blocked fetch,
  invalid STL and oversized triangle counts, malicious OBJ names/material URLs,
  and PLY parsing all passed. No network resources beyond the test page and
  its two assets were requested.
- Real VS Code 1.141.0 extension-host/webview test: cube rendered successfully
  with 12 triangles and 36 vertices.
- Reproducible VSIX builder: fixed archive timestamps, explicit allowlist,
  per-file SHA-256 and a package SHA-256 in artifacts/reviewed-vsix-manifest.json.
- CI uses pinned action revisions, read-only repository permissions and the
  same install, audit, unit, browser and packaging checks. CI is additional
  verification; local checks passed before the push.

The development dependency advisories are a snapshot, not a future guarantee.
The renderer is an integrity-pinned upstream npm package with sampled code and
behavior review; every line of Three.js, Node, Chromium and VS Code was not
manually audited. File/geometry caps reduce resource exhaustion but cannot
eliminate every malicious-parser or GPU workload. VS Code extensions still
have the editor's permissions; this hardening is application policy rather
than an OS sandbox around the extension host.

## Ratings

| Dimension | Assessment |
|---|---|
| Security | Upstream needs hardening; local package passes the focused boundaries above. |
| Performance | Bounded file/geometry sizes; rendering stays in the webview. |
| Correctness | Cube, OBJ and PLY render; unsupported formats are refused explicitly. |
| Maintainability | Lockfile, source provenance, tests, CI and deterministic package recipe retained in fork. |

[VS Code webview guidance](https://code.visualstudio.com/api/extension-guides/webview)
and [VSIX auto-update behavior](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)
were checked against current official documentation.
