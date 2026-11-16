import { SaveGame, ProfileDir, Model } from "@/types/SaveGameTypes";
import { IColor } from "react-color-palette";

export type themeTypes = "light" | "dark";
export type themeTypesSystem = "system" | "light" | "dark";

export interface responseRustTypes {
	res: boolean;
}

export interface responseProfileSaves extends responseRustTypes {
	save_games: SaveGame[];
}

export interface responseProfileSavesCount extends responseRustTypes {
	saves: number;
}

export interface responseTrucksInfo extends responseRustTypes {
	models: Model[];
}

export interface responseProfileDir extends responseRustTypes {
	profiles: ProfileDir[];
}

export interface responseSystemTheme extends responseRustTypes {
	theme: themeTypes;
}

export interface responseGetDeveloperValues extends responseRustTypes {
	developer: boolean;
	console: boolean;
	active_max_convoy_mode: boolean;
}

export interface licensePlateSaved {
	id: string;
	text: string;
	color_margin: boolean;
	text_color: IColor;
	bg_color: IColor;
}

export interface listLicensePlateSaved {
	license_plates_ets2: licensePlateSaved[];
}

export interface IColorRgbToValidate {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

export interface IColorHsvToValidate {
	readonly h: number;
	readonly s: number;
	readonly v: number;
	readonly a: number;
}

export interface SaveTrucks {
	brand_name: string;
	truck_id: string;
	truck_number: number;
}

export interface ResponseSaveGameTrucks extends responseRustTypes {
	current_truck_id: string;
	trucks: SaveTrucks[];
}

export interface SaveTrailers {
	brand_name: string;
	trailer_id: string;
	trailer_number: number;
}

export interface ResponseSaveGameTrailers extends responseRustTypes {
	current_trailer_id: string | null;
	trailers: SaveTrailers[];
}

export interface ResponseSaveCameraPositions extends responseRustTypes {
	location: string;
	rotation: string;
}

export interface CityCompany {
	city: string;
	companies: string[];
}

export interface CurrentJobInfo {
	cargo: string;
	source_city: string;
	source_company: string;
	target_city: string;
	target_company: string;
	units_count: number;
	urgency: number;
	distance_km: number;
}

export interface TrailerDefinitionOption {
	definition: string;
	variant: string;
	label: string;
	max_units: number;
}

export interface ResponseSaveGameRouteData extends responseRustTypes {
	visited_cities: string[];
	all_cities: string[];
	companies_by_city: CityCompany[];
	origin_companies_by_city: CityCompany[];
	cargos: string[];
	current_job: CurrentJobInfo | null;
	cargo_trailers: Record<string, TrailerDefinitionOption[]>;
	own_trailer: OwnTrailerInfo | null;
	companies: Record<string, CatalogCompany>;
	cities: Record<string, CatalogCity>;
	cargo_names: Record<string, string>;
	positions: Record<string, [number, number]>;
}

export interface OwnTrailerInfo {
	cargo_units: Record<string, number>;
}

export interface CatalogCompany {
	name: string;
	cargo_out: string[];
	cargo_in: string[];
}

export interface CatalogCity {
	name: string;
	region: string;
}

export interface CarCatalogJob {
	name: string;
	cargos: string[];
	vehicle_types: string[];
	express: boolean;
	distance: [number, number];
	rating: number;
}

export interface CarCatalogCargo {
	name: string;
	fragility: number;
}

export interface CarCatalogModel {
	name: string;
	types: string[];
}

export interface CurrentCarJobInfo {
	job: string;
	cargo: string | null;
	source_city: string;
	source_company: string;
	target_city: string;
	target_company: string;
	distance_km: number;
}

export interface ResponseSaveCarRouteData extends responseRustTypes {
	visited_cities: string[];
	companies_by_city: CityCompany[];
	cars: string[];
	courier_rating: number;
	free_slots: number;
	current_car_job: CurrentCarJobInfo | null;
	jobs: Record<string, CarCatalogJob>;
	cargos: Record<string, CarCatalogCargo>;
	models: Record<string, CarCatalogModel>;
	companies: Record<string, CatalogCompany>;
	cities: Record<string, CatalogCity>;
	positions: Record<string, [number, number]>;
}

export interface CarRoutePayload {
	source_city: string;
	source_company: string;
	target_city: string;
	target_company: string;
	job: string;
	cargo: string | null;
	company_car: string;
	distance_km: number;
	urgency: number;
	prio_cargo_handling: boolean;
	prio_time: boolean;
	prio_vehicle_appearance: boolean;
	long_route_test: boolean;
	game?: string;
}

export type RouteStartMode = "offer" | "teleport" | "take_now";

export interface CustomRoutePayload {
	source_city: string;
	source_company: string;
	target_city: string;
	target_company: string;
	cargo: string;
	units_count: number;
	urgency: number;
	distance_km: number;
	apply_mode: "active_job" | "offer";
	trailer_mode?: "freight";
	trailer_definition?: string;
	trailer_variant?: string;
	start_mode?: RouteStartMode;
	game?: string;
}

export type AtsPlateTarget = "truck" | "trailer" | "car";

/** atlasX, atlasY, width, height, planeX, planeY, advance, image */
export type AtsPlateGlyph = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];

export interface AtsPlateFont {
	images: { file: string; scaleX: number; scaleY: number; padding: number }[];
	vertSpan: number;
	glyphs: Record<string, AtsPlateGlyph>;
}

export interface AtsPlateDesign {
	id: string;
	type: string;
	template: string;
	backgroundFront: string | null;
	backgroundRear: string | null;
	prefix: string;
	suffix: string;
	/** Options of each text position; literal characters have a single option */
	slots: string[][];
}

export interface AtsPlateState {
	name: string;
	code: string;
	chars: string;
	designs: AtsPlateDesign[];
	font: AtsPlateFont;
}

export interface AtsPlateCatalog {
	states: Record<string, AtsPlateState>;
}

export interface AtsCurrentPlate {
	text: string;
	state: string;
}

export interface ResponseAtsCurrentPlates {
	res: boolean;
	truck: AtsCurrentPlate | null;
	trailer: AtsCurrentPlate | null;
	car: AtsCurrentPlate | null;
}
