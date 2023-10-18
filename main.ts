import { App, editorLivePreviewField, Modal, Plugin, PluginSettingTab, Setting, MarkdownView, WorkspaceLeaf, TFile } from 'obsidian';


import { syntaxTree } from "@codemirror/language";
import {
    EditorSelection,
    Range,
} from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";


// Remember to rename these classes and interfaces!

interface KAHFMSettings {
    mySetting: string;
}

const DEFAULT_SETTINGS: KAHFMSettings = {
    mySetting: 'default'
}

export default class KAHFM extends Plugin {
    settings: KAHFMSettings;

    async onload() {
        await this.loadSettings();


        // This adds a settings tab so the user can configure various aspects of the plugin 
        this.addSettingTab(new KAHFMSettingsTab(this.app, this));

        this.registerEditorExtension([inlinePlugin()])
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


export class AnnotationWidget extends WidgetType {
    text: string
    index: number
    constructor(text: string, index: number) {
        super()
        this.text = text
        this.index = index
    }
    toDOM(view: EditorView): HTMLElement {
        const el = document.createElement("span");
        el.addClass('annotation-widget')
        el.innerText = this.text;
        el.onclick = () => {
            new AnnotationModal(app, this.index).open()
        }
        return el;
    }
}

function selectionAndRangeOverlap(
    selection: EditorSelection,
    rangeFrom: number,
    rangeTo: number
) {
    for (const range of selection.ranges) {
        if (range.from <= rangeTo && range.to >= rangeFrom) {
            return true;
        }
    }

    return false;
}
function inlineRender(view: EditorView) {
    if (!view.state.field(editorLivePreviewField)) {
        this.decorations = Decoration.none;
        return;
    }
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) return;

    const widgets: Range<Decoration>[] = [];
    const selection = view.state.selection;

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: ({ node }) => {
                // Find the curly brackets
                const nextCharIsBracket = view.state.doc.sliceString(node.to + 1, node.to + 2) == "{"
                const closingBracketIndex = view.state.doc.sliceString(node.to + 1).indexOf("}") + node.to + 2
                const isBareLink = node.type.name == "hmd-barelink_link" && nextCharIsBracket

                const start = node.from - 1
                const end = closingBracketIndex
                if (selectionAndRangeOverlap(selection, start, end) || !isBareLink) return;

                const text = view.state.doc.sliceString(node.from, node.to)
                const matchResult = view.state.doc.sliceString(node.to, closingBracketIndex)
                    .match(/annotation=(\d+)/);
                const index = matchResult ? Number(matchResult[1]) : undefined

                if (index) widgets.push(
                    Decoration.replace({
                        inclusive: false,

                    }).range(node.from - 1, node.from),
                    Decoration.replace({
                        inclusive: false,

                    }).range(node.to, node.to + 2),
                    Decoration.replace({
                        widget: new AnnotationWidget(text, index),
                        inclusive: true,
                    }).range(start, end)
                );
            }
        });
    }

    return Decoration.set(widgets, true);
}

export function inlinePlugin() {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = inlineRender(view) ?? Decoration.none;
            }

            update(update: ViewUpdate) {
                // only activate in LP and not source mode
                if (!update.state.field(editorLivePreviewField)) {
                    this.decorations = Decoration.none;
                    return;
                }
                if (
                    update.docChanged ||
                    update.viewportChanged ||
                    update.selectionSet
                ) {
                    this.decorations =
                        inlineRender(update.view) ?? Decoration.none;
                }
            }
        },
        { decorations: (v) => v.decorations }
    );
}

class KAHFMSettingsTab extends PluginSettingTab {
    plugin: KAHFM;

    constructor(app: App, plugin: KAHFM) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc('It\'s a secret')
            .addText(text => text
                .setPlaceholder('Enter your secret')
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.settings.mySetting = value;
                    await this.plugin.saveSettings();
                }));
    }
}

class AnnotationModal extends Modal {
    app: App
    index: number
    markdownView: MarkdownView

    constructor(app: App, index: number) {
        super(app);
        this.app = app
        this.index = index
    }

    async onOpen() {
        //@ts-ignore
        let markdownView = this.markdownView = new MarkdownView(new WorkspaceLeaf(this.app))
        //@ts-ignore
        markdownView.setMode(markdownView.editMode)
        this.contentEl.appendChild(markdownView.containerEl);
        this.contentEl.addClass('kah-annotation-modal')

        await this.load()
        markdownView.editor.focus()
        markdownView.editor.setCursor({ line: 99999, ch: 99999 })
    }

    async onClose() {
        await this.save()
        this.contentEl.empty();
    }

    async load() {
        await app.fileManager.processFrontMatter(this.app.workspace.getActiveFile() as TFile, (frontmatter) => {
            const annotations = frontmatter.annotations
            const text = annotations && annotations[this.index] ? annotations[this.index] : ''
            this.markdownView.setViewData(text, true);
        })
    }

    async save() {
        app.fileManager.processFrontMatter(this.app.workspace.getActiveFile() as TFile, (frontmatter) => {
            frontmatter.annotations[this.index] = this.markdownView.getViewData()
        })
    }

}
