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
		// パッチ解除・イベント解除はすべて register() 済み
	}

	private async activate(): Promise<void> {
		// フォルダはここで作らない（ノート作成時に遅延生成）
		this.applyStrategy();
		if (this.settings.pruneEmptyDatedFolders) {
			await this.ensurer.prune(this.ensurer.targetPath()).catch((e) => this.log.error(e));
		}
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
		// move は常に待機する。フォルダ未作成の初回ノートは patch が素通りし、move が作成して移すため
		// （'patch' 専用モードでは「patch が未作成で素通りした直後のノート」だけを扱う）
		this.move.enable();
		this.log.debug('strategy', s, { patch: this.patch.active, move: this.move.active });
	}

	async onSettingsChanged(): Promise<void> {
		await this.saveSettings(); // フォルダは作らない（設定編集のたびに生成されるのを避ける）
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
