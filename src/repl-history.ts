import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import type { ReplType } from './config';
import { isResultsDoc, getSessionType, getPrompt, append } from './result-output';

let historyIndex = null;
let lastTextAtPrompt = null;

function resetState(): void {
    historyIndex = null;
    lastTextAtPrompt = null;
}

function getHistoryKey(replType: ReplType): string {
    return `calva-repl-${replType}-history`;
}

function getHistory(replType: ReplType): Array<string> {
    const key = getHistoryKey(replType);
    let history = state.extensionContext.workspaceState.get(key, []);
    return history;
}

function addToHistory(replType: ReplType, line: string) {
    const entry = line.trim();
    if (line !== "") {
        const history = getHistory(replType);
        let last = "";
        if (history.length > 0) {
            last = history[history.length - 1];
        }
        if (last !== line) {
            history.push(entry);
            state.extensionContext.workspaceState.update(getHistoryKey(replType), history);
        }
        resetState();
    }
}

function clearHistory() {
    const replType = getSessionType();
    const key = getHistoryKey(replType);
    state.extensionContext.workspaceState.update(key, []);
    resetState();
    append('; REPL history cleared');
    append(getPrompt());
}

function showReplHistoryEntry(historyEntry: string, resultsEditor: vscode.TextEditor): void {
    const prompt = getPrompt();
    const resultsDoc = resultsEditor.document;
    const docText = resultsDoc.getText();
    const indexOfLastPrompt = docText.lastIndexOf(prompt);
    if (indexOfLastPrompt === -1) {
        // Prompt not found in results doc, so append a prompt and re-run this function
        append(getPrompt(), _ => {
            showReplHistoryEntry(historyEntry, resultsEditor);
        });
        return;
    }
    let insertOffset = indexOfLastPrompt + prompt.length;
    const startPosition = resultsDoc.positionAt(insertOffset);
    const range = new vscode.Range(startPosition, resultsDoc.positionAt(Infinity));
    const entry = historyEntry || "\n";
    const edit = new vscode.WorkspaceEdit();
    edit.replace(resultsDoc.uri, range, entry);
    vscode.workspace.applyEdit(edit).then(_ => {
        resultsDoc.save();
        util.scrollToBottom(resultsEditor);
    });
}

function saveTextAtPrompt(docText: string): void {
    const prompt = getPrompt();
    const indexOfLastPrompt = docText.lastIndexOf(prompt);
    if (indexOfLastPrompt === -1) {
        return;
    }
    const indexOfEndOfPrompt = indexOfLastPrompt + prompt.length;
    lastTextAtPrompt = docText.substring(indexOfEndOfPrompt);
}

function addNewline(text: string) {
    return `\n${text}`;
}

function showPreviousReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === 0 || history.length === 0) {
        return;
    }
    if (historyIndex === null) {
        historyIndex = history.length;
    }
    if (historyIndex === history.length) {
        saveTextAtPrompt(doc.getText());
    }
    historyIndex--;
    showReplHistoryEntry(addNewline(history[historyIndex]), editor);
}

function showNextReplHistoryEntry(): void {
    const editor = vscode.window.activeTextEditor;
    const doc = editor.document;
    const replType = getSessionType();
    const history = getHistory(replType);
    if (!isResultsDoc(doc) || historyIndex === null) {
        return;
    }
    historyIndex++;
    if (historyIndex >= history.length) {
        historyIndex = null;
        showReplHistoryEntry(lastTextAtPrompt, editor);
    } else {
        showReplHistoryEntry(addNewline(history[historyIndex]), editor);
    }
}

export {
    addToHistory,
    showPreviousReplHistoryEntry,
    showNextReplHistoryEntry,
    resetState,
    clearHistory
};
