import { Notice, Plugin } from 'obsidian';
import { FolderEnsurer } from './folder-ensurer';
import { Log } from './log';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { DatedFoldersSettingTab } from './settings-tab';
import { MoveStrategy } from './strategies/move-strategy';
import { PatchStrategy } from './strategies/patch-strategy';

export default class DatedFoldersPlugin extends Plugin {
	settings: Settings = { ...DEFAULT_SETTINGS };
	log = new Log(() => this.settings.debug);
	ensurer!: FolderEnsurer;
	patch!: PatchStrategy;
	move!: MoveStrategy;
	private warnedNoPatch = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.ensurer = new FolderEnsurer(this);
		this.patch = new PatchStrategy(this);
		this.move = new MoveStrategy(this);
		this.addSettingTab(new DatedFoldersSettingTab(this.app, this));

		this.addCommand({
			id: 'create-current-folder',
			name: "Create today's folder now",
			callback: () => {
				void this.ensurer
					.ensure()
					.then((folder) => new Notice(folder ? `Dated Folders: ${folder.path || '(vault root)'}` : 'Dated Folders: folder not available'))
					.catch((e) => this.reportEnsureError(e));
			},
		});

		// create の購読も含めて onLayoutReady 以降＝vault ロード時の全ファイル発火を避ける
		this.app.workspace.onLayoutReady(() => {
			void this.activate();
		});
	}

	onunload(): void {
		// パッチ解除・イベント解除・タイマー解除はすべて register() 済み
	}

	private async activate(): Promise<void> {
		try {
			await this.ensurer.ensure();
		} catch (e) {
			this.reportEnsureError(e);
		}
		this.ensurer.start();
		this.applyStrategy();
	}

	applyStrategy(): void {
		const s = this.settings.strategy;
		const canPatch = typeof this.app.fileManager.getNewFileParent === 'function';
		this.patch.disable();
		this.move.disable();
		if (s !== 'move') {
			if (canPatch) {
				this.patch.enable();
			} else if (!this.warnedNoPatch) {
				this.warnedNoPatch = true;
				new Notice('Dated Folders: direct placement is unavailable in this version; notes will be moved after creation instead.');
			}
		}
		if (s !== 'patch' || !this.patch.active) this.move.enable();
		this.log.debug('strategy', s, { patch: this.patch.active, move: this.move.active });
	}

	async onSettingsChanged(): Promise<void> {
		await this.saveSettings();
		try {
			await this.ensurer.ensure();
		} catch (e) {
			this.reportEnsureError(e);
		}
		this.applyStrategy();
	}

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as Partial<Settings>;
		this.settings = { ...DEFAULT_SETTINGS, ...data, createdFolders: Array.isArray(data.createdFolders) ? data.createdFolders : [] };
		if (!Array.isArray(this.settings.extensions) || this.settings.extensions.length === 0) this.settings.extensions = ['md'];
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private reportEnsureError(e: unknown): void {
		this.log.error(e);
		new Notice(`Dated Folders: could not create "${this.ensurer.targetPath()}". New notes will use the default location.`);
	}
}
