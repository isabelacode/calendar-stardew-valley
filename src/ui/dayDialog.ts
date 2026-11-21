import { formatDate, toGameDate } from "../domain/calendar";
import { allCrops, allFertilizers, eventsOn, getCrop, getFertilizer } from "../domain/catalog";
import { daysToGrow } from "../domain/growth";
import type { CostEvent, HarvestEvent } from "../domain/schedule";
import { LOCATION_NAMES, canPlant, ignoresSeasons, lastAliveDay, producesRepeatedly, seedCost } from "../domain/schedule";
import type { Planting } from "../domain/types";
import { addPlanting, deletePlanting, setView, toggleRemovedAfter, updatePlanting } from "../state/actions";
import { store, type AppState } from "../state/store";
import { h, icon, mount } from "./dom";
import { gold, goldClass, img, isRange } from "./format";
import { viewModel } from "./viewModel";

interface FormState {
	cropId: string;
	amount: number;
	fertilizerId: string;
	replant: boolean;
}

export class DayDialog {
	readonly el: HTMLDialogElement;
	private day = -1;
	private header = h("header", { class: "dialog_header" });
	private formBox = h("section", { class: "panel plant_form" });
	private lists = h("div", { class: "dialog_lists" });
	private form: FormState = { cropId: "", amount: 1, fertilizerId: "none", replant: false };

	constructor() {
		this.el = h(
			"dialog",
			{ class: "day_dialog frame", "aria-labelledby": "day-dialog-title" },
			this.header,
			h("div", { class: "dialog_body" }, this.formBox, this.lists),
			h("footer", { class: "dialog_footer" }, h("button", { type: "button", class: "btn btn_ok", onClick: () => this.close() }, icon("check"), "Pronto")),
		);
		// Clique fora do quadro fecha
		this.el.addEventListener("click", (e) => {
			if (e.target === this.el) this.close();
		});
		this.el.addEventListener("keydown", (e) => {
			const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
			if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
			if (e.key === "ArrowLeft") this.go(-1);
			if (e.key === "ArrowRight") this.go(1);
		});
		this.el.addEventListener("close", () => (this.day = -1));
	}

	get isOpen(): boolean {
		return this.el.open;
	}

	open(day: number): void {
		this.day = day;
		this.render(store.get(), true);
		if (!this.el.open) this.el.showModal();
	}

	close(): void {
		this.el.close();
	}

	/** Chamado a cada mudança de estado */
	refresh(state: AppState): void {
		if (this.isOpen) this.render(state, false);
	}

	private go(delta: number): void {
		const next = this.day + delta;
		if (next < 0) return;
		this.day = next;
		// Mantém o calendário de fundo na mesma estação do dia aberto
		const { year, season } = toGameDate(next);
		const { view } = store.get();
		if (view.year !== year || view.season !== season) setView({ year, season });
		this.render(store.get(), true);
	}

	private render(state: AppState, rebuildForm: boolean): void {
		const day = this.day;
		const events = eventsOn(day);
		mount(
			this.header,
			h("button", { type: "button", class: "btn btn_icon", title: "Dia anterior (←)", "aria-label": "Dia anterior", props: { disabled: day === 0 }, onClick: () => this.go(-1) }, icon("chevron-left")),
			h(
				"div",
				{ class: "dialog_title" },
				h("h2", { id: "day-dialog-title" }, formatDate(day, { weekday: true })),
				h(
					"p",
					null,
					h("img", { src: img.location(state.view.location), alt: "" }),
					` ${LOCATION_NAMES[state.view.location]} · ${formatDate(day, { year: true }).split(", ").pop()}`,
					events.map((e) => h("span", { class: "tag" }, e.kind === "festival" ? `🎉 ${e.name}` : `Aniversário de ${e.name}`)),
				),
			),
			h("button", { type: "button", class: "btn btn_icon", title: "Próximo dia (→)", "aria-label": "Próximo dia", onClick: () => this.go(1) }, icon("chevron-right")),
			h("button", { type: "button", class: "btn btn_icon btn_danger close_btn", title: "Fechar (Esc)", "aria-label": "Fechar", onClick: () => this.close() }, icon("close")),
		);
		if (rebuildForm) this.renderForm(state);

		const entry = viewModel(state).ledger.days.get(day);
		mount(
			this.lists,
			plantedSection(entry?.planted ?? [], entry?.replanted ?? [], state),
			harvestSection(entry?.harvests ?? [], day),
		);
	}

	private renderForm(state: AppState): void {
		const day = this.day;
		const location = state.view.location;
		const crops = allCrops()
			.filter((c) => canPlant(c, location, day))
			.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

		if (!crops.some((c) => c.id === this.form.cropId)) this.form.cropId = "";

		if (!crops.length) {
			mount(this.formBox, h("h3", null, "Plantar"), h("p", { class: "empty" }, "Nada pode ser plantado na fazenda nesta estação. Use a Estufa ou a Ilha Gengibre."));
			return;
		}

		const preview = h("p", { class: "plant_preview", "aria-live": "polite" });
		const cropSelect = h(
			"select",
			{ class: "input", "aria-label": "Cultura", onChange: () => update({ cropId: cropSelect.value }) },
			h("option", { value: "" }, "Escolha uma semente…"),
			crops.map((c) => h("option", { value: c.id, props: { selected: c.id === this.form.cropId } }, `${c.name}${c.seedPrice ? ` — ${gold(c.seedPrice)}` : ""}`)),
		);
		const amountInput = h("input", {
			class: "input input_num",
			type: "number",
			min: "1",
			max: "99999",
			inputmode: "numeric",
			"aria-label": "Quantidade",
			props: { value: String(this.form.amount) },
			onInput: () => update({ amount: Math.max(0, Math.floor(Number(amountInput.value))) }),
		});
		const fertSelect = h(
			"select",
			{ class: "input", "aria-label": "Fertilizante", onChange: () => update({ fertilizerId: fertSelect.value }) },
			allFertilizers().map((f) => h("option", { value: f.id, props: { selected: f.id === this.form.fertilizerId } }, f.id === "none" ? "Sem fertilizante" : f.name)),
		);
		const replantBox = h("input", { type: "checkbox", props: { checked: this.form.replant }, onChange: () => update({ replant: replantBox.checked }) });
		const replantLabel = h("label", { class: "check", title: "Replanta a mesma semente no dia de cada colheita, enquanto der tempo de colher de novo" }, replantBox, "Replantar sempre");
		const submit = h("button", { type: "submit", class: "btn btn_ok" }, icon("plus"), "Plantar");

		const formEl = h(
			"form",
			{
				class: "plant_row",
				onSubmit: (e) => {
					e.preventDefault();
					if (!addPlanting({ ...this.form, day })) return;
					this.form.amount = 1;
					amountInput.value = "1";
					sync();
				},
			},
			h("span", { class: "select grow" }, cropSelect),
			amountInput,
			h("span", { class: "select" }, fertSelect),
			replantLabel,
			submit,
		);

		const update = (patch: Partial<FormState>) => {
			Object.assign(this.form, patch);
			sync();
		};

		const sync = () => {
			const crop = getCrop(this.form.cropId);
			const regrows = !!crop?.regrow;
			replantBox.disabled = !crop || regrows;
			// Culturas que rebrotam não precisam replantar
			replantBox.checked = !replantBox.disabled && this.form.replant;
			replantLabel.classList.toggle("disabled", replantBox.disabled);
			submit.disabled = !crop || this.form.amount < 1;
			mount(preview, crop ? previewText(crop.id, this.form, day, state) : "Escolha a semente, a quantidade e o fertilizante.");
		};

		mount(this.formBox, h("h3", null, h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), "Plantar"), formEl, preview);
		sync();
	}
}

function previewText(cropId: string, form: FormState, day: number, state: AppState): Node[] {
	const crop = getCrop(cropId)!;
	const fert = getFertilizer(form.fertilizerId);
	const grow = daysToGrow(crop, fert, state.settings);
	const first = day + grow;
	const draft: Pick<Planting, "location" | "day" | "removedAfter"> = { location: state.view.location, day, removedAfter: null };
	const alive = lastAliveDay(crop, draft);
	const cost = seedCost(crop, Math.max(1, form.amount)) + (fert.price ?? 0) * Math.max(1, form.amount);

	const parts: Node[] = [h("span", { class: "gold neg" }, `−${gold(cost)}`), document.createTextNode(` · cresce em ${grow} dias`)];
	if (first > alive) {
		parts.push(h("strong", { class: "warn" }, ` · não dá tempo de colher antes do fim da estação`));
		return parts;
	}
	parts.push(document.createTextNode(` · 1ª colheita em ${formatDate(first, { year: true })}`));
	if (crop.regrow) {
		parts.push(document.createTextNode(` · rebrota a cada ${crop.regrow} dias`));
		parts.push(ignoresSeasons(state.view.location) ? h("strong", null, " · produz até você arrancar") : document.createTextNode(` até ${formatDate(alive)}`));
	}
	if (crop.seedPrice === null) parts.push(h("span", { class: "muted" }, " · semente não vendida em lojas"));
	if (crop.note) parts.push(h("span", { class: "note" }, crop.note));
	return parts;
}

function plantingStatus(planting: Planting): Node | null {
	if (planting.removedAfter !== null) return h("span", { class: "tag tag_removed" }, `arrancada após ${formatDate(planting.removedAfter, { year: true })}`);
	if (producesRepeatedly(planting) && ignoresSeasons(planting.location)) return h("span", { class: "tag tag_forever", title: "Sem estações: continua produzindo nos anos seguintes até você arrancar" }, "produz sempre");
	return null;
}

function plantedSection(planted: CostEvent[], replanted: CostEvent[], state: AppState) {
	if (!planted.length && !replanted.length) return h("p", { class: "empty" }, "Nada plantado neste dia.");

	const row = (ev: CostEvent) => {
		const p = ev.planting;
		const crop = ev.crop;
		const fert = getFertilizer(p.fertilizerId);
		const grow = daysToGrow(crop, fert, state.settings);
		const amount = h("input", {
			class: "input input_num",
			type: "number",
			min: "1",
			"aria-label": `Quantidade de ${crop.name}`,
			props: { value: String(p.amount) },
			onChange: () => {
				const n = Math.floor(Number(amount.value));
				if (n >= 1) updatePlanting(p.id, { amount: n });
				else amount.value = String(p.amount);
			},
		});
		const fertSelect = h(
			"select",
			{ class: "input", "aria-label": `Fertilizante de ${crop.name}`, onChange: () => updatePlanting(p.id, { fertilizerId: fertSelect.value }) },
			allFertilizers().map((f) => h("option", { value: f.id, props: { selected: f.id === p.fertilizerId } }, f.id === "none" ? "Sem fertilizante" : f.name)),
		);
		return h(
			"tr",
			null,
			h("td", { class: "sprite" }, h("img", { src: img.seed(crop), alt: "" })),
			h(
				"td",
				{ class: "name" },
				h("b", null, crop.name),
				h("div", { class: "tags" }, p.replant && h("span", { class: "tag" }, "replanta sempre"), plantingStatus(p), fert.id !== "none" && h("img", { class: "fert_icon", src: img.fertilizer(fert.id), alt: fert.name, title: fert.name })),
			),
			h("td", null, amount),
			h("td", null, h("span", { class: "select" }, fertSelect)),
			h("td", { class: "num" }, `${grow} d`),
			h("td", { class: "num" }, h("span", { class: "gold neg" }, `−${gold(ev.amount)}`)),
			h("td", { class: "actions" }, h("button", { type: "button", class: "btn btn_icon btn_danger", title: "Apagar esta plantação (e todas as colheitas dela)", "aria-label": `Apagar ${crop.name}`, onClick: () => deletePlanting(p.id) }, icon("trash"))),
		);
	};

	return h(
		"section",
		{ class: "panel" },
		h("h3", null, h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), "Plantado neste dia"),
		planted.length > 0 &&
			h(
				"div",
				{ class: "table_wrap" },
				h(
					"table",
					{ class: "table" },
					h("thead", null, h("tr", null, h("th", { colspan: "2" }, "Cultura"), h("th", null, "Qtd."), h("th", null, "Fertilizante"), h("th", { class: "num" }, "Cresce"), h("th", { class: "num" }, "Custo"), h("th", null, h("span", { class: "sr" }, "Ações")))),
					h("tbody", null, planted.map(row)),
				),
			),
		replanted.length > 0 &&
			h(
				"ul",
				{ class: "replant_list" },
				replanted.map((ev) =>
					h(
						"li",
						null,
						h("img", { src: img.seed(ev.crop), alt: "" }),
						`Replantio automático: ${ev.planting.amount}× ${ev.crop.name} (plantado em ${formatDate(ev.planting.day)}) `,
						h("span", { class: "gold neg" }, `−${gold(ev.amount)}`),
					),
				),
			),
	);
}

function harvestSection(harvests: HarvestEvent[], day: number) {
	if (!harvests.length) return h("p", { class: "empty" }, "Nenhuma colheita neste dia.");

	const row = (ev: HarvestEvent) => {
		const p = ev.planting;
		const isLast = p.removedAfter === day;
		const canRemove = producesRepeatedly(p);
		return h(
			"tr",
			{ class: { last_harvest: isLast } },
			h("td", { class: "sprite" }, h("img", { src: img.crop(ev.crop), alt: "" })),
			h(
				"td",
				{ class: "name" },
				h("b", null, ev.crop.name),
				h(
					"div",
					{ class: "tags" },
					ev.repeat && h("span", { class: "tag" }, ev.crop.regrow ? "rebrota" : "replantio"),
					h("span", { class: "tag tag_soft" }, `plantada em ${formatDate(p.day, { year: true })}`),
					isLast && h("span", { class: "tag tag_removed" }, "última colheita"),
				),
			),
			h("td", { class: "num" }, `×${ev.items.min}`, isRange(ev.items) && h("small", null, ` até ×${ev.items.max}`)),
			h("td", { class: "num" }, h("span", { class: goldClass(ev.revenue.min) }, gold(ev.revenue.min, true)), isRange(ev.revenue) && h("small", null, ` até ${gold(ev.revenue.max)}`)),
			h(
				"td",
				{ class: "actions" },
				canRemove &&
					(isLast
						? h("button", { type: "button", class: "btn btn_small", title: "Desfazer: a planta volta a produzir", onClick: () => toggleRemovedAfter(p.id, day) }, icon("reload"), "Desfazer")
						: h("button", { type: "button", class: "btn btn_small btn_danger", title: "Arranca a planta depois desta colheita; as anteriores continuam valendo", onClick: () => toggleRemovedAfter(p.id, day) }, icon("trash"), "Arrancar depois")),
			),
		);
	};

	return h(
		"section",
		{ class: "panel" },
		h("h3", null, h("img", { src: img.ui("farming"), alt: "" }), "Colheita"),
		h(
			"div",
			{ class: "table_wrap" },
			h(
				"table",
				{ class: "table" },
				h("thead", null, h("tr", null, h("th", { colspan: "2" }, "Cultura"), h("th", { class: "num" }, "Itens"), h("th", { class: "num" }, "Receita"), h("th", null, h("span", { class: "sr" }, "Ações")))),
				h("tbody", null, harvests.map(row)),
			),
		),
	);
}
