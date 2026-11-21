import { seasonRange, yearRange } from "../domain/calendar";
import { buildLedger, sumRange, type Ledger, type Totals } from "../domain/ledger";
import type { AppState } from "../state/store";

export interface ViewModel {
	ledger: Ledger;
	season: { first: number; last: number; totals: Totals };
	year: { first: number; last: number; totals: Totals };
	/** Totais de cada uma das 4 estações do ano exibido */
	seasons: Totals[];
}

let cached: { plantings: unknown; settings: unknown; year: number; location: string; vm: ViewModel } | null = null;

/** Livro-caixa do ano/local exibidos; recalcula só quando algo relevante muda */
export function viewModel(state: AppState): ViewModel {
	const { plantings, settings, view } = state;
	if (cached && cached.plantings === plantings && cached.settings === settings && cached.year === view.year && cached.location === view.location) {
		return withSeason(cached.vm, view.year, view.season);
	}

	const [yFirst, yLast] = yearRange(view.year);
	const ledger = buildLedger(plantings, view.location, yFirst, yLast, settings);
	const seasons = [0, 1, 2, 3].map((s) => {
		const [first, last] = seasonRange(view.year, s);
		return sumRange(ledger, first, last);
	});
	const vm = withSeason({ ledger, seasons, year: { first: yFirst, last: yLast, totals: ledger.totals }, season: null! }, view.year, view.season);
	cached = { plantings, settings, year: view.year, location: view.location, vm };
	return vm;
}

function withSeason(vm: ViewModel, year: number, season: number): ViewModel {
	const [first, last] = seasonRange(year, season);
	return { ...vm, season: { first, last, totals: vm.seasons[season]! } };
}
