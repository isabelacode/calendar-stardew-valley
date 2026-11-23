import { SEASONS } from "../domain/calendar";
import { getCrop } from "../domain/catalog";
import type { Location } from "../domain/types";
import { t } from "../i18n";
import { setView, stepSeason } from "../state/actions";
import type { AppState } from "../state/store";
import { h, icon, mount, type Child } from "./dom";
import { gold, goldClass, img, isRange, locationName, num, seasonName } from "./format";
import type { ViewModel } from "./viewModel";

const LOCATIONS: Location[] = ["farm", "greenhouse", "island"];

function stat(label: Child[], value: Node | string, extra?: Node | false) {
	return h("div", { class: "stat" }, h("span", { class: "stat_label" }, label), h("b", null, value), extra);
}

export function renderToolbar(root: HTMLElement, state: AppState, vm: ViewModel): void {
	const { view } = state;
	const season = vm.season.totals;
	const year = vm.year.totals;
	const tr = t().toolbar;

	mount(
		root,
		h(
			"div",
			{ class: "toolbar_row" },
			h(
				"div",
				{ class: "stepper", role: "group", "aria-label": tr.yearAria },
				h("button", { type: "button", class: "btn btn_icon", title: tr.prevYear, "aria-label": tr.prevYear, props: { disabled: view.year === 0 }, onClick: () => setView({ year: view.year - 1 }) }, icon("chevron-left")),
				h("div", { class: "stepper_value" }, h("span", null, tr.yearLabel), h("b", null, view.year + 1)),
				h("button", { type: "button", class: "btn btn_icon", title: tr.nextYear, "aria-label": tr.nextYear, onClick: () => setView({ year: view.year + 1 }) }, icon("chevron-right")),
			),
			h(
				"div",
				{ class: "locations", role: "tablist", "aria-label": tr.locationsAria },
				LOCATIONS.map((loc) =>
					h(
						"button",
						{
							type: "button",
							role: "tab",
							class: { location_tab: true, active: view.location === loc },
							"aria-selected": String(view.location === loc),
							title: tr.locationTitle(locationName(loc)),
							onClick: () => setView({ location: loc }),
						},
						h("img", { src: img.location(loc), alt: "" }),
						h("span", null, locationName(loc)),
					),
				),
			),
			h(
				"div",
				{ class: "summary" },
				stat([h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), ` ${tr.seeds}`], num(season.seedsPlanted)),
				stat([h("img", { src: img.ui("farming"), alt: "" }), ` ${tr.harvests}`], num(season.items.min), isRange(season.items) && h("small", null, t().upTo(num(season.items.max)))),
				stat(
					[h("img", { src: img.ui("gold_coin"), alt: "" }), ` ${tr.profit(seasonName(view.season))}`],
					h("span", { class: goldClass(season.profit.min) }, gold(season.profit.min)),
					isRange(season.profit) && h("small", { title: tr.expectedHint }, t().upTo(gold(season.profit.max))),
				),
				stat(
					[h("img", { src: img.ui("gold_coin"), alt: "" }), ` ${tr.profit(t().year(view.year + 1))}`],
					h("span", { class: goldClass(year.profit.min) }, gold(year.profit.min)),
					isRange(year.profit) && h("small", { title: tr.expectedHint }, t().upTo(gold(year.profit.max))),
				),
			),
		),
		h(
			"nav",
			{ class: "season_tabs", "aria-label": tr.seasonAria },
			h("button", { type: "button", class: "season_step", title: `${tr.prevSeason} (←)`, "aria-label": tr.prevSeason, props: { disabled: view.year === 0 && view.season === 0 }, onClick: () => stepSeason(-1) }, icon("chevron-left")),
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
					h("span", { class: "season_name" }, seasonName(i)),
					vm.seasons[i]!.cost || vm.seasons[i]!.revenue.max ? h("span", { class: `season_profit ${goldClass(vm.seasons[i]!.profit.min)}` }, gold(vm.seasons[i]!.profit.min, true)) : null,
				),
			),
			h("button", { type: "button", class: "season_step", title: `${tr.nextSeason} (→)`, "aria-label": tr.nextSeason, onClick: () => stepSeason(1) }, icon("chevron-right")),
		),
	);
}
