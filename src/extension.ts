import * as vscode from 'vscode';

interface Metrics {
    lines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    functions: number;
    loops: number;
    conditionals: number;
    maxDepth: number;
    keywords: Map<string, number>;
}

function analyzeCode(text: string): Metrics {
    const lines = text.split(/\r?\n/);
    const keywords = new Map<string, number>();

    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let functions = 0;
    let loops = 0;
    let conditionals = 0;
    let maxDepth = 0;

    // Стек для отслеживания вложенности блоков { }
    const depthStack: number[] = [];
    let currentDepth = 0;

    const loopRegex = /\b(for|while|do)\b/;
    const condRegex = /\b(if|else|switch|case)\b/;
    const funcRegex = /\b(function|def|void|int|public|private|protected)\b.*\(|=>/;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.length === 0) {
            blankLines++;
            continue;
        }

        if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) {
            commentLines++;
            continue;
        }

        codeLines++;

        // Считаем ключевые слова
        const words = line.match(/\b[a-zA-Z_а-яА-Я]+\b/g) || [];
        for (const w of words) {
            const lower = w.toLowerCase();
            if (['for', 'while', 'do', 'if', 'else', 'switch', 'case', 'return', 'function', 'def', 'class'].includes(lower)) {
                keywords.set(lower, (keywords.get(lower) || 0) + 1);
            }
        }

        if (loopRegex.test(line)) loops++;
        if (condRegex.test(line)) conditionals++;
        if (funcRegex.test(line)) functions++;

        // Считаем вложенность через скобки (стек)
        for (const ch of line) {
            if (ch === '{') {
                currentDepth++;
                depthStack.push(currentDepth);
                if (currentDepth > maxDepth) maxDepth = currentDepth;
            } else if (ch === '}') {
                depthStack.pop();
                currentDepth = depthStack.length;
            }
        }
    }

    return {
        lines: lines.length,
        codeLines,
        commentLines,
        blankLines,
        functions,
        loops,
        conditionals,
        maxDepth,
        keywords
    };
}

// Генерируем HTML для отображения
function buildHtml(metrics: Metrics, fileName: string): string {
    const kw = [...metrics.keywords.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<li><b>${k}</b>: ${v}</li>`)
        .join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
    body { font-family: sans-serif; padding: 16px; }
    h2 { color: #007acc; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f0f0f0; color: #000000; font-weight: bold; }
    ul { columns: 2; }
</style>
</head>
<body>
    <h2>CodeMetrics: ${fileName}</h2>
    <table>
        <tr><th>Метрика</th><th>Значение</th></tr>
        <tr><td>Всего строк</td><td>${metrics.lines}</td></tr>
        <tr><td>Строк кода</td><td>${metrics.codeLines}</td></tr>
        <tr><td>Комментариев</td><td>${metrics.commentLines}</td></tr>
        <tr><td>Пустых строк</td><td>${metrics.blankLines}</td></tr>
        <tr><td>Функций (оценка)</td><td>${metrics.functions}</td></tr>
        <tr><td>Циклов</td><td>${metrics.loops}</td></tr>
        <tr><td>Условий</td><td>${metrics.conditionals}</td></tr>
        <tr><td>Макс. вложенность</td><td>${metrics.maxDepth}</td></tr>
    </table>
    <h3>Частота ключевых слов</h3>
    <ul>${kw || '<li>нет</li>'}</ul>
</body>
</html>`;
}

// Панель сбоку
let panel: vscode.WebviewPanel | undefined;

function updatePanel(editor: vscode.TextEditor) {
    if (!panel) return;
    const text = editor.document.getText();
    const metrics = analyzeCode(text);
    const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'file';
    panel.webview.html = buildHtml(metrics, fileName);
}

export function activate(context: vscode.ExtensionContext) {
    // Команда показа метрик
    const cmd = vscode.commands.registerCommand('code-metrics.showMetrics', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Открой файл с кодом');
            return;
        }

        if (panel) {
            panel.reveal();
        } else {
            panel = vscode.window.createWebviewPanel(
                'codeMetrics',
                'CodeMetrics',
                vscode.ViewColumn.Beside,
                { enableScripts: false }
            );
            panel.onDidDispose(() => { panel = undefined; });
        }

        updatePanel(editor);
    });

    // Автообновление при изменении текста
    const onChange = vscode.workspace.onDidChangeTextDocument(e => {
        const editor = vscode.window.activeTextEditor;
        if (editor && e.document === editor.document) {
            updatePanel(editor);
        }
    });

    // Обновление при смене активного файла
    const onSwitch = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updatePanel(editor);
    });

    context.subscriptions.push(cmd, onChange, onSwitch);

    vscode.window.showInformationMessage('CodeMetrics активирован!');
}

export function deactivate() {}