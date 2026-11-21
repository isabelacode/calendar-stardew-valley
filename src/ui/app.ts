import type { Location } from "../domain/types";
import { setView, stepSeason } from "../state/actions";
import { store, type AppState } from "../state/store";
import { renderCalendar } from "./calendar";
import { DayDialog } from "./dayDialog";
import { h } from "./dom";
import { Drawer } from "./drawer";
import { img } from "./format";
import { renderToolbar } from "./toolbar";
import { viewModel } from "./viewModel";

const LOCATION_CYCLE: Location[] = ["farm", "greenhouse", "island"];

export function startApp(root: HTMLElement): void {
	const toolbar = h("div", { class: "toolbar" });
	const calendar = h("section", { class: "calendar", "aria-label": "Calendário da estação" });
	const dialog = new DayDialog();
	const drawer = new Drawer();

	root.replaceChildren(
		h(
			"header",
			{ class: "masthead" },
			h("img", { class: "logo", src: img.logo(), alt: "Stardew Valley" }),
			h("div", null, h("h1", null, "Calendário de Plantio"), h("p", null, "Planeje cada estação e veja quanto ouro a sua fazenda rende · versão 1.6")),
		),
		h(
			"main",
			{ class: "board frame" },
			toolbar,
			calendar,
			h("p", { class: "hint" }, "Clique num dia para plantar. Atalhos: ", h("kbd", null, "←"), " ", h("kbd", null, "→"), " estação · ", h("kbd", null, "L"), " local · ", h("kbd", null, "C"), " culturas."),
		),
		h(
			"footer",
			{ class: "site_footer" },
			"Calendário não oficial. Stardew Valley © ConcernedApe. Dados da ",
			h("a", { href: "https://stardewvalleywiki.com/", target: "_blank", rel: "noreferrer" }, "Stardew Valley Wiki"),
			". Ícones: ",
			h("a", { href: "https://pixelarticons.com/", target: "_blank", rel: "noreferrer" }, "Pixelarticons"),
			".",
		),
		drawer.backdropEl,
		drawer.el,
		dialog.el,
	);

	const render = (state: AppState) => {
		const vm = viewModel(state);
		renderToolbar(toolbar, state, vm);
		renderCalendar(calendar, state, vm, (day) => dialog.open(day));
		dialog.refresh(state);
		drawer.refresh(state);
	};
	store.subscribe(render);
	render(store.get());

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && drawer.isOpen && !dialog.isOpen) {
			drawer.close();
			return;
		}
		const target = e.target as HTMLElement;
		const typing = target.matches("input, select, textarea, [contenteditable]");
		if (typing || dialog.isOpen || drawer.isOpen || e.altKey || e.ctrlKey || e.metaKey) return;

		const key = e.key.toLowerCase();
		if (key === "arrowleft") stepSeason(-1);
		else if (key === "arrowright") stepSeason(1);
		else if (key === "l") {
			const { location } = store.get().view;
			setView({ location: LOCATION_CYCLE[(LOCATION_CYCLE.indexOf(location) + 1) % LOCATION_CYCLE.length] });
		} else if (key === "c") drawer.open("crops");
		else return;
		e.preventDefault();
	});
}
