import * as vscode from 'vscode';
import { SpriteSheetEditorProvider } from './spriteSheetEditor';

export function activate(context: vscode.ExtensionContext) {
    const provider = new SpriteSheetEditorProvider(context);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'spriteHelper.spriteSheetViewer',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('spriteHelper.openSpriteSheet', async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    uri,
                    'spriteHelper.spriteSheetViewer'
                );
            }
        })
    );
}

export function deactivate() {}
