import { getCrop } from "../domain/catalog";
import type { Location, Planting, PlayerSettings } from "../domain/types";
import { detectLang, isLang, type Lang } from "../i18n";

export interface ViewState {
	year: number;
	season: number;
	location: Location;
}

export interface AppState {
	plantings: Planting[];
	settings: PlayerSettings;
	view: ViewState;
	lang: Lang;
}

const STORAGE_KEY = "stardew-calendar:v1";
const LOCATIONS: readonly Location[] = ["farm", "greenhouse", "island"];

export const DEFAULT_SETTINGS: PlayerSettings = {
	farmingLevel: 0,
	tiller: false,
	agriculturist: false,
	irrigatedPaddy: true,
	showEvents: true,
};

type Listener = (state: AppState) => void;

function isLocation(v: unknown): v is Location {
	return LOCATIONS.includes(v as Location);
}

function toInt(v: unknown, fallback: number, min: number, max = Infinity): number {
	const n = Math.floor(Number(v));
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Valida uma plantação vinda do armazenamento ou de um arquivo importado */
export function sanitizePlanting(raw: unknown): Planting | null {
	if (!raw || typeof raw !== "object") return null;
	const p = raw as Record<string, unknown>;
	const cropId = String(p.cropId ?? "");
	if (!getCrop(cropId) || !isLocation(p.location)) return null;
	const day = toInt(p.day, -1, -1);
	if (day < 0) return null;
	const removed = p.removedAfter == null ? null : toInt(p.removedAfter, -1, -1);
	return {
		id: typeof p.id === "string" && p.id ? p.id : newId(),
		cropId,
		location: p.location,
		day,
		amount: toInt(p.amount, 1, 1, 99999),
		fertilizerId: typeof p.fertilizerId === "string" ? p.fertilizerId : "none",
		replant: p.replant === true,
		removedAfter: removed !== null && removed >= day ? removed : null,
	};
}

export function sanitizeSettings(raw: unknown): PlayerSettings {
	const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const bool = (key: keyof PlayerSettings) => (typeof s[key] === "boolean" ? (s[key] as boolean) : (DEFAULT_SETTINGS[key] as boolean));
	const tiller = bool("tiller");
	return {
		farmingLevel: toInt(s.farmingLevel, 0, 0, 14),
		tiller,
		// Agricultor exige Lavrador
		agriculturist: tiller && bool("agriculturist"),
		irrigatedPaddy: bool("irrigatedPaddy"),
		showEvents: bool("showEvents"),
	};
}

export function newId(): string {
	return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function loadState(): AppState {
	const state: AppState = {
		plantings: [],
		settings: { ...DEFAULT_SETTINGS },
		view: { year: 0, season: 0, location: "farm" },
		lang: detectLang(),
	};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return state;
		const data = JSON.parse(raw) as Record<string, unknown>;
		if (Array.isArray(data.plantings)) {
			state.plantings = data.plantings.map(sanitizePlanting).filter((p): p is Planting => p !== null);
		}
		state.settings = sanitizeSettings(data.settings);
		const v = (data.view ?? {}) as Record<string, unknown>;
		state.view = {
			year: toInt(v.year, 0, 0),
			season: toInt(v.season, 0, 0, 3),
			location: isLocation(v.location) ? v.location : "farm",
		};
		if (isLang(data.lang)) state.lang = data.lang;
	} catch {
		// Armazenamento indisponível ou corrompido: começa vazio
	}
	return state;
}

class Store {
	private state: AppState = loadState();
	private listeners = new Set<Listener>();
	private saveTimer: number | undefined;

	get(): AppState {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Aplica uma mudança imutável, avisa a interface e salva */
	update(change: (state: AppState) => Partial<AppState>): void {
		this.state = { ...this.state, ...change(this.state) };
		for (const listener of this.listeners) listener(this.state);
		this.scheduleSave();
	}

	private scheduleSave(): void {
		window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => this.flush(), 150);
	}

	/** Salva já o que estiver pendente (também ao fechar/recarregar a página) */
	flush(): void {
		if (this.saveTimer === undefined) return;
		window.clearTimeout(this.saveTimer);
		this.saveTimer = undefined;
		try {
			const { plantings, settings, view, lang } = this.state;
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ plantings, settings, view, lang }));
		} catch {
			// Sem armazenamento (aba privada etc.): segue só em memória
		}
	}
}

export const store = new Store();
window.addEventListener("pagehide", () => store.flush());
