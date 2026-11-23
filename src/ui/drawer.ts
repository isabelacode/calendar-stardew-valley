import { SEASONS, seasonRange, yearRange } from "../domain/calendar";
import { allCrops, getCrop, getFertilizer } from "../domain/catalog";
import { cropStats, type CropStats } from "../domain/cropStats";
import { QUALITIES, qualityOdds, sellPrice, type Quality } from "../domain/quality";
import type { CropData, SeasonId } from "../domain/types";
import { lang, locale, t, tx } from "../i18n";
import { clearAll, clearPlantings, exportData, importData, setSettings } from "../state/actions";
import { store, type AppState } from "../state/store";
import { h, icon, mount } from "./dom";
import { gold, goldClass, img, locationName, percent, seasonName, wikiUrl } from "./format";

type Tab = "crops" | "player" | "data";
type SeasonFilter = SeasonId | "all" | "indoor";
type SortKey = "name" | "grow" | "regrow" | "sell" | "profit";

const QUALITY_ICON: Partial<Record<Quality, string>> = { silver: "silver", gold: "gold", iridium: "iridium" };

const TABS: { id: Tab; image: string }[] = [
	{ id: "crops", image: img.crop(getCrop("parsnip")!) },
	{ id: "player", image: img.ui("farming") },
	{ id: "data", image: img.ui("gold_coin") },
];

const qualityName = (q: Quality) => t().quality[q];

export class Drawer {
	readonly el: HTMLElement;
	private tab: Tab | null = null;
	private body = h("div", { class: "drawer_body" });
	private heading = h("h2", null);
	private tabButtons = new Map<Tab, HTMLButtonElement>();
	private backdrop = h("div", { class: "drawer_backdrop", onClick: () => this.close() });
	private tabsNav = h("nav", { class: "drawer_tabs" });
	private closeBtn = h("button", { type: "button", class: "btn btn_icon", onClick: () => this.close() }, icon("close"));

	// Estado da aba Culturas
	private search = "";
	private filter: SeasonFilter = "all";
	private sort: SortKey = "profit";
	private sortDesc = true;
	private detail: string | null = null;
	private tableBody: HTMLElement | null = null;

	private status = h("p", { class: "status", role: "status" });

	constructor() {
		for (const tab of TABS) {
			const btn = h("button", { type: "button", onClick: () => this.toggle(tab.id) }, h("img", { src: tab.image, alt: "" }));
			this.tabButtons.set(tab.id, btn);
			this.tabsNav.append(btn);
		}
		this.el = h(
			"aside",
			{ class: "drawer" },
			this.tabsNav,
			h("div", { class: "drawer_panel frame" }, h("header", { class: "drawer_header" }, this.heading, this.closeBtn), this.body),
		);
	}

	/** Textos fixos do painel; chamado quando o idioma muda */
	relabel(): void {
		const tr = t().drawer;
		this.el.setAttribute("aria-label", tr.aria);
		this.tabsNav.setAttribute("aria-label", tr.tabsAria);
		for (const [id, btn] of this.tabButtons) {
			btn.title = tr.tabs[id];
			btn.setAttribute("aria-label", tr.tabs[id]);
		}
		this.closeBtn.title = tr.closeEsc;
		this.closeBtn.setAttribute("aria-label", tr.close);
		if (this.tab) this.render(store.get());
	}

	get backdropEl(): HTMLElement {
		return this.backdrop;
	}

	get isOpen(): boolean {
		return this.tab !== null;
	}

	toggle(tab: Tab): void {
		if (this.tab === tab) this.close();
		else this.open(tab);
	}

	open(tab: Tab): void {
		this.tab = tab;
		this.detail = null;
		this.render(store.get());
	}

	close(): void {
		this.tab = null;
		this.render(store.get());
	}

	refresh(state: AppState): void {
		if (this.tab === "crops" && !this.detail && this.tableBody) {
			// Só atualiza a tabela, para não perder o foco da busca
			this.renderCropRows(state);
			return;
		}
		this.render(state);
	}

	private render(state: AppState): void {
		const open = this.tab !== null;
		this.el.classList.toggle("open", open);
		this.backdrop.classList.toggle("open", open);
		document.body.classList.toggle("drawer_open", open);
		for (const [id, btn] of this.tabButtons) {
			btn.classList.toggle("active", id === this.tab);
			btn.setAttribute("aria-expanded", String(id === this.tab));
		}
		this.tableBody = null;
		if (!this.tab) return;

		this.heading.textContent = t().drawer.tabs[this.tab];
		if (this.tab === "crops") this.renderCrops(state);
		if (this.tab === "player") this.renderPlayer(state);
		if (this.tab === "data") this.renderData(state);
	}

	/* ---------- Culturas ---------- */

	private renderCrops(state: AppState): void {
		if (this.detail) {
			this.renderCropDetail(state, getCrop(this.detail)!);
			return;
		}
		const tr = t().drawer;
		const searchInput = h("input", {
			class: "input",
			type: "search",
			placeholder: tr.search,
			"aria-label": tr.searchAria,
			props: { value: this.search },
			onInput: () => {
				this.search = searchInput.value;
				this.renderCropRows(state);
			},
		});
		const filters: { id: SeasonFilter; label: string }[] = [
			{ id: "all", label: tr.all },
			...SEASONS.map((id, i) => ({ id, label: seasonName(i) })),
			{ id: "indoor", label: tr.indoorOnly },
		];
		const chips = h(
			"div",
			{ class: "chips", role: "radiogroup", "aria-label": tr.filterAria },
			filters.map((f) =>
				h(
					"button",
					{
						type: "button",
						role: "radio",
						"aria-checked": String(this.filter === f.id),
						class: { chip: true, active: this.filter === f.id },
						onClick: () => {
							this.filter = f.id;
							this.render(store.get());
						},
					},
					f.label,
				),
			),
		);

		const sortHeader = (key: SortKey, label: string, cls = "num") =>
			h(
				"th",
				{ class: cls, "aria-sort": this.sort === key ? (this.sortDesc ? "descending" : "ascending") : undefined },
				h(
					"button",
					{
						type: "button",
						class: "sort_btn",
						onClick: () => {
							if (this.sort === key) this.sortDesc = !this.sortDesc;
							else {
								this.sort = key;
								this.sortDesc = key !== "name" && key !== "grow";
							}
							this.render(store.get());
						},
					},
					label,
					this.sort === key ? (this.sortDesc ? " ▼" : " ▲") : "",
				),
			);

		this.tableBody = h("tbody");
		mount(
			this.body,
			h("div", { class: "field_search" }, icon("search"), searchInput),
			chips,
			h(
				"div",
				{ class: "table_wrap" },
				h(
					"table",
					{ class: "table crop_table" },
					h("thead", null, h("tr", null, h("th", null, h("span", { class: "sr" }, tr.image)), sortHeader("name", tr.colCrop, ""), sortHeader("grow", tr.colDays), sortHeader("regrow", tr.colRegrow), sortHeader("sell", tr.colSell), sortHeader("profit", tr.colProfit))),
					this.tableBody,
				),
			),
			h("p", { class: "hint" }, tr.tableHint),
		);
		this.renderCropRows(state);
	}

	private renderCropRows(state: AppState): void {
		if (!this.tableBody) return;
		const tr = t().drawer;
		const loc = locale();
		const term = this.search.trim().toLocaleLowerCase(loc);
		const rows = allCrops()
			.filter((c) => {
				// Busca nos dois idiomas
				if (term && !c.name.pt.toLocaleLowerCase(loc).includes(term) && !c.name.en.toLocaleLowerCase(loc).includes(term)) return false;
				if (this.filter === "all") return true;
				if (this.filter === "indoor") return !!c.indoorOnly;
				return c.seasons.includes(this.filter);
			})
			.map((crop) => ({ crop, stats: cropStats(crop, state.settings) }));

		const value = (r: { crop: CropData; stats: CropStats }): number | string => {
			switch (this.sort) {
				case "name":
					return tx(r.crop.name);
				case "grow":
					return r.stats.grow;
				case "regrow":
					return r.crop.regrow ?? 0;
				case "sell":
					return r.crop.sellPrice;
				case "profit":
					return r.stats.profitPerDay ?? -Infinity;
			}
		};
		rows.sort((a, b) => {
			const va = value(a);
			const vb = value(b);
			const cmp = typeof va === "string" ? va.localeCompare(vb as string, loc) : va - (vb as number);
			return this.sortDesc ? -cmp : cmp;
		});

		mount(
			this.tableBody,
			rows.length
				? rows.map(({ crop, stats }) =>
						h(
							"tr",
							{ class: "clickable", tabindex: "0", onClick: () => this.showDetail(crop.id), onKeydown: (e) => e.key === "Enter" && this.showDetail(crop.id) },
							h("td", { class: "sprite" }, h("img", { src: img.crop(crop), alt: "" })),
							h("td", { class: "name" }, tx(crop.name), crop.indoorOnly && h("span", { class: "tag tag_indoor" }, tr.indoorTag)),
							h("td", { class: "num" }, stats.grow),
							h("td", { class: "num" }, crop.regrow ?? "—"),
							h("td", { class: "num" }, gold(crop.sellPrice)),
							h("td", { class: "num" }, stats.profitPerDay === null ? h("span", { class: "muted", title: tr.seedNotSold }, "—") : h("span", { class: goldClass(stats.profitPerDay) }, gold(stats.profitPerDay))),
						),
					)
				: h("tr", null, h("td", { colspan: "6", class: "empty" }, tr.noCrops)),
		);
	}

	private showDetail(id: string | null): void {
		this.detail = id;
		this.render(store.get());
	}

	private renderCropDetail(state: AppState, crop: CropData): void {
		const stats = cropStats(crop, state.settings);
		const tr = t().drawer;
		const seasons = crop.seasons.length ? crop.seasons.map((s) => seasonName(SEASONS.indexOf(s))).join(", ") : tr.indoorsOnly;
		const item = (label: string, value: Node | string) => h("div", null, h("dt", null, label), h("dd", null, value));

		mount(
			this.body,
			h("button", { type: "button", class: "btn btn_small", onClick: () => this.showDetail(null) }, icon("chevron-left"), tr.allCrops),
			h(
				"div",
				{ class: "crop_hero" },
				h("img", { src: img.crop(crop), alt: "" }),
				h("div", null, h("h3", null, tx(crop.name)), h("p", { class: "muted" }, crop.name[lang() === "pt" ? "en" : "pt"])),
				h("img", { src: img.seed(crop), alt: tr.seed, title: tr.seed }),
			),
			h(
				"dl",
				{ class: "facts" },
				item(tr.seasons, seasons),
				item(tr.growsIn, tr.days(stats.grow)),
				item(tr.regrows, crop.regrow ? tr.every(crop.regrow) : tr.no),
				item(tr.seed, crop.seedPrice === null ? tr.notSold : gold(crop.seedPrice)),
				item(tr.itemsPerHarvest, crop.yield.max > crop.yield.min ? `${crop.yield.min}–${crop.yield.max}` : String(crop.yield.min)),
				crop.yield.extraChance > 0 && item(tr.extraChance, percent(crop.yield.extraChance)),
				item(tr.harvestsOneSeed, String(stats.harvests)),
				item(tr.profitPerDay, stats.profitPerDay === null ? "—" : h("span", { class: goldClass(stats.profitPerDay) }, gold(stats.profitPerDay))),
			),
			h(
				"div",
				{ class: "prices" },
				QUALITIES.map((q) =>
					h("span", { class: "price", title: qualityName(q) }, QUALITY_ICON[q] ? h("img", { src: img.ui(QUALITY_ICON[q]!), alt: qualityName(q) }) : h("span", { class: "muted" }, qualityName(q)), gold(sellPrice(crop, q, state.settings))),
				),
			),
			[crop.trellis && tr.trellis, crop.paddy && tr.paddy, crop.note && tx(crop.note)]
				.filter(Boolean)
				.map((text) => h("p", { class: "note" }, text as string)),
			h("a", { class: "btn", href: wikiUrl(crop), target: "_blank", rel: "noreferrer" }, icon("book-open"), tr.wiki),
		);
	}

	/* ---------- Jogador ---------- */

	private renderPlayer(state: AppState): void {
		const s = state.settings;
		const tr = t().drawer;
		const level = h("input", {
			type: "range",
			min: "0",
			max: "14",
			step: "1",
			class: "range",
			"aria-label": tr.farmingLevel,
			props: { value: String(s.farmingLevel) },
			onInput: () => setSettings({ farmingLevel: Number(level.value) }),
		});
		const check = (key: "tiller" | "agriculturist" | "irrigatedPaddy" | "showEvents", label: string, hint: string, image?: string) =>
			h(
				"label",
				{ class: "check check_card" },
				h("input", { type: "checkbox", props: { checked: s[key] }, onChange: (e) => setSettings({ [key]: (e.target as HTMLInputElement).checked }) }),
				image && h("img", { src: image, alt: "" }),
				h("span", null, h("b", null, label), h("small", null, hint)),
			);

		const oddsTable = (fertId: string, label: string) => {
			const odds = qualityOdds(s.farmingLevel, getFertilizer(fertId).quality);
			return h(
				"tr",
				null,
				h("th", null, label),
				QUALITIES.map((q) => h("td", { class: "num" }, percent(odds[q]))),
			);
		};

		mount(
			this.body,
			h(
				"section",
				{ class: "panel" },
				h("h3", null, h("img", { src: img.ui("farming"), alt: "" }), `${tr.farmingLevel}: `, h("b", { class: "level_value" }, s.farmingLevel)),
				level,
				h("p", { class: "hint" }, tr.levelHint),
				h(
					"div",
					{ class: "table_wrap" },
					h(
						"table",
						{ class: "table odds" },
						h("thead", null, h("tr", null, h("th", null, tr.qualityChance), QUALITIES.map((q) => h("th", { class: "num" }, QUALITY_ICON[q] ? h("img", { src: img.ui(QUALITY_ICON[q]!), alt: qualityName(q), title: qualityName(q) }) : qualityName(q))))),
						h("tbody", null, oddsTable("none", tr.fertNone), oddsTable("basic_fertilizer", tr.fertBasic), oddsTable("quality_fertilizer", tr.fertQuality), oddsTable("deluxe_fertilizer", tr.fertDeluxe)),
					),
				),
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, tr.professions),
				check("tiller", tr.tiller, tr.tillerHint, img.ui("tiller")),
				check("agriculturist", tr.agriculturist, tr.agriculturistHint, img.ui("agriculturist")),
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, tr.options),
				check("irrigatedPaddy", tr.irrigatedPaddy, tr.irrigatedPaddyHint),
				check("showEvents", tr.showEvents, tr.showEventsHint),
			),
		);
	}

	/* ---------- Dados ---------- */

	private renderData(state: AppState): void {
		const { view } = state;
		const tr = t().drawer;
		const where = locationName(view.location);
		const season = seasonName(view.season);
		const year = view.year + 1;
		const fileInput = h("input", {
			type: "file",
			accept: "application/json,.json",
			class: "sr",
			onChange: async () => {
				const file = fileInput.files?.[0];
				if (!file) return;
				try {
					const result = importData(await file.text());
					this.say(tr.imported(result.count, result.legacy));
				} catch {
					this.say(tr.importError, true);
				}
				fileInput.value = "";
			},
		});

		const confirmClear = (label: string, run: () => number | void) => () => {
			if (!confirm(tr.confirmClear(label))) return;
			const removed = run();
			this.say(typeof removed === "number" ? tr.deleted(removed) : tr.allDeleted);
		};

		mount(
			this.body,
			h(
				"section",
				{ class: "panel" },
				h("h3", null, icon("save"), tr.backup),
				h("p", { class: "hint" }, tr.savedHint(state.plantings.length)),
				h(
					"div",
					{ class: "btn_row" },
					h("button", { type: "button", class: "btn", onClick: () => this.download() }, icon("download"), tr.export),
					h("button", { type: "button", class: "btn", onClick: () => fileInput.click() }, icon("upload"), tr.import),
					fileInput,
				),
				h("p", { class: "hint" }, tr.importHint),
				this.status,
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, icon("trash"), tr.clear),
				h(
					"div",
					{ class: "btn_col" },
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear(tr.clearSeason(season, year, where), () => clearPlantings(view.location, ...seasonRange(view.year, view.season))) }, `${season} · ${where}`),
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear(tr.clearYear(year, where), () => clearPlantings(view.location, ...yearRange(view.year))) }, `${t().year(year)} · ${where}`),
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear(tr.clearEverything, () => clearAll()) }, tr.everything),
				),
			),
		);
	}

	private download(): void {
		const blob = new Blob([exportData()], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = h("a", { href: url, download: `${t().drawer.fileName}-${new Date().toISOString().slice(0, 10)}.json` });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		this.say(t().drawer.exported);
	}

	private say(message: string, error = false): void {
		this.status.textContent = message;
		this.status.classList.toggle("error", error);
	}
}
