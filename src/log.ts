export class Log {
	constructor(private enabled: () => boolean) {}
	debug(...args: unknown[]): void {
		if (this.enabled()) console.log('[dated-folders]', ...args);
	}
	error(...args: unknown[]): void {
		console.error('[dated-folders]', ...args);
	}
}
