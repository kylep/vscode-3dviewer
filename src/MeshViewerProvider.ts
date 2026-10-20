import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { readModel } from './model';

export class MeshViewerProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
    public readonly renders = new Map<string, {triangles: number; vertices: number}>();
    constructor(private readonly context: vscode.ExtensionContext) {}

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        if (uri.scheme !== 'file') throw new Error('Only explicitly opened local model files are supported.');
        await readModel(uri.fsPath);
        return { uri, dispose() {} };
    }

    async resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel): Promise<void> {
        const assets = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'reviewed');
        panel.webview.options = {
            enableScripts: true, enableCommandUris: false, enableForms: false,
            localResourceRoots: [assets],
        };
        const nonce = randomBytes(24).toString('base64');
        const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'viewer.js'));
        const style = panel.webview.asWebviewUri(vscode.Uri.joinPath(assets, 'viewer.css'));
        const sendModel = async () => {
            try {
                const model = await readModel(document.uri.fsPath);
                await panel.webview.postMessage({type: 'model', ...model});
            } catch (error) {
                await panel.webview.postMessage({type: 'error', message: String(error)});
            }
        };
        const receiver = panel.webview.onDidReceiveMessage((message: unknown) => {
            if (!message || typeof message !== 'object') return;
            const m = message as Record<string, unknown>;
            if (m.type === 'ready') void sendModel();
            if (m.type === 'rendered' && Number.isSafeInteger(m.triangles) && Number.isSafeInteger(m.vertices)
                && (m.triangles as number) > 0 && (m.vertices as number) > 0) {
                this.renders.set(document.uri.toString(), {
                    triangles: m.triangles as number, vertices: m.vertices as number,
                });
            }
            // There are no write, URL-open, command-execution or path-selection messages.
        });
        panel.onDidDispose(() => { receiver.dispose(); this.renders.delete(document.uri.toString()); });
        const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src ${panel.webview.cspSource}; img-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';`;
        panel.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style}"><title>Reviewed 3D Viewer</title></head><body>
<header><button id="fit" type="button">Fit</button><label><input type="checkbox" id="wireframe"> Wireframe</label>
<span id="status" role="status">Loading model…</span></header>
<main id="viewport" aria-label="Interactive 3D model"></main>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
    }
}
