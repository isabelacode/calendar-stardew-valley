import { DAYS_PER_YEAR } from "../domain/calendar";
import { getCrop, getFertilizer } from "../domain/catalog";
import { canPlant } from "../domain/schedule";
import type { Location, Planting, PlayerSettings } from "../domain/types";
import { newId, sanitizePlanting, sanitizeSettings, store, type ViewState } from "./store";

export interface NewPlanting {
	cropId: string;
	day: number;
	amount: number;
	fertilizerId: string;
	replant: boolean;
}

export function addPlanting(input: NewPlanting): boolean {
	const { view } = store.get();
	const crop = getCrop(input.cropId);
	if (!crop || input.amount < 1 || !canPlant(crop, view.location, input.day)) return false;

	const planting: Planting = {
		id: newId(),
		cropId: crop.id,
		location: view.location,
		day: input.day,
		amount: Math.floor(input.amount),
		fertilizerId: getFertilizer(input.fertilizerId).id,
		replant: input.replant && !crop.regrow,
		removedAfter: null,
	};
	store.update((s) => ({ plantings: [...s.plantings, planting] }));
	return true;
}

export function updatePlanting(id: string, patch: Partial<Pick<Planting, "amount" | "fertilizerId" | "replant" | "removedAfter">>): void {
	store.update((s) => ({
		plantings: s.plantings.map((p) => (p.id === id ? { ...p, ...patch } : p)),
	}));
}

export function deletePlanting(id: string): void {
	store.update((s) => ({ plantings: s.plantings.filter((p) => p.id !== id) }));
}

/** Arranca a planta logo depois da colheita do dia `day` (ou desfaz) */
export function toggleRemovedAfter(id: string, day: number): void {
	const planting = store.get().plantings.find((p) => p.id === id);
	if (!planting) return;
	updatePlanting(id, { removedAfter: planting.removedAfter === day ? null : day });
}

/** Apaga as plantações de um local feitas entre dois dias (inclusive) */
export function clearPlantings(location: Location, from: number, to: number): number {
	const before = store.get().plantings.length;
	store.update((s) => ({
		plantings: s.plantings.filter((p) => p.location !== location || p.day < from || p.day > to),
	}));
	return before - store.get().plantings.length;
}

export function clearAll(): void {
	store.update(() => ({ plantings: [] }));
}

export function setView(patch: Partial<ViewState>): void {
	store.update((s) => ({ view: { ...s.view, ...patch } }));
}

/** Avança/volta uma estação, mudando de ano quando preciso */
export function stepSeason(delta: 1 | -1): void {
	const { year, season } = store.get().view;
	const index = year * 4 + season + delta;
	if (index < 0) return;
	setView({ year: Math.floor(index / 4), season: index % 4 });
}

export function setSettings(patch: Partial<PlayerSettings>): void {
	store.update((s) => ({ settings: sanitizeSettings({ ...s.settings, ...patch }) }));
}

/* ---------- importar / exportar ---------- */

const EXPORT_APP = "calendar-stardew-valley";

export function exportData(): string {
	const { plantings, settings } = store.get();
	return JSON.stringify({ app: EXPORT_APP, version: 1, exportedAt: new Date().toISOString(), plantings, settings }, null, 2);
}

/**
 * Formato do planejador antigo (crop_planner v2):
 * { plans: [ { farm: { "1": [{ crop, amount, fertilizer }] }, greenhouse: {...} } | null, ... ] }
 * com dias de 1 a 112 dentro de cada ano.
 */
function fromLegacy(data: Record<string, unknown>): Planting[] {
	const years = Array.isArray(data.plans) ? data.plans : Array.isArray(data) ? data : [];
	const result: Planting[] = [];
	years.forEach((year: unknown, yearIndex: number) => {
		if (!year || typeof year !== "object") return;
		for (const [location, byDate] of Object.entries(year as Record<string, unknown>)) {
			if (!byDate || typeof byDate !== "object") continue;
			for (const [date, plans] of Object.entries(byDate as Record<string, unknown>)) {
				if (!Array.isArray(plans)) continue;
				for (const plan of plans as Record<string, unknown>[]) {
					const planting = sanitizePlanting({
						cropId: plan.crop,
						location,
						day: yearIndex * DAYS_PER_YEAR + Number(date) - 1,
						amount: plan.amount,
						fertilizerId: plan.fertilizer ?? "none",
						removedAfter: typeof plan.removed === "number" ? plan.removed - 1 : null,
					});
					if (planting) result.push(planting);
				}
			}
		}
	});
	return result;
}

export interface ImportResult {
	count: number;
	legacy: boolean;
}

/** Substitui as plantações pelas do arquivo. Lança erro se o formato for inválido. */
export function importData(text: string): ImportResult {
	const data = JSON.parse(text) as Record<string, unknown>;
	let plantings: Planting[];
	let legacy = false;

	if (data && data.app === EXPORT_APP && Array.isArray(data.plantings)) {
		plantings = data.plantings.map(sanitizePlanting).filter((p): p is Planting => p !== null);
	} else if (data && (Array.isArray(data.plans) || Array.isArray(data))) {
		plantings = fromLegacy(data);
		legacy = true;
	} else {
		throw new Error("Arquivo não reconhecido");
	}

	store.update((s) => ({
		plantings,
		settings: data.settings ? sanitizeSettings(data.settings) : s.settings,
	}));
	return { count: plantings.length, legacy };
}
