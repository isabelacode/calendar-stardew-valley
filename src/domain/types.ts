export type SeasonId = "spring" | "summer" | "fall" | "winter";

/** Onde a plantação está. Estufa e Ilha Gengibre ignoram as estações. */
export type Location = "farm" | "greenhouse" | "island";

export interface CropData {
	id: string;
	name: string;
	nameEn: string;
	/** Estações em que cresce ao ar livre (vazio = só em ambiente fechado) */
	seasons: SeasonId[];
	/** Dias de cada estágio de crescimento */
	stages: number[];
	/** Dias entre colheitas depois da primeira (null = colheita única) */
	regrow: number | null;
	sellPrice: number;
	/** Preço da semente na loja (null = não vendida) */
	seedPrice: number | null;
	yield: {
		min: number;
		max: number;
		/** Chance de cada item extra (rolada repetidamente) */
		extraChance: number;
	};
	indoorOnly?: true;
	/** Arrozal: cresce 25% mais rápido se irrigado */
	paddy?: true;
	trellis?: true;
	note?: string;
}

export interface FertilizerData {
	id: string;
	name: string;
	price: number | null;
	/** Nível de qualidade: 0 nenhum, 1 básico, 2 qualidade, 3 premium */
	quality: number;
	/** Fração de redução no tempo de crescimento */
	speed: number;
	note?: string;
}

export type CalendarEvent =
	| { day: number; name: string; kind: "festival" }
	| { day: number; name: string; kind: "birthday"; portrait: string };

/**
 * Uma plantação feita pelo jogador.
 * Os dias são absolutos: 0 = dia 1 da Primavera do Ano 1.
 */
export interface Planting {
	id: string;
	cropId: string;
	location: Location;
	day: number;
	amount: number;
	fertilizerId: string;
	/** Culturas de colheita única: replantar no dia de cada colheita */
	replant: boolean;
	/** Dia (absoluto) da colheita depois da qual a planta foi arrancada */
	removedAfter: number | null;
}

export interface PlayerSettings {
	farmingLevel: number;
	tiller: boolean;
	agriculturist: boolean;
	irrigatedPaddy: boolean;
	showEvents: boolean;
}

export interface Range {
	min: number;
	max: number;
}
