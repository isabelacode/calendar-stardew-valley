import type { FertilizerData } from "../domain/types";

export const FERTILIZERS: readonly FertilizerData[] = [
	{ id: "none", name: { pt: "Nenhum", en: "None" }, price: null, quality: 0, speed: 0 },
	{ id: "basic_fertilizer", name: { pt: "Fertilizante básico", en: "Basic Fertilizer" }, price: 100, quality: 1, speed: 0 },
	{ id: "quality_fertilizer", name: { pt: "Fertilizante de qualidade", en: "Quality Fertilizer" }, price: 150, quality: 2, speed: 0 },
	{ id: "deluxe_fertilizer", name: { pt: "Fertilizante Premium", en: "Deluxe Fertilizer" }, price: null, quality: 3, speed: 0, note: { pt: "Não vendido em lojas (fabricado / Loja de Gemas do Qi)", en: "Not sold in shops (crafted / Qi's Walnut Room)" } },
	{ id: "speed_gro", name: { pt: "Solo Foliar", en: "Speed-Gro" }, price: 100, quality: 0, speed: 0.1 },
	{ id: "delux_speed_gro", name: { pt: "Solo Foliar Premium", en: "Deluxe Speed-Gro" }, price: 150, quality: 0, speed: 0.25 },
	{ id: "hyper_speed_gro", name: { pt: "Hiper Solo Foliar", en: "Hyper Speed-Gro" }, price: null, quality: 0, speed: 0.33, note: { pt: "Não vendido em lojas (fabricado / Loja de Gemas do Qi)", en: "Not sold in shops (crafted / Qi's Walnut Room)" } },
];
