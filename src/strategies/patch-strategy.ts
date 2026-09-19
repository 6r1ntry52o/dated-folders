import { around } from 'monkey-around';
import type { FileManager, TFolder } from 'obsidian';
import type DatedFoldersPlugin from '../main';
import { appliesToNew } from '../scope';
import type { PlacementStrategy } from './strategy';

type GetNewFileParent = (this: FileManager, sourcePath: string, newFilePath?: string) => TFolder;

/** 経路A: fileManager.getNewFileParent を instance にパッチし、日付フォルダを返す */
export class PatchStrategy implements PlacementStrategy {
	/** 経路B が「A が処理済み」を判定する目印 */
	lastHitAt = 0;
	/** コアの元実装（パッチ有効中のみ）。B の「コア既定の親」判定に使う */
	orig: GetNewFileParent | null = null;
	private uninstall: (() => void) | null = null;

	constructor(private p: DatedFoldersPlugin) {
		this.p.register(() => this.disable());
	}

	get active(): boolean {
		return this.uninstall !== null;
	}

	enable(): void {
		if (this.uninstall) return;
		const plugin = this.p;
		const self = this;
		// prototype ではなく instance にパッチ＝影響範囲を自分の app に限定。解除で own property が消え prototype 実装に戻る（実証済）
		this.uninstall = around(this.p.app.fileManager, {
			getNewFileParent(orig: GetNewFileParent): GetNewFileParent {
				self.orig = orig;
				return function (this: FileManager, sourcePath: string, newFilePath?: string): TFolder {
					const fallback = (): TFolder => orig.call(this, sourcePath, newFilePath);
					try {
						if (!appliesToNew(plugin.settings, sourcePath, newFilePath)) return fallback();
						const folder = plugin.ensurer.currentFolder();
						if (!folder) {
							void plugin.ensurer.ensure().catch((e) => plugin.log.error(e)); // 次回のために掘っておく
							return fallback();
						}
						self.lastHitAt = Date.now();
						plugin.log.debug('patch hit', { sourcePath, newFilePath, target: folder.path });
						return folder;
					} catch (e) {
						plugin.log.error(e);
						return fallback(); // 何があってもコア既定へ
					}
				};
			},
		});
	}

	disable(): void {
		if (!this.uninstall) return;
		this.uninstall();
		this.uninstall = null;
		this.orig = null;
	}
}
