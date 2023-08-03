import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


import { syntaxTree } from "@codemirror/language";
import {
    Extension,
    RangeSetBuilder,
    StateField,
    Transaction,
} from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
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

        this.registerEditorExtension([annotationField])
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
    toDOM(view: EditorView): HTMLElement {
        const el = document.createElement("span");
        el.addClass('annotation-widget')
        el.innerText = "{}";
        return el;
    }
}
export const annotationField = StateField.define<DecorationSet>({
    create(state): DecorationSet {
        return Decoration.none;
    },
    update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
        // console.log('oldState', oldState, "transaction", transaction);
        const builder = new RangeSetBuilder<Decoration>();

        syntaxTree(transaction.state).iterate({
            enter(node: any) {
                // console.log('node', node, node.type.name, node.from + 1, node.to + 1);
                const nextCharIsBracket = transaction.state.doc.sliceString(node.to + 1, node.to + 2) == "{"
                if (node.type.name == "hmd-barelink_link" && nextCharIsBracket) {
                    const text = transaction.state.doc.sliceString(node.from, node.to)
                    // Find where the next closing curly bracket is
                    const closingBracketIndex = transaction.state.doc.sliceString(node.to + 1).indexOf("}") + node.to + 2
                    builder.add(
                        node.from - 1,
                        node.from,
                        Decoration.replace({})
                    );
                    builder.add(
                        node.to,
                        node.to + 2,
                        Decoration.replace({})
                    );
                    builder.add(
                        node.to + 2,
                        closingBracketIndex,
                        Decoration.replace({ 
                            widget: new AnnotationWidget(),
                        })
                    );
                }
            },
        });
    
        return builder.finish();
    },
    provide(field: StateField<DecorationSet>): Extension {
        return EditorView.decorations.from(field);
    },
});

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
