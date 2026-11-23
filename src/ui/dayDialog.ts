import { toGameDate } from "../domain/calendar";
import { allCrops, allFertilizers, eventsOn, getCrop, getFertilizer } from "../domain/catalog";
import { daysToGrow } from "../domain/growth";
import type { CostEvent, HarvestEvent } from "../domain/schedule";
import { canPlant, ignoresSeasons, lastAliveDay, producesRepeatedly, seedCost } from "../domain/schedule";
import type { FertilizerData, Planting } from "../domain/types";
import { locale, t, tx } from "../i18n";
import { addPlanting, deletePlanting, setView, toggleRemovedAfter, updatePlanting } from "../state/actions";
import { store, type AppState } from "../state/store";
import { h, icon, mount } from "./dom";
import { formatDate, gold, goldClass, img, isRange, locationName } from "./format";
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
	private doneBtn = h("button", { type: "button", class: "btn btn_ok", onClick: () => this.close() });
	private form: FormState = { cropId: "", amount: 1, fertilizerId: "none", replant: false };

	constructor() {
		this.el = h(
			"dialog",
			{ class: "day_dialog frame", "aria-labelledby": "day-dialog-title" },
			this.header,
			h("div", { class: "dialog_body" }, this.formBox, this.lists),
			h("footer", { class: "dialog_footer" }, this.doneBtn),
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

	/** Textos fixos do quadro; chamado quando o idioma muda */
	relabel(): void {
		mount(this.doneBtn, icon("check"), t().day.done);
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
		const tr = t().day;
		mount(
			this.header,
			h("button", { type: "button", class: "btn btn_icon", title: `${tr.prev} (←)`, "aria-label": tr.prev, props: { disabled: day === 0 }, onClick: () => this.go(-1) }, icon("chevron-left")),
			h(
				"div",
				{ class: "dialog_title" },
				h("h2", { id: "day-dialog-title" }, formatDate(day, { weekday: true })),
				h(
					"p",
					null,
					h("img", { src: img.location(state.view.location), alt: "" }),
					` ${locationName(state.view.location)} · ${t().date.year(toGameDate(day).year + 1)}`,
					events.map((e) => h("span", { class: "tag" }, e.kind === "festival" ? `🎉 ${tx(e.name)}` : tr.birthdayOf(e.name))),
				),
			),
			h("button", { type: "button", class: "btn btn_icon", title: `${tr.next} (→)`, "aria-label": tr.next, onClick: () => this.go(1) }, icon("chevron-right")),
			h("button", { type: "button", class: "btn btn_icon btn_danger close_btn", title: `${tr.close} (Esc)`, "aria-label": tr.close, onClick: () => this.close() }, icon("close")),
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
		const tr = t().day;
		const crops = allCrops()
			.filter((c) => canPlant(c, location, day))
			.sort((a, b) => tx(a.name).localeCompare(tx(b.name), locale()));

		if (!crops.some((c) => c.id === this.form.cropId)) this.form.cropId = "";

		if (!crops.length) {
			mount(this.formBox, h("h3", null, tr.plant), h("p", { class: "empty" }, tr.nothingOnFarm));
			return;
		}

		const preview = h("p", { class: "plant_preview", "aria-live": "polite" });
		const cropSelect = h(
			"select",
			{ class: "input", "aria-label": tr.crop, onChange: () => update({ cropId: cropSelect.value }) },
			h("option", { value: "" }, tr.chooseSeed),
			crops.map((c) => h("option", { value: c.id, props: { selected: c.id === this.form.cropId } }, `${tx(c.name)}${c.seedPrice ? ` — ${gold(c.seedPrice)}` : ""}`)),
		);
		const amountInput = h("input", {
			class: "input input_num",
			type: "number",
			min: "1",
			max: "99999",
			inputmode: "numeric",
			"aria-label": tr.amount,
			props: { value: String(this.form.amount) },
			onInput: () => update({ amount: Math.max(0, Math.floor(Number(amountInput.value))) }),
		});
		const fertSelect = h(
			"select",
			{ class: "input", "aria-label": tr.fertilizer, onChange: () => update({ fertilizerId: fertSelect.value }) },
			allFertilizers().map((f) => h("option", { value: f.id, props: { selected: f.id === this.form.fertilizerId } }, fertilizerLabel(f))),
		);
		const replantBox = h("input", { type: "checkbox", props: { checked: this.form.replant }, onChange: () => update({ replant: replantBox.checked }) });
		const replantLabel = h("label", { class: "check", title: tr.replantHint }, replantBox, tr.replantAlways);
		const submit = h("button", { type: "submit", class: "btn btn_ok" }, icon("plus"), tr.plant);

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
			mount(preview, crop ? previewText(crop.id, this.form, day, state) : tr.previewEmpty);
		};

		mount(this.formBox, h("h3", null, h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), tr.plant), formEl, preview);
		sync();
	}
}

function fertilizerLabel(f: FertilizerData): string {
	return f.id === "none" ? t().day.noFertilizer : tx(f.name);
}

function previewText(cropId: string, form: FormState, day: number, state: AppState): Node[] {
	const tr = t().day;
	const crop = getCrop(cropId)!;
	const fert = getFertilizer(form.fertilizerId);
	const grow = daysToGrow(crop, fert, state.settings);
	const first = day + grow;
	const draft: Pick<Planting, "location" | "day" | "removedAfter"> = { location: state.view.location, day, removedAfter: null };
	const alive = lastAliveDay(crop, draft);
	const cost = seedCost(crop, Math.max(1, form.amount)) + (fert.price ?? 0) * Math.max(1, form.amount);

	const parts: Node[] = [h("span", { class: "gold neg" }, `−${gold(cost)}`), document.createTextNode(tr.growsIn(grow))];
	if (first > alive) {
		parts.push(h("strong", { class: "warn" }, tr.noTime));
		return parts;
	}
	parts.push(document.createTextNode(tr.firstHarvest(formatDate(first, { year: true }))));
	if (crop.regrow) {
		parts.push(document.createTextNode(tr.regrowsEvery(crop.regrow)));
		parts.push(ignoresSeasons(state.view.location) ? h("strong", null, tr.untilRemoved) : document.createTextNode(tr.until(formatDate(alive))));
	}
	if (crop.seedPrice === null) parts.push(h("span", { class: "muted" }, tr.seedNotSold));
	if (crop.note) parts.push(h("span", { class: "note" }, tx(crop.note)));
	return parts;
}

function plantingStatus(planting: Planting): Node | null {
	if (planting.removedAfter !== null) return h("span", { class: "tag tag_removed" }, t().day.removedAfter(formatDate(planting.removedAfter, { year: true })));
	if (producesRepeatedly(planting) && ignoresSeasons(planting.location)) return h("span", { class: "tag tag_forever", title: t().day.foreverHint }, t().day.forever);
	return null;
}

function plantedSection(planted: CostEvent[], replanted: CostEvent[], state: AppState) {
	const tr = t().day;
	if (!planted.length && !replanted.length) return h("p", { class: "empty" }, tr.nothingPlanted);

	const row = (ev: CostEvent) => {
		const p = ev.planting;
		const crop = ev.crop;
		const name = tx(crop.name);
		const fert = getFertilizer(p.fertilizerId);
		const grow = daysToGrow(crop, fert, state.settings);
		const amount = h("input", {
			class: "input input_num",
			type: "number",
			min: "1",
			"aria-label": tr.amountOf(name),
			props: { value: String(p.amount) },
			onChange: () => {
				const n = Math.floor(Number(amount.value));
				if (n >= 1) updatePlanting(p.id, { amount: n });
				else amount.value = String(p.amount);
			},
		});
		const fertSelect = h(
			"select",
			{ class: "input", "aria-label": tr.fertilizerOf(name), onChange: () => updatePlanting(p.id, { fertilizerId: fertSelect.value }) },
			allFertilizers().map((f) => h("option", { value: f.id, props: { selected: f.id === p.fertilizerId } }, fertilizerLabel(f))),
		);
		return h(
			"tr",
			null,
			h("td", { class: "sprite" }, h("img", { src: img.seed(crop), alt: "" })),
			h(
				"td",
				{ class: "name" },
				h("b", null, name),
				h("div", { class: "tags" }, p.replant && h("span", { class: "tag" }, tr.replantsTag), plantingStatus(p), fert.id !== "none" && h("img", { class: "fert_icon", src: img.fertilizer(fert.id), alt: tx(fert.name), title: tx(fert.name) })),
			),
			h("td", null, amount),
			h("td", null, h("span", { class: "select" }, fertSelect)),
			h("td", { class: "num" }, t().daysShort(grow)),
			h("td", { class: "num" }, h("span", { class: "gold neg" }, `−${gold(ev.amount)}`)),
			h("td", { class: "actions" }, h("button", { type: "button", class: "btn btn_icon btn_danger", title: tr.deleteHint, "aria-label": tr.deleteOf(name), onClick: () => deletePlanting(p.id) }, icon("trash"))),
		);
	};

	return h(
		"section",
		{ class: "panel" },
		h("h3", null, h("img", { src: img.seed(getCrop("parsnip")!), alt: "" }), tr.plantedToday),
		planted.length > 0 &&
			h(
				"div",
				{ class: "table_wrap" },
				h(
					"table",
					{ class: "table" },
					h("thead", null, h("tr", null, h("th", { colspan: "2" }, tr.crop), h("th", null, tr.qty), h("th", null, tr.fertilizer), h("th", { class: "num" }, tr.grows), h("th", { class: "num" }, tr.cost), h("th", null, h("span", { class: "sr" }, tr.actions)))),
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
						tr.autoReplant(ev.planting.amount, tx(ev.crop.name), formatDate(ev.planting.day)),
						h("span", { class: "gold neg" }, `−${gold(ev.amount)}`),
					),
				),
			),
	);
}

function harvestSection(harvests: HarvestEvent[], day: number) {
	const tr = t().day;
	if (!harvests.length) return h("p", { class: "empty" }, tr.noHarvest);

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
				h("b", null, tx(ev.crop.name)),
				h(
					"div",
					{ class: "tags" },
					ev.repeat && h("span", { class: "tag" }, ev.crop.regrow ? tr.regrowTag : tr.replantTag),
					h("span", { class: "tag tag_soft" }, tr.plantedOn(formatDate(p.day, { year: true }))),
					isLast && h("span", { class: "tag tag_removed" }, tr.lastHarvest),
				),
			),
			h("td", { class: "num" }, `×${ev.items.min}`, isRange(ev.items) && h("small", null, ` ${t().upTo(`×${ev.items.max}`)}`)),
			h("td", { class: "num" }, h("span", { class: goldClass(ev.revenue.min) }, gold(ev.revenue.min, true)), isRange(ev.revenue) && h("small", null, ` ${t().upTo(gold(ev.revenue.max))}`)),
			h(
				"td",
				{ class: "actions" },
				canRemove &&
					(isLast
						? h("button", { type: "button", class: "btn btn_small", title: tr.undoHint, onClick: () => toggleRemovedAfter(p.id, day) }, icon("reload"), tr.undo)
						: h("button", { type: "button", class: "btn btn_small btn_danger", title: tr.removeHint, onClick: () => toggleRemovedAfter(p.id, day) }, icon("trash"), tr.removeAfter)),
			),
		);
	};

	return h(
		"section",
		{ class: "panel" },
		h("h3", null, h("img", { src: img.ui("farming"), alt: "" }), tr.harvest),
		h(
			"div",
			{ class: "table_wrap" },
			h(
				"table",
				{ class: "table" },
				h("thead", null, h("tr", null, h("th", { colspan: "2" }, tr.crop), h("th", { class: "num" }, tr.items), h("th", { class: "num" }, tr.revenue), h("th", null, h("span", { class: "sr" }, tr.actions)))),
				h("tbody", null, harvests.map(row)),
			),
		),
	);
}
