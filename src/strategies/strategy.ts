export interface PlacementStrategy {
	readonly active: boolean;
	enable(): void;
	disable(): void;
}
