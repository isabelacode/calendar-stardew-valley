import type { Location } from "../domain/types";
import { applyLang, LANGS, t } from "../i18n";
import { setLang, setView, stepSeason } from "../state/actions";
import { store, type AppState } from "../state/store";
import { renderCalendar } from "./calendar";
import { DayDialog } from "./dayDialog";
import { h, mount } from "./dom";
import { Drawer } from "./drawer";
import { img } from "./format";
import { renderToolbar } from "./toolbar";
import { viewModel } from "./viewModel";

const LOCATION_CYCLE: Location[] = ["farm", "greenhouse", "island"];

export function startApp(root: HTMLElement): void {
	const toolbar = h("div", { class: "toolbar" });
	const calendar = h("section", { class: "calendar" });
	const masthead = h("header", { class: "masthead" });
	const hint = h("p", { class: "hint" });
	const footer = h("footer", { class: "site_footer" });
	const dialog = new DayDialog();
	const drawer = new Drawer();

	root.replaceChildren(masthead, h("main", { class: "board frame" }, toolbar, calendar, hint), footer, drawer.backdropEl, drawer.el, dialog.el);

	/** Partes fixas da página: só mudam quando o idioma muda */
	const renderStatic = (state: AppState) => {
		const tr = t().app;
		calendar.setAttribute("aria-label", tr.calendarAria);
		mount(
			masthead,
			h("img", { class: "logo", src: img.logo(), alt: "Stardew Valley" }),
			h("div", null, h("h1", null, tr.title), h("p", null, tr.tagline)),
			h(
				"div",
				{ class: "chips lang_switch", role: "radiogroup", "aria-label": t().language },
				LANGS.map((lang) =>
					h(
						"button",
						{
							type: "button",
							role: "radio",
							lang: lang === "pt" ? "pt-BR" : "en",
							"aria-checked": String(state.lang === lang),
							class: { chip: true, active: state.lang === lang },
							title: lang === "pt" ? "Português" : "English",
							onClick: () => setLang(lang),
						},
						lang.toUpperCase(),
					),
				),
			),
		);
		mount(hint, tr.hintIntro, h("kbd", null, "←"), " ", h("kbd", null, "→"), tr.hintSeason, h("kbd", null, "L"), tr.hintLocation, h("kbd", null, "C"), tr.hintCrops);
		mount(
			footer,
			tr.footerIntro,
			h("a", { href: "https://stardewvalleywiki.com/", target: "_blank", rel: "noreferrer" }, "Stardew Valley Wiki"),
			tr.footerIcons,
			h("a", { href: "https://pixelarticons.com/", target: "_blank", rel: "noreferrer" }, "Pixelarticons"),
			".",
		);
	};

	let shownLang: string | null = null;
	const render = (state: AppState) => {
		if (state.lang !== shownLang) {
			shownLang = state.lang;
			applyLang(state.lang);
			renderStatic(state);
			dialog.relabel();
			drawer.relabel();
		}
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
