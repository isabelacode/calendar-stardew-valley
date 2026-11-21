import { DAYS_PER_SEASON, SEASON_NAMES, SEASONS, WEEKDAYS, formatDate, toGameDate } from "../domain/calendar";
import { eventsOn } from "../domain/catalog";
import type { DayEntry } from "../domain/ledger";
import type { HarvestEvent } from "../domain/schedule";
import type { CalendarEvent } from "../domain/types";
import type { AppState } from "../state/store";
import { h, mount } from "./dom";
import { gold, goldClass, img, isRange } from "./format";
import type { ViewModel } from "./viewModel";

const MAX_ICONS = 4;

/** Agrupa colheitas da mesma cultura num único ícone com a quantidade somada */
function groupHarvests(harvests: HarvestEvent[]) {
	const groups = new Map<string, { harvest: HarvestEvent; items: number }>();
	for (const ev of harvests) {
		const g = groups.get(ev.crop.id);
		if (g) g.items += ev.items.min;
		else groups.set(ev.crop.id, { harvest: ev, items: ev.items.min });
	}
	return [...groups.values()];
}

function iconRow<T>(items: T[], className: string, title: string, render: (item: T) => Node) {
	if (!items.length) return null;
	const shown = items.slice(0, MAX_ICONS);
	return h(
		"div",
		{ class: `icons ${className}`, title },
		shown.map(render),
		items.length > MAX_ICONS && h("span", { class: "more" }, `+${items.length - MAX_ICONS}`),
	);
}

function badge(src: string, amount: number, title: string) {
	return h("span", { class: "badge", title }, h("img", { src, alt: "" }), h("span", { class: "badge_count" }, amount));
}

function eventView(events: readonly CalendarEvent[]) {
	if (!events.length) return null;
	const first = events[0]!;
	const src = first.kind === "festival" ? img.festival() : img.portrait(first.portrait);
	const label = events.map((e) => (e.kind === "festival" ? e.name : `Aniversário: ${e.name}`)).join(" · ");
	return h("div", { class: "event", title: label }, h("img", { src, alt: "" }), h("span", { class: "event_name" }, events.map((e) => e.name).join(", ")));
}

function dayCell(abs: number, entry: DayEntry | undefined, state: AppState, onOpen: (day: number) => void) {
	const { day } = toGameDate(abs);
	const events = state.settings.showEvents ? eventsOn(abs) : [];
	const festival = events.some((e) => e.kind === "festival");
	const planted = entry ? [...entry.planted, ...entry.replanted] : [];
	const harvests = entry ? groupHarvests(entry.harvests) : [];
	const hasActivity = planted.length > 0 || harvests.length > 0;

	return h(
		"button",
		{
			type: "button",
			class: { day: true, festival, active: hasActivity },
			"aria-label": formatDate(abs, { weekday: true }),
			onClick: () => onOpen(abs),
		},
		h(
			"div",
			{ class: "day_top" },
			h("span", { class: "day_num" }, day),
			h("span", { class: "day_weekday" }, WEEKDAYS[(day - 1) % 7]),
			eventView(events),
		),
		iconRow(planted, "planting", "Plantio", (ev) => badge(img.seed(ev.crop), ev.planting.amount, `${ev.reason === "replant" ? "Replantar" : "Plantar"} ${ev.planting.amount}× ${ev.crop.name}`)),
		iconRow(harvests, "harvesting", "Colheita", (g) => badge(img.crop(g.harvest.crop), g.items, `Colher ${g.items}× ${g.harvest.crop.name}`)),
		entry &&
			hasActivity &&
			h(
				"div",
				{ class: "day_profit" },
				h("span", { class: goldClass(entry.profit.min) }, gold(entry.profit.min, true)),
				isRange(entry.profit) && h("small", null, `até ${gold(entry.profit.max, true)}`),
			),
	);
}

export function renderCalendar(root: HTMLElement, state: AppState, vm: ViewModel, onOpen: (day: number) => void): void {
	const { view } = state;
	const seasonId = SEASONS[view.season]!;
	const days = Array.from({ length: DAYS_PER_SEASON }, (_, i) => vm.season.first + i);

	root.className = `calendar s_${seasonId}`;
	mount(
		root,
		h("div", { class: "calendar_banner" }, h("h2", null, SEASON_NAMES[seasonId]), h("span", null, `Ano ${view.year + 1}`)),
		h("div", { class: "weekdays", "aria-hidden": "true" }, WEEKDAYS.map((d) => h("span", null, d))),
		h("div", { class: "days" }, days.map((abs) => dayCell(abs, vm.ledger.days.get(abs), state, onOpen))),
	);
}
