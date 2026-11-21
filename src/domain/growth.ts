import type { CropData, FertilizerData, PlayerSettings } from "./types";

type GrowthModifiers = Pick<PlayerSettings, "agriculturist" | "irrigatedPaddy">;

/** Soma dos bônus de velocidade que se aplicam a esta plantação */
export function speedBonus(crop: CropData, fertilizer: FertilizerData, mods: GrowthModifiers): number {
	let bonus = fertilizer.speed;
	if (crop.paddy && mods.irrigatedPaddy) bonus += 0.25;
	if (mods.agriculturist) bonus += 0.1;
	return bonus;
}

/**
 * Dias até a primeira colheita.
 *
 * O jogo calcula quantos dias tirar (bônus × total, arredondado para cima) e
 * remove um dia por estágio, em até três passadas. O primeiro estágio nunca
 * fica com menos de 1 dia, por isso nem sempre todos os dias são removidos.
 */
export function daysToGrow(crop: CropData, fertilizer: FertilizerData, mods: GrowthModifiers): number {
	const stages = [...crop.stages];
	const total = stages.reduce((sum, d) => sum + d, 0);
	const bonus = speedBonus(crop, fertilizer, mods);
	if (bonus <= 0) return total;

	let toRemove = Math.ceil(total * bonus - 1e-9);
	for (let pass = 0; pass < 3 && toRemove > 0; pass++) {
		for (let i = 0; i < stages.length && toRemove > 0; i++) {
			const minimum = i === 0 ? 1 : 0;
			if (stages[i]! > minimum) {
				stages[i]!--;
				toRemove--;
			}
		}
	}
	return stages.reduce((sum, d) => sum + d, 0);
}
