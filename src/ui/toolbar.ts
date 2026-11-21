import { SEASON_NAMES, SEASONS } from "../domain/calendar";
import { getCrop } from "../domain/catalog";
import { LOCATION_NAMES } from "../domain/schedule";
import type { Location } from "../domain/types";
import { setView, stepSeason } from "../state/actions";
import type { AppState } from "../state/store";
import { h, icon, mount, type Child } from "./dom";
import { gold, goldClass, img, isRange, num } from "./format";
import type { ViewModel } from "./viewModel";

const LOCATIONS: Location[] = ["farm", "greenhouse", "island"];

function stat(label: Child[], value: Node | string, extra?: Node | false) {
	return h("div", { class: "stat" }, h("span", { class: "stat_label" }, label), h("b", null, value), extra);
}

export function renderToolbar(root: HTMLElement, state: AppState, vm: ViewModel): void {
	const { view } = state;
	const season = vm.season.totals;
	const year = vm.year.totals;

	mount(
		root,
		h(
			"div",
			{ class: "toolbar_row" },
			h(
				"div",
				{ class: "stepper", role: "group", "aria-label": "Ano" },
				h("button", { type: "button", class: "btn btn_icon", title: "Ano anterior", "aria-label": "Ano anterior", props: { disabled: view.year === 0 }, onClick: () => setView({ year: view.year - 1 }) }, icon("chevron-left")),
				h("div", { class: "stepper_value" }, h("span", null, "Ano"), h("b", null, view.year + 1)),
				h("button", { type: "button", class: "btn btn_icon", title: "Próximo ano", "aria-label": "Próximo ano", onClick: () => setView({ year: view.year + 1 }) }, icon("chevron-right")),
			),
			h(
				"div",
				{ class: "locations", role: "tablist", "aria-label": "Local de plantio" },
				LOCATIONS.map((loc) =>
					h(
						"button",
						{
							type: "button",
							role: "tab",
							class: { location_tab: true, active: view.location === loc },
							"aria-selected": String(view.location === loc),
							title: `${LOCATION_NAMES[loc]} (atalho: L)`,
							onClick: () => setView({ location: loc }),
						},
						h("img", { src: img.location(loc), alt: "" }),
						h("span", null, LOCATION_NAMES[loc]),
					),
				),
			),
			h(
				"div",
				{ class: "summary" },
				stat([h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), " Sementes"], num(season.seedsPlanted)),
				stat([h("img", { src: img.ui("farming"), alt: "" }), " Colheitas"], num(season.items.min), isRange(season.items) && h("small", null, `até ${num(season.items.max)}`)),
				stat(
					[h("img", { src: img.ui("gold_coin"), alt: "" }), ` Lucro · ${SEASON_NAMES[SEASONS[view.season]!]}`],
					h("span", { class: goldClass(season.profit.min) }, gold(season.profit.min)),
					isRange(season.profit) && h("small", { title: "Média esperada, contando qualidade e itens extras" }, `até ${gold(season.profit.max)}`),
				),
				stat(
					[h("img", { src: img.ui("gold_coin"), alt: "" }), ` Lucro · Ano ${view.year + 1}`],
					h("span", { class: goldClass(year.profit.min) }, gold(year.profit.min)),
					isRange(year.profit) && h("small", null, `até ${gold(year.profit.max)}`),
				),
			),
		),
		h(
			"nav",
			{ class: "season_tabs", "aria-label": "Estação" },
			h("button", { type: "button", class: "season_step", title: "Estação anterior (←)", "aria-label": "Estação anterior", props: { disabled: view.year === 0 && view.season === 0 }, onClick: () => stepSeason(-1) }, icon("chevron-left")),
			SEASONS.map((id, i) =>
				h(
					"button",
					{
						type: "button",
						class: { season_tab: true, [`s_${id}`]: true, active: view.season === i },
						"aria-current": view.season === i ? "true" : undefined,
						onClick: () => setView({ season: i }),
					},
					h("img", { src: img.season(i), alt: "" }),
					h("span", { class: "season_name" }, SEASON_NAMES[id]),
					vm.seasons[i]!.cost || vm.seasons[i]!.revenue.max ? h("span", { class: `season_profit ${goldClass(vm.seasons[i]!.profit.min)}` }, gold(vm.seasons[i]!.profit.min, true)) : null,
				),
			),
			h("button", { type: "button", class: "season_step", title: "Próxima estação (→)", "aria-label": "Próxima estação", onClick: () => stepSeason(1) }, icon("chevron-right")),
		),
	);
}
