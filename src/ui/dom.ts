export type Child = Node | string | number | null | undefined | false | Child[];

type EventHandlers = {
	[K in keyof HTMLElementEventMap as `on${Capitalize<K>}`]?: (event: HTMLElementEventMap[K]) => void;
};

export type Props = EventHandlers & {
	class?: string | false | null | undefined | Record<string, boolean | undefined>;
	style?: string;
	/** Propriedades do DOM (value, checked, disabled…) */
	props?: Record<string, unknown>;
	/** Qualquer outro atributo HTML (aria-*, data-*, title, type…) */
	[attr: string]: unknown;
};

function className(value: Props["class"]): string {
	if (!value) return "";
	if (typeof value === "string") return value;
	return Object.entries(value)
		.filter(([, on]) => on)
		.map(([name]) => name)
		.join(" ");
}

function append(parent: Node, child: Child): void {
	if (child === null || child === undefined || child === false) return;
	if (Array.isArray(child)) {
		for (const c of child) append(parent, c);
	} else {
		parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
	}
}

/** Cria um elemento: h("button", { class: "btn", onClick }, "Texto") */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(props ?? {})) {
		if (value === undefined || value === null || value === false) continue;
		if (key === "class") {
			const cls = className(value as Props["class"]);
			if (cls) el.className = cls;
		} else if (key === "props") {
			Object.assign(el, value);
		} else if (key.startsWith("on") && typeof value === "function") {
			el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
		} else {
			el.setAttribute(key, value === true ? "" : String(value));
		}
	}
	append(el, children);
	return el;
}

/** Substitui o conteúdo de um elemento */
export function mount(parent: Element, ...children: Child[]): void {
	parent.replaceChildren();
	append(parent, children);
}

export function icon(name: string): HTMLElement {
	return h("i", { class: `ico ico-${name}`, "aria-hidden": "true" });
}
