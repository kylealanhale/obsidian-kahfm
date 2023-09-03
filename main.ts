import { App, editorLivePreviewField, Plugin, PluginSettingTab, Setting } from 'obsidian';


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

        // this.registerMarkdownPostProcessor((element, context) => {
        //     const codeblocks = element.querySelectorAll("code");
      
        //     for (let index = 0; index < codeblocks.length; index++) {
        //       const codeblock = codeblocks.item(index);
        //       const text = codeblock.innerText.trim();
        //       const isEmoji =
        //         text[0] === ":" && text[text.length - 1] === ":";
      
        //       if (isEmoji) {
        //         context.addChild(new Emoji(codeblock, text));
        //       }
        //     }
        //   });
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
    constructor(text: string) {
        super()
        this.text = text
    }
    toDOM(view: EditorView): HTMLElement {
        const el = document.createElement("span");
        el.addClass('annotation-widget')
        el.innerText = this.text;
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
    // still doesn't work as expected for tables and callouts
    if (!view.state.field(editorLivePreviewField)) {
        this.decorations = Decoration.none;
        return;
    }
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) return;

    const widgets: Range<Decoration>[] = [];
    const selection = view.state.selection;
    /* before:
     *     em for italics
     *     highlight for highlight
     * after:
     *     strong for bold
     *     strikethrough for strikethrough
     */
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: ({ node }) => {
                const closingBracketIndex = view.state.doc.sliceString(node.to + 1).indexOf("}") + node.to + 2
                const start = node.from - 1
                const end = closingBracketIndex
                if (selectionAndRangeOverlap(selection, start, end)) return;
                const text = view.state.doc.sliceString(node.from, node.to)

                // console.log('node', node, node.type.name, node.from + 1, node.to + 1);
                const nextCharIsBracket = view.state.doc.sliceString(node.to + 1, node.to + 2) == "{"
                if (node.type.name == "hmd-barelink_link" && nextCharIsBracket) {
                    const text = view.state.doc.sliceString(node.from, node.to)
                    // Find where the next closing curly bracket is
                    const closingBracketIndex = view.state.doc.sliceString(node.to + 1).indexOf("}") + node.to + 2
                    widgets.push(
                        Decoration.replace({
                            inclusive: false,

                        }).range(node.from - 1, node.from),
                        Decoration.replace({
                            inclusive: false,

                        }).range(node.to, node.to + 2),
                        Decoration.replace({ 
                            widget: new AnnotationWidget(text),
                            inclusive: true,
                        }).range(start, end)
                    );
                }

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
