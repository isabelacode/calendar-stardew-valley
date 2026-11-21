import type { CropData, PlayerSettings } from "./types";

export type Quality = "normal" | "silver" | "gold" | "iridium";
export const QUALITIES: readonly Quality[] = ["normal", "silver", "gold", "iridium"];

const PRICE_MULTIPLIER: Record<Quality, number> = {
	normal: 1,
	silver: 1.25,
	gold: 1.5,
	iridium: 2,
};

export type QualityOdds = Record<Quality, number>;

/**
 * Probabilidade de cada qualidade no primeiro item da colheita (1.6).
 * O jogo tenta, em ordem: irídio (só com Fertilizante Premium), ouro e prata.
 */
export function qualityOdds(farmingLevel: number, fertilizerQuality: number): QualityOdds {
	const level = Math.min(14, Math.max(0, Math.floor(farmingLevel)));
	const goldRoll = Math.min(1, 0.01 + 0.2 * (level / 10) + 0.2 * fertilizerQuality * ((level + 2) / 12));
	const silverRoll = Math.min(0.75, goldRoll * 2);
	const deluxe = fertilizerQuality >= 3;

	const iridium = deluxe ? goldRoll / 2 : 0;
	const gold = (1 - iridium) * goldRoll;
	// Com Fertilizante Premium o mínimo é prata
	const silver = (1 - iridium - gold) * (deluxe ? 1 : silverRoll);
	const normal = Math.max(0, 1 - iridium - gold - silver);
	return { normal, silver, gold, iridium };
}

/** Preço de venda de um item, já com o bônus de Lavrador */
export function sellPrice(crop: CropData, quality: Quality, settings: Pick<PlayerSettings, "tiller">): number {
	const base = Math.floor(crop.sellPrice * PRICE_MULTIPLIER[quality]);
	return settings.tiller ? Math.floor(base * 1.1) : base;
}

/** Itens esperados por planta: pilha média + itens extras (série geométrica) */
export function expectedItemsPerPlant(crop: CropData): number {
	const { min, max, extraChance } = crop.yield;
	const p = Math.min(0.9, extraChance);
	return (min + Math.max(min, max)) / 2 + p / (1 - p);
}
