// Median ratio between offers' road distance and map distance, in both games.
const ROAD_KM_PER_MAP_KM = 25;

/** Road distance estimate between two map positions, or null when one is unknown. */
export const estimateRoadKm = (
	origin: [number, number] | undefined,
	destination: [number, number] | undefined
): number | null => {
	if (!origin || !destination) return null;
	const mapKm =
		Math.hypot(origin[0] - destination[0], origin[1] - destination[1]) / 1000;
	return Math.max(Math.round(mapKm * ROAD_KM_PER_MAP_KM), 1);
};
