import * as vscode from 'vscode';

export class SpriteSheetEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(document.uri, '..'),
                this.context.extensionUri
            ]
        };

        const imageUri = webviewPanel.webview.asWebviewUri(document.uri);
        webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview, imageUri);

        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'copy':
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage(`Copied: ${message.text}`);
                    break;
            }
        });
    }

    private getHtmlContent(webview: vscode.Webview, imageUri: vscode.Uri): string {
        const nonce = getNonce();

        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sprite Sheet Viewer</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 16px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            margin-bottom: 16px;
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-radius: 4px;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        label {
            font-weight: 500;
        }

        input[type="number"] {
            width: 60px;
            padding: 4px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }

        input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--vscode-focusBorder);
        }

        button {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: inherit;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .info-panel {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 16px;
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family), monospace;
        }

        .info-item {
            display: flex;
            gap: 8px;
        }

        .info-label {
            color: var(--vscode-descriptionForeground);
        }

        .info-value {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }

        .canvas-container {
            position: relative;
            display: inline-block;
            overflow: auto;
            max-width: 100%;
            max-height: calc(100vh - 200px);
            border: 1px solid var(--vscode-panel-border);
            background: repeating-conic-gradient(#808080 0% 25%, #a0a0a0 0% 50%) 50% / 16px 16px;
        }

        #spriteCanvas {
            display: block;
            image-rendering: pixelated;
            cursor: crosshair;
        }

        .highlight-box {
            position: absolute;
            border: 2px solid #ff0;
            background: rgba(255, 255, 0, 0.2);
            pointer-events: none;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
        }

        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .zoom-controls button {
            width: 28px;
            height: 28px;
            padding: 0;
            font-size: 16px;
            line-height: 1;
        }

        .zoom-value {
            min-width: 50px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="controls">
        <div class="control-group">
            <label for="tileWidth">Tile Width:</label>
            <input type="number" id="tileWidth" value="16" min="1" max="512">
        </div>
        <div class="control-group">
            <label for="tileHeight">Tile Height:</label>
            <input type="number" id="tileHeight" value="16" min="1" max="512">
        </div>
        <div class="control-group">
            <input type="checkbox" id="showGrid">
            <label for="showGrid">Show Grid</label>
        </div>
        <div class="control-group">
            <input type="checkbox" id="rowColFormat">
            <label for="rowColFormat">Row, Column format</label>
        </div>
        <div class="zoom-controls">
            <button id="zoomOut">-</button>
            <span class="zoom-value" id="zoomValue">100%</span>
            <button id="zoomIn">+</button>
        </div>
    </div>

    <div class="info-panel">
        <div class="info-item">
            <span class="info-label">Tile:</span>
            <span class="info-value" id="tileCoord">-</span>
            <button id="copyTile" title="Copy tile coordinates">Copy</button>
        </div>
        <div class="info-item">
            <span class="info-label">Pixel:</span>
            <span class="info-value" id="pixelCoord">-</span>
            <button id="copyPixel" title="Copy pixel coordinates">Copy</button>
        </div>
        <div class="info-item">
            <span class="info-label">Image Size:</span>
            <span class="info-value" id="imageSize">-</span>
        </div>
        <div class="info-item">
            <span class="info-label">Grid Size:</span>
            <span class="info-value" id="gridSize">-</span>
        </div>
    </div>

    <div class="canvas-container" id="canvasContainer">
        <canvas id="spriteCanvas"></canvas>
        <div class="highlight-box" id="highlightBox" style="display: none;"></div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        const canvas = document.getElementById('spriteCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('canvasContainer');
        const highlightBox = document.getElementById('highlightBox');

        const tileWidthInput = document.getElementById('tileWidth');
        const tileHeightInput = document.getElementById('tileHeight');
        const showGridCheckbox = document.getElementById('showGrid');
        const rowColFormatCheckbox = document.getElementById('rowColFormat');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const zoomValueDisplay = document.getElementById('zoomValue');

        const tileCoordDisplay = document.getElementById('tileCoord');
        const pixelCoordDisplay = document.getElementById('pixelCoord');
        const imageSizeDisplay = document.getElementById('imageSize');
        const gridSizeDisplay = document.getElementById('gridSize');
        const copyTileBtn = document.getElementById('copyTile');
        const copyPixelBtn = document.getElementById('copyPixel');

        let img = new Image();
        let zoom = 1;
        let currentTileX = -1;
        let currentTileY = -1;
        let currentPixelX = -1;
        let currentPixelY = -1;

        img.onload = () => {
            render();
            updateImageInfo();
        };
        img.src = '${imageUri}';

        function getTileSize() {
            return {
                width: parseInt(tileWidthInput.value) || 16,
                height: parseInt(tileHeightInput.value) || 16
            };
        }

        function render() {
            const tileSize = getTileSize();
            canvas.width = img.width * zoom;
            canvas.height = img.height * zoom;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (showGridCheckbox.checked) {
                drawGrid(tileSize);
            }

            updateHighlight();
        }

        function drawGrid(tileSize) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;

            const scaledTileWidth = tileSize.width * zoom;
            const scaledTileHeight = tileSize.height * zoom;

            for (let x = 0; x <= canvas.width; x += scaledTileWidth) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, canvas.height);
                ctx.stroke();
            }

            for (let y = 0; y <= canvas.height; y += scaledTileHeight) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(canvas.width, y + 0.5);
                ctx.stroke();
            }
        }

        function updateImageInfo() {
            const tileSize = getTileSize();
            imageSizeDisplay.textContent = img.width + ' x ' + img.height + ' px';
            const gridCols = Math.floor(img.width / tileSize.width);
            const gridRows = Math.floor(img.height / tileSize.height);
            gridSizeDisplay.textContent = gridCols + ' x ' + gridRows + ' tiles';
        }

        function updateHighlight() {
            if (currentTileX < 0 || currentTileY < 0) {
                highlightBox.style.display = 'none';
                return;
            }

            const tileSize = getTileSize();
            const scaledTileWidth = tileSize.width * zoom;
            const scaledTileHeight = tileSize.height * zoom;

            highlightBox.style.display = 'block';
            highlightBox.style.left = (currentTileX * scaledTileWidth) + 'px';
            highlightBox.style.top = (currentTileY * scaledTileHeight) + 'px';
            highlightBox.style.width = scaledTileWidth + 'px';
            highlightBox.style.height = scaledTileHeight + 'px';
        }

        function formatTileCoord(tileX, tileY) {
            if (rowColFormatCheckbox.checked) {
                return tileY + ', ' + tileX;
            }
            return tileX + ', ' + tileY;
        }

        function handleCanvasClick(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const tileSize = getTileSize();
            const scaledTileWidth = tileSize.width * zoom;
            const scaledTileHeight = tileSize.height * zoom;

            currentTileX = Math.floor(x / scaledTileWidth);
            currentTileY = Math.floor(y / scaledTileHeight);
            currentPixelX = Math.floor(x / zoom);
            currentPixelY = Math.floor(y / zoom);

            const maxTileX = Math.floor(img.width / tileSize.width) - 1;
            const maxTileY = Math.floor(img.height / tileSize.height) - 1;

            if (currentTileX > maxTileX || currentTileY > maxTileY) {
                return;
            }

            tileCoordDisplay.textContent = formatTileCoord(currentTileX, currentTileY);
            pixelCoordDisplay.textContent = currentPixelX + ', ' + currentPixelY;
            updateHighlight();
        }

        canvas.addEventListener('click', handleCanvasClick);

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / zoom);
            const y = Math.floor((e.clientY - rect.top) / zoom);

            if (x >= 0 && x < img.width && y >= 0 && y < img.height) {
                const tileSize = getTileSize();
                const hoverTileX = Math.floor(x / tileSize.width);
                const hoverTileY = Math.floor(y / tileSize.height);
                canvas.title = 'Tile: ' + formatTileCoord(hoverTileX, hoverTileY) + ' | Pixel: ' + x + ', ' + y;
            }
        });

        tileWidthInput.addEventListener('change', () => {
            render();
            updateImageInfo();
        });

        tileHeightInput.addEventListener('change', () => {
            render();
            updateImageInfo();
        });

        showGridCheckbox.addEventListener('change', render);

        rowColFormatCheckbox.addEventListener('change', () => {
            if (currentTileX >= 0 && currentTileY >= 0) {
                tileCoordDisplay.textContent = formatTileCoord(currentTileX, currentTileY);
            }
        });

        function setZoom(newZoom) {
            zoom = Math.max(0.25, Math.min(8, newZoom));
            zoomValueDisplay.textContent = Math.round(zoom * 100) + '%';
            render();
        }

        zoomInBtn.addEventListener('click', () => setZoom(zoom * 2));
        zoomOutBtn.addEventListener('click', () => setZoom(zoom / 2));

        copyTileBtn.addEventListener('click', () => {
            if (currentTileX >= 0 && currentTileY >= 0) {
                const text = formatTileCoord(currentTileX, currentTileY);
                vscode.postMessage({ type: 'copy', text: text });
            }
        });

        copyPixelBtn.addEventListener('click', () => {
            if (currentPixelX >= 0 && currentPixelY >= 0) {
                const text = currentPixelX + ', ' + currentPixelY;
                vscode.postMessage({ type: 'copy', text: text });
            }
        });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
