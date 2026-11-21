import type { FertilizerData } from "../domain/types";

export const FERTILIZERS: readonly FertilizerData[] = [
	{ id: "none", name: "Nenhum", price: null, quality: 0, speed: 0 },
	{ id: "basic_fertilizer", name: "Fertilizante básico", price: 100, quality: 1, speed: 0 },
	{ id: "quality_fertilizer", name: "Fertilizante de qualidade", price: 150, quality: 2, speed: 0 },
	{ id: "deluxe_fertilizer", name: "Fertilizante Premium", price: null, quality: 3, speed: 0, note: "Não vendido em lojas (fabricado / Loja de Gemas do Qi)" },
	{ id: "speed_gro", name: "Solo Foliar", price: 100, quality: 0, speed: 0.1 },
	{ id: "delux_speed_gro", name: "Solo Foliar Premium", price: 150, quality: 0, speed: 0.25 },
	{ id: "hyper_speed_gro", name: "Hiper Solo Foliar", price: null, quality: 0, speed: 0.33, note: "Não vendido em lojas (fabricado / Loja de Gemas do Qi)" },
];
