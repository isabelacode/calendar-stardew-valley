import { CROPS } from "../data/crops";
import { EVENTS } from "../data/events";
import { FERTILIZERS } from "../data/fertilizers";
import { SEASONS, toGameDate } from "./calendar";
import type { CalendarEvent, CropData, FertilizerData } from "./types";

const cropsById = new Map(CROPS.map((c) => [c.id, c]));
const fertilizersById = new Map(FERTILIZERS.map((f) => [f.id, f]));

export const NO_FERTILIZER = fertilizersById.get("none")!;

export function getCrop(id: string): CropData | undefined {
	return cropsById.get(id);
}

export function getFertilizer(id: string): FertilizerData {
	return fertilizersById.get(id) ?? NO_FERTILIZER;
}

export function allCrops(): readonly CropData[] {
	return CROPS;
}

export function allFertilizers(): readonly FertilizerData[] {
	return FERTILIZERS;
}

/** Eventos (aniversários/festivais) de um dia absoluto. Repetem todo ano. */
export function eventsOn(abs: number): readonly CalendarEvent[] {
	const { season, day } = toGameDate(abs);
	return EVENTS[SEASONS[season]!].filter((e) => e.day === day);
}
