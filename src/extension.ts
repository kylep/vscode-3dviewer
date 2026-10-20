import * as vscode from 'vscode';
import { MeshViewerProvider } from './MeshViewerProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new MeshViewerProvider(context);
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(
        '3dviewer.viewer', provider, { supportsMultipleEditorsPerDocument: false }));
    return { renders: provider.renders };
}
