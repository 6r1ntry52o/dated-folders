import { AbstractInputSuggest, type App, normalizePath, PluginSettingTab, Setting, TFolder } from 'obsidian';
import type DatedFoldersPlugin from './main';
import type { Grain, WeekStart } from './path-resolver';
import { parseExtensions } from './scope';
import type { Strategy } from './settings';

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, private input: HTMLInputElement) {
		super(app, input);
	}

	getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		// getAllFolders は 1.6.6 以降のため、minAppVersion 1.5.7 に合わせて getAllLoadedFiles で拾う
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && !f.isRoot() && f.path.toLowerCase().includes(q))
			.slice(0, 50);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.input.value = folder.path;
		this.input.trigger('input');
		this.close();
	}
}

export class DatedFoldersSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: DatedFoldersPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = (): Promise<void> => this.plugin.onSettingsChanged();

		let previewEl: HTMLElement | null = null;
		const refreshPreview = (): void => {
			previewEl?.setText(this.plugin.ensurer.targetPath() || '(vault root)');
		};

		new Setting(containerEl)
			.setName('Base folder')
			.setDesc('New notes go under this folder. Leave empty for the vault root. Missing folders are created on startup.')
			.addText((text) => {
				text.setPlaceholder('e.g. notes').setValue(s.baseFolder);
				new FolderSuggest(this.app, text.inputEl);
				text.onChange(async (value) => {
					s.baseFolder = normalizePath(value.trim()).replace(/^\/+|\/+$/g, '');
					if (s.baseFolder === '.') s.baseFolder = '';
					refreshPreview();
					await save();
				});
			});

		new Setting(containerEl)
			.setName('Granularity')
			.setDesc('year → YYYY, month → YYYY/MM, week → YYYY/MM/DD(Wnn) of the week start, day → YYYY/MM/DD')
			.addDropdown((dd) =>
				dd
					.addOptions({ year: 'Year', month: 'Month', week: 'Week', day: 'Day' })
					.setValue(s.grain)
					.onChange(async (value) => {
						s.grain = value as Grain;
						await save();
						this.display();
					}),
			);

		if (s.grain === 'week') {
			new Setting(containerEl)
				.setName('Append ISO week number')
				.setDesc('Name the week folder "DD(Wnn)" with the ISO 8601 week number (1–53). ISO weeks always start on Monday, so this fixes the week start to Monday.')
				.addToggle((t) =>
					t.setValue(s.weekNumber).onChange(async (value) => {
						s.weekNumber = value;
						await save();
						this.display();
					}),
				);
			new Setting(containerEl)
				.setName('Week starts on')
				.setDesc(s.weekNumber ? 'Fixed to Monday while ISO week numbers are on.' : '')
				.setDisabled(s.weekNumber)
				.addDropdown((dd) => {
					dd.addOptions({ '1': 'Monday', '0': 'Sunday' })
						.setValue(s.weekNumber ? '1' : String(s.weekStart))
						.setDisabled(s.weekNumber)
						.onChange(async (value) => {
							s.weekStart = Number(value) as WeekStart;
							refreshPreview();
							await save();
						});
				});
		}

		const preview = new Setting(containerEl).setName('Preview').setDesc('A note created right now would go to:');
		previewEl = preview.controlEl.createEl('code');
		refreshPreview();

		new Setting(containerEl).setName('Advanced').setHeading();

		new Setting(containerEl)
			.setName('Placement method')
			.setDesc(
				'Automatic: place notes directly in the dated folder, and move any note the core created elsewhere as a fallback. Usually no change is needed. This overrides the core "Default location for new notes" setting while enabled.',
			)
			.addDropdown((dd) =>
				dd
					.addOptions({ auto: 'Automatic (recommended)', patch: 'Direct placement only', move: 'Move after creation only' })
					.setValue(s.strategy)
					.onChange(async (value) => {
						s.strategy = value as Strategy;
						await save();
					}),
			);

		new Setting(containerEl)
			.setName('Apply to notes created from links')
			.setDesc('Also route notes created by clicking an unresolved [[link]]. Links that contain a folder path are always left as written.')
			.addToggle((t) =>
				t.setValue(s.applyToLinkCreated).onChange(async (value) => {
					s.applyToLinkCreated = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName('File extensions')
			.setDesc('Comma-separated. Default: md. Add canvas to route new canvases too.')
			.addText((text) =>
				text.setValue(s.extensions.join(', ')).onChange(async (value) => {
					s.extensions = parseExtensions(value);
					await save();
				}),
			);

		new Setting(containerEl)
			.setName('Remove empty dated folders')
			.setDesc('When the date rolls over, delete dated folders this plugin created that are still empty. Folders you created yourself are never touched.')
			.addToggle((t) =>
				t.setValue(s.pruneEmptyDatedFolders).onChange(async (value) => {
					s.pruneEmptyDatedFolders = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName('Debug logging')
			.setDesc('Write diagnostic messages to the developer console.')
			.addToggle((t) =>
				t.setValue(s.debug).onChange(async (value) => {
					s.debug = value;
					await save();
				}),
			);
	}
}
