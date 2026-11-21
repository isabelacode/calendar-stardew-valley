import { SEASON_NAMES, SEASONS, seasonRange, yearRange } from "../domain/calendar";
import { allCrops, getCrop, getFertilizer } from "../domain/catalog";
import { cropStats, type CropStats } from "../domain/cropStats";
import { QUALITIES, qualityOdds, sellPrice, type Quality } from "../domain/quality";
import { LOCATION_NAMES } from "../domain/schedule";
import type { CropData, SeasonId } from "../domain/types";
import { clearAll, clearPlantings, exportData, importData, setSettings } from "../state/actions";
import { store, type AppState } from "../state/store";
import { h, icon, mount } from "./dom";
import { gold, goldClass, img, percent, wikiUrl } from "./format";

type Tab = "crops" | "player" | "data";
type SeasonFilter = SeasonId | "all" | "indoor";
type SortKey = "name" | "grow" | "regrow" | "sell" | "profit";

const QUALITY_NAMES: Record<Quality, string> = { normal: "Normal", silver: "Prata", gold: "Ouro", iridium: "Irídio" };
const QUALITY_ICON: Partial<Record<Quality, string>> = { silver: "silver", gold: "gold", iridium: "iridium" };

const TABS: { id: Tab; label: string; image: string }[] = [
	{ id: "crops", label: "Culturas", image: img.crop(getCrop("parsnip")!) },
	{ id: "player", label: "Jogador", image: img.ui("farming") },
	{ id: "data", label: "Dados", image: img.ui("gold_coin") },
];

export class Drawer {
	readonly el: HTMLElement;
	private tab: Tab | null = null;
	private body = h("div", { class: "drawer_body" });
	private heading = h("h2", null);
	private tabButtons = new Map<Tab, HTMLButtonElement>();
	private backdrop = h("div", { class: "drawer_backdrop", onClick: () => this.close() });

	// Estado da aba Culturas
	private search = "";
	private filter: SeasonFilter = "all";
	private sort: SortKey = "profit";
	private sortDesc = true;
	private detail: string | null = null;
	private tableBody: HTMLElement | null = null;

	private status = h("p", { class: "status", role: "status" });

	constructor() {
		this.el = h(
			"aside",
			{ class: "drawer", "aria-label": "Painel lateral" },
			h(
				"nav",
				{ class: "drawer_tabs", "aria-label": "Painéis" },
				TABS.map((t) => {
					const btn = h("button", { type: "button", title: t.label, "aria-label": t.label, onClick: () => this.toggle(t.id) }, h("img", { src: t.image, alt: "" }));
					this.tabButtons.set(t.id, btn);
					return btn;
				}),
			),
			h(
				"div",
				{ class: "drawer_panel frame" },
				h("header", { class: "drawer_header" }, this.heading, h("button", { type: "button", class: "btn btn_icon", "aria-label": "Fechar painel", title: "Fechar (Esc)", onClick: () => this.close() }, icon("close"))),
				this.body,
			),
		);
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

		this.heading.textContent = TABS.find((t) => t.id === this.tab)!.label;
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
		const searchInput = h("input", {
			class: "input",
			type: "search",
			placeholder: "Buscar cultura…",
			"aria-label": "Buscar cultura",
			props: { value: this.search },
			onInput: () => {
				this.search = searchInput.value;
				this.renderCropRows(state);
			},
		});
		const filters: { id: SeasonFilter; label: string }[] = [
			{ id: "all", label: "Todas" },
			...SEASONS.map((id) => ({ id, label: SEASON_NAMES[id] })),
			{ id: "indoor", label: "Só estufa" },
		];
		const chips = h(
			"div",
			{ class: "chips", role: "radiogroup", "aria-label": "Estação" },
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
					h("thead", null, h("tr", null, h("th", null, h("span", { class: "sr" }, "Imagem")), sortHeader("name", "Cultura", ""), sortHeader("grow", "Dias"), sortHeader("regrow", "Rebrota"), sortHeader("sell", "Venda"), sortHeader("profit", "Lucro/dia"))),
					this.tableBody,
				),
			),
			h("p", { class: "hint" }, "Lucro/dia: 1 semente plantada no 1º dia da estação, replantando sempre, até o fim das estações dela. Usa o seu nível de cultivo e profissões."),
		);
		this.renderCropRows(state);
	}

	private renderCropRows(state: AppState): void {
		if (!this.tableBody) return;
		const term = this.search.trim().toLocaleLowerCase("pt-BR");
		const rows = allCrops()
			.filter((c) => {
				if (term && !c.name.toLocaleLowerCase("pt-BR").includes(term) && !c.nameEn.toLowerCase().includes(term)) return false;
				if (this.filter === "all") return true;
				if (this.filter === "indoor") return !!c.indoorOnly;
				return c.seasons.includes(this.filter);
			})
			.map((crop) => ({ crop, stats: cropStats(crop, state.settings) }));

		const value = (r: { crop: CropData; stats: CropStats }): number | string => {
			switch (this.sort) {
				case "name":
					return r.crop.name;
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
			const cmp = typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number);
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
							h("td", { class: "name" }, crop.name, crop.indoorOnly && h("span", { class: "tag tag_indoor" }, "estufa")),
							h("td", { class: "num" }, stats.grow),
							h("td", { class: "num" }, crop.regrow ?? "—"),
							h("td", { class: "num" }, gold(crop.sellPrice)),
							h("td", { class: "num" }, stats.profitPerDay === null ? h("span", { class: "muted", title: "Semente não vendida em lojas" }, "—") : h("span", { class: goldClass(stats.profitPerDay) }, gold(stats.profitPerDay))),
						),
					)
				: h("tr", null, h("td", { colspan: "6", class: "empty" }, "Nenhuma cultura encontrada.")),
		);
	}

	private showDetail(id: string | null): void {
		this.detail = id;
		this.render(store.get());
	}

	private renderCropDetail(state: AppState, crop: CropData): void {
		const stats = cropStats(crop, state.settings);
		const seasons = crop.seasons.length ? crop.seasons.map((s) => SEASON_NAMES[s]).join(", ") : "Só em ambiente fechado";
		const item = (label: string, value: Node | string) => h("div", null, h("dt", null, label), h("dd", null, value));

		mount(
			this.body,
			h("button", { type: "button", class: "btn btn_small", onClick: () => this.showDetail(null) }, icon("chevron-left"), "Todas as culturas"),
			h(
				"div",
				{ class: "crop_hero" },
				h("img", { src: img.crop(crop), alt: "" }),
				h("div", null, h("h3", null, crop.name), h("p", { class: "muted" }, crop.nameEn)),
				h("img", { src: img.seed(crop), alt: "Semente", title: "Semente" }),
			),
			h(
				"dl",
				{ class: "facts" },
				item("Estações", seasons),
				item("Cresce em", `${stats.grow} dias`),
				item("Rebrota", crop.regrow ? `a cada ${crop.regrow} dias` : "não"),
				item("Semente", crop.seedPrice === null ? "não vendida" : gold(crop.seedPrice)),
				item("Itens por colheita", crop.yield.max > crop.yield.min ? `${crop.yield.min}–${crop.yield.max}` : String(crop.yield.min)),
				crop.yield.extraChance > 0 && item("Chance de extra", percent(crop.yield.extraChance)),
				item("Colheitas (1 semente)", String(stats.harvests)),
				item("Lucro por dia", stats.profitPerDay === null ? "—" : h("span", { class: goldClass(stats.profitPerDay) }, gold(stats.profitPerDay))),
			),
			h(
				"div",
				{ class: "prices" },
				QUALITIES.map((q) =>
					h("span", { class: "price", title: QUALITY_NAMES[q] }, QUALITY_ICON[q] ? h("img", { src: img.ui(QUALITY_ICON[q]!), alt: QUALITY_NAMES[q] }) : h("span", { class: "muted" }, "Normal"), gold(sellPrice(crop, q, state.settings))),
				),
			),
			[crop.trellis && "Precisa de treliça (não dá para andar por cima).", crop.paddy && "Cultura de arrozal: cresce 25% mais rápido se irrigada.", crop.note]
				.filter(Boolean)
				.map((text) => h("p", { class: "note" }, text as string)),
			h("a", { class: "btn", href: wikiUrl(crop), target: "_blank", rel: "noreferrer" }, icon("book-open"), "Ver na Wiki"),
		);
	}

	/* ---------- Jogador ---------- */

	private renderPlayer(state: AppState): void {
		const s = state.settings;
		const level = h("input", {
			type: "range",
			min: "0",
			max: "14",
			step: "1",
			class: "range",
			"aria-label": "Nível de cultivo",
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
				h("h3", null, h("img", { src: img.ui("farming"), alt: "" }), "Nível de cultivo: ", h("b", { class: "level_value" }, s.farmingLevel)),
				level,
				h("p", { class: "hint" }, "Níveis acima de 10 vêm de comida e da conquista de Mestria."),
				h(
					"div",
					{ class: "table_wrap" },
					h(
						"table",
						{ class: "table odds" },
						h("thead", null, h("tr", null, h("th", null, "Chance de qualidade"), QUALITIES.map((q) => h("th", { class: "num" }, QUALITY_ICON[q] ? h("img", { src: img.ui(QUALITY_ICON[q]!), alt: QUALITY_NAMES[q], title: QUALITY_NAMES[q] }) : "Normal")))),
						h("tbody", null, oddsTable("none", "Sem fertilizante"), oddsTable("basic_fertilizer", "Básico"), oddsTable("quality_fertilizer", "Qualidade"), oddsTable("deluxe_fertilizer", "Premium")),
					),
				),
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, "Profissões"),
				check("tiller", "Lavrador", "Colheitas valem 10% a mais (nível 5).", img.ui("tiller")),
				check("agriculturist", "Agricultor", "Culturas crescem 10% mais rápido (nível 10, exige Lavrador).", img.ui("agriculturist")),
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, "Opções"),
				check("irrigatedPaddy", "Arrozal irrigado", "Arroz e inhame-coco plantados perto da água crescem 25% mais rápido."),
				check("showEvents", "Mostrar eventos", "Aniversários e festivais no calendário."),
			),
		);
	}

	/* ---------- Dados ---------- */

	private renderData(state: AppState): void {
		const { view } = state;
		const where = LOCATION_NAMES[view.location];
		const seasonName = SEASON_NAMES[SEASONS[view.season]!];
		const fileInput = h("input", {
			type: "file",
			accept: "application/json,.json",
			class: "sr",
			onChange: async () => {
				const file = fileInput.files?.[0];
				if (!file) return;
				try {
					const result = importData(await file.text());
					this.say(`${plural(result.count, "plantação importada", "plantações importadas")}${result.legacy ? " do planejador antigo" : ""}.`);
				} catch {
					this.say("Não consegui ler esse arquivo. Use um arquivo exportado por este calendário ou pelo planejador antigo.", true);
				}
				fileInput.value = "";
			},
		});

		const confirmClear = (label: string, run: () => number | void) => () => {
			if (!confirm(`Apagar ${label}? Não dá para desfazer.`)) return;
			const removed = run();
			this.say(typeof removed === "number" ? `${plural(removed, "plantação apagada", "plantações apagadas")}.` : "Tudo apagado.");
		};

		mount(
			this.body,
			h(
				"section",
				{ class: "panel" },
				h("h3", null, icon("save"), "Backup"),
				h("p", { class: "hint" }, `Seus planos ficam salvos neste navegador (${plural(state.plantings.length, "plantação", "plantações")}). Exporte para guardar ou levar para outro computador.`),
				h(
					"div",
					{ class: "btn_row" },
					h("button", { type: "button", class: "btn", onClick: () => this.download() }, icon("download"), "Exportar"),
					h("button", { type: "button", class: "btn", onClick: () => fileInput.click() }, icon("upload"), "Importar"),
					fileInput,
				),
				h("p", { class: "hint" }, "Importar substitui os planos atuais. Aceita também arquivos exportados pelo planejador antigo."),
				this.status,
			),
			h(
				"section",
				{ class: "panel" },
				h("h3", null, icon("trash"), "Limpar"),
				h(
					"div",
					{ class: "btn_col" },
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear(`as plantações de ${seasonName} (ano ${view.year + 1}) na ${where}`, () => clearPlantings(view.location, ...seasonRange(view.year, view.season))) }, `${seasonName} · ${where}`),
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear(`as plantações do ano ${view.year + 1} na ${where}`, () => clearPlantings(view.location, ...yearRange(view.year))) }, `Ano ${view.year + 1} · ${where}`),
					h("button", { type: "button", class: "btn btn_danger", onClick: confirmClear("TODAS as plantações de todos os locais", () => clearAll()) }, "Tudo"),
				),
			),
		);
	}

	private download(): void {
		const blob = new Blob([exportData()], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = h("a", { href: url, download: `calendario-stardew-${new Date().toISOString().slice(0, 10)}.json` });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		this.say("Arquivo exportado.");
	}

	private say(message: string, error = false): void {
		this.status.textContent = message;
		this.status.classList.toggle("error", error);
	}
}

function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}
