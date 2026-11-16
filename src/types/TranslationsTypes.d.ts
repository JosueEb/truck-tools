/**
 * Auto-generated interfaces for more convenience when writing translations
 * https://app.quicktype.io/
 * Remember to disable “Merge similar classes” to not have optional parameters
 */

export type Langs =
	| "en-US"
	| "es-CL"
	| "zh-Hans"
	| "fr-FR"
	| "vi-VN"
	| "pt-BR"
	| "ko-KR"
	| "zh-Hant"
	| "uk-UA"
	| "de-DE"
	| "pl-PL"
	| "ru-RU"
	| "ro-RO"
	| "tr-TR"
	| "jp-JP";

export interface TranslationsTypes {
	components: Components;
	menu_options: MenuOptions;
}

export interface Components {
	alert_on_save_default: AlertOnSaveDefault;
	license_plate: ComponentsLicensePlate;
	player_profile: PlayerProfile;
	profile_error: ProfileError;
	updater: Updater;
}

export interface AlertOnSaveDefault {
	error: string;
	succes: string;
}

export interface ComponentsLicensePlate {
	btn_delete: string;
	btn_load: string;
	btn_store: string;
	input_colored_margin: string;
	input_license_plate: Input;
	input_license_plate_list_store: Input;
	title_select_bg_color: string;
	title_select_text_color: string;
}

export interface Input {
	label: string;
	placeholder: string;
}

export interface PlayerProfile {
	btn_profile: string;
	dropdown: Dropdown;
	input_select_profile: InputSelectProfile;
	input_select_save: Input;
	no_selected_profile: string;
	no_selected_save: string;
	total_saves: string;
}

export interface Dropdown {
	profile_options: ProfileOptions;
	save_game_options: SaveGameOptions;
}

export interface ProfileOptions {
	btn_backup_profile: BtnBackupProfile;
	btn_clone_profile: BtnCloneProfile;
	btn_copy_config: BtnCopyConfig;
	btn_rename_profile: BtnRenameProfile;
	title: string;
}

export interface BtnBackupProfile {
	description: string;
	label: string;
	modal: BtnBackupProfileModal;
}

export interface BtnBackupProfileModal {
	btn_apply: string;
	btn_close: string;
	btn_open_folder: string;
	description: string;
	input_backup_destination: Input;
	save_folder_dialog: SaveFolderDialog;
	title: string;
}

export interface SaveFolderDialog {
	filters_name: FiltersName;
	title: string;
}

export interface FiltersName {
	zip: string;
}

export interface BtnCloneProfile {
	description: string;
	label: string;
	modal: BtnCloneProfileModal;
}

export interface BtnCloneProfileModal {
	btn_apply: string;
	btn_close: string;
	description: string;
	input_new_name: Input;
	title: string;
}

export interface BtnCopyConfig {
	description: string;
	label: string;
	modal: BtnCopyConfigModal;
}

export interface BtnCopyConfigModal {
	btn_apply: string;
	btn_close: string;
	description: string;
	input_select_profile: Input;
	title: string;
}

export interface BtnRenameProfile {
	description: string;
	label: string;
	modal: BtnRenameProfileModal;
}

export interface BtnRenameProfileModal {
	btn_apply: string;
	btn_close: string;
	description: string;
	input_new_name: Input;
	title: string;
}

export interface SaveGameOptions {
	btn_decrypt_save: Btn;
	btn_open_folder: Btn;
	title: string;
}

export interface Btn {
	description: string;
	label: string;
}

export interface InputSelectProfile {
	label: string;
	options: InputSelectProfileOptions;
	placeholder: string;
}

export interface InputSelectProfileOptions {
	save_load: string;
}

export interface ProfileError {
	btn_how_to: string;
	btn_how_to_disable: string;
	description: string;
	title: string;
}

export interface Updater {
	alert_message: string;
	btn_cancel: string;
	btn_manual_update: string;
	btn_update_now: string;
	downloading: string;
	release_notes: string;
	title: string;
	version: string;
}

export interface MenuOptions {
	about: About;
	profile: Profile;
	settings: Settings;
	trailers: Trailers;
	trucks: Trucks;
	routes: Routes;
}

export interface Routes {
	tab_title: string;
	create_route: CreateRouteCard;
	create_car_route: CreateCarRouteCard;
	convoy_share: ConvoyShareCard;
	cancel_job: CancelJobCard;
}

export interface CreateCarRouteCard {
	description_card: string;
	label_card: string;
	modal: CreateCarRouteModalTrans;
}

export interface CreateCarRouteModalTrans {
	active_job_warning: string;
	btn_apply: string;
	btn_close: string;
	btn_new_route: string;
	btn_open: string;
	btn_reload: string;
	car_label: string;
	cargo_label: string;
	close_game_note: string;
	description: string;
	dest_city_label: string;
	dest_company_label: string;
	distance_estimate: string;
	destination_hint: string;
	distance_hint: string;
	long_route_hint: string;
	long_route_mode: string;
	no_destinations: string;
	error_message: string;
	filter_discovered_only: string;
	job_delivery: string;
	job_driving: string;
	job_express: string;
	job_label: string;
	loading_data: string;
	locked_job_hint: string;
	next_offer: string;
	no_cars: string;
	no_free_slots: string;
	not_available: string;
	origin_city_label: string;
	origin_company_label: string;
	prio_cargo_handling: string;
	prio_label: string;
	prio_time: string;
	prio_vehicle_appearance: string;
	show_locked_jobs: string;
	step_destination: string;
	step_details: string;
	step_job: string;
	step_origin: string;
	success_title: string;
	title: string;
	urgency_critical: string;
	urgency_label: string;
	urgency_normal: string;
	urgency_urgent: string;
}

export interface CreateRouteCard {
	description_card: string;
	label_card: string;
	modal: CreateRouteModalTrans;
}

export interface CreateRouteModalTrans {
	step_origin: string;
	step_cargo: string;
	step_destination: string;
	step_start: string;
	cargo_hint: string;
	show_unusual: string;
	no_cargos: string;
	mode_offer_title: string;
	mode_offer_desc: string;
	mode_teleport_title: string;
	mode_teleport_desc: string;
	mode_take_title: string;
	mode_take_desc: string;
	unavailable_no_place: string;
	unavailable_no_trailer: string;
	unavailable_active_job: string;
	btn_offer: string;
	btn_teleport: string;
	btn_take: string;
	btn_reload: string;
	btn_new_route: string;
	btn_convoy: string;
	success_title: string;
	next_offer: string;
	next_teleport: string;
	next_take: string;
	advanced: string;
	trailer_label: string;
	variant_label: string;
	distance_estimate: string;
	active_job_warning: string;
	close_game_note: string;
	title: string;
	description: string;
	btn_open: string;
	btn_close: string;
	filter_discovered_only: string;
	origin_city_label: string;
	origin_company_label: string;
	dest_city_label: string;
	dest_company_label: string;
	cargo_label: string;
	cargo_placeholder: string;
	urgency_label: string;
	urgency_normal: string;
	urgency_urgent: string;
	urgency_critical: string;
	units_count_label: string;
	loading_data: string;
	error_message: string;
}

export interface ConvoyShareCard {
	description_card: string;
	label_card: string;
	modal: ConvoyShareModalTrans;
}

export interface ConvoyShareModalTrans {
	title: string;
	description: string;
	btn_open: string;
	btn_import: string;
	btn_close: string;
	input_code_label: string;
	input_code_placeholder: string;
	invalid_code: string;
	other_game_code: string;
}

export interface CancelJobCard {
	description_card: string;
	label_card: string;
	modal: CancelJobModalTrans;
}

export interface CancelJobModalTrans {
	title: string;
	description: string;
	btn_open: string;
	btn_apply: string;
	btn_close: string;
	no_active_job: string;
	active_job_info: string;
	success_message: string;
	error_message: string;
}

export interface About {
	description: string;
	tab_title: string;
}

export interface Profile {
	add_experience: AddExperience;
	add_money: AddMoney;
	bus_skills: BusSkills;
	dealer_visited: DealerVisited;
	garage_status: GarageStatus;
	skills_points: SkillsPoints;
	tab_title: string;
	visited_cities: VisitedCities;
}

export interface BusSkills {
	description_card: string;
	label_card: string;
	modal: BusSkillsModal;
}

export interface BusSkillsModal {
	btn_apply: string;
	btn_close: string;
	btn_max: string;
	btn_open: string;
	description: string;
	ecodriving: string;
	input_experience: Input;
	long_duty: string;
	low_acceleration: string;
	satisfaction_decrease: string;
	satisfaction_increase: string;
	tight_schedule: string;
	title: string;
}

export interface AddExperience {
	description_card: string;
	label_card: string;
	modal: AddExperienceModal;
}

export interface AddExperienceModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_experience: Input;
	title: string;
}

export interface AddMoney {
	description_card: string;
	label_card: string;
	modal: AddMoneyModal;
}

export interface AddMoneyModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_money: Input;
	title: string;
}

export interface DealerVisited {
	description_card: string;
	label_card: string;
	modal: DealerVisitedModal;
}

export interface DealerVisitedModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_dealer_status: InputDealerStatus;
	title: string;
}

export interface InputDealerStatus {
	label: string;
	options: InputDealerStatusOptions;
}

export interface InputDealerStatusOptions {
	unvisit_all: string;
	visit_all: string;
}

export interface GarageStatus {
	description_card: string;
	label_card: string;
	modal: GarageStatusModal;
}

export interface GarageStatusModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_garage_status: InputGarageStatus;
	title: string;
}

export interface InputGarageStatus {
	label: string;
	options: InputGarageStatusOptions;
}

export interface InputGarageStatusOptions {
	large_garage: string;
	medium_garage: string;
	sell_garage: string;
	small_garage: string;
}

export interface SkillsPoints {
	description_card: string;
	label_card: string;
	modal: SkillsPointsModal;
}

export interface SkillsPointsModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	eco_driving: string;
	fragile_cargo: string;
	high_value_cargo: string;
	input_skills_points: InputSkillsPoints;
	just_in_time_delivery: string;
	long_distance: string;
	title: string;
}

export interface InputSkillsPoints {
	corrosive: string;
	explosives: string;
	flammable_liquids: string;
	flammable_solids: string;
	gases: string;
	label: string;
	placeholder: string;
	toxic_and_infectious: string;
}

export interface VisitedCities {
	description_card: string;
	label_card: string;
	modal: VisitedCitiesModal;
}

export interface VisitedCitiesModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_city_status: InputCityStatus;
	title: string;
}

export interface InputCityStatus {
	label: string;
	options: InputDealerStatusOptions;
}

export interface Settings {
	btn_reset: string;
	document_dialog_title: string;
	input_change_language: Input;
	input_change_theme: InputChangeTheme;
	input_document_folder: Input;
	input_enable_128_slots: string;
	input_enable_console: string;
	input_opacity_profile: string;
	tab_title: string;
	title: string;
}

export interface InputChangeTheme {
	label: string;
	options: InputChangeThemeOptions;
	placeholder: string;
}

export interface InputChangeThemeOptions {
	dark: string;
	light: string;
	system: string;
}

export interface Trailers {
	license_plate: TrailersLicensePlate;
	modify_job_weight: ModifyJobWeight;
	modify_trailer_weight: ModifyTrailerWeight;
	repair_all_trailer: RepairAllTrailer;
	repair_trailer: RepairTrailer;
	tab_title: string;
	unlock_trailer_country: UnlockTrailerCountry;
	change_trailer: ChangeTrailer;
}

export interface ChangeTrailer {
	description_card: string;
	label_card: string;
	modal: ChangeTrailerModal;
}

export interface ChangeTrailerModal {
	btn_apply: string;
	btn_how_to_use: string;
	btn_close: string;
	btn_open: string;
	description: string;
	title: string;
	select_label: string;
	select_error: string;
	select_placeholder: string;
	warning_message: PurpleWarningMessage;
}

export interface PurpleWarningMessage {
	title: string;
	message: string;
}

export interface TrailersLicensePlate {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface LicensePlateModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	title: string;
}

export interface ModifyJobWeight {
	description_card: string;
	label_card: string;
	modal: ModifyJobWeightModal;
}

export interface ModifyJobWeightModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_weight: Input;
	title: string;
}

export interface ModifyTrailerWeight {
	description_card: string;
	label_card: string;
	modal: ModifyTrailerWeightModal;
}

export interface ModifyTrailerWeightModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	input_body_mass: Input;
	input_chassis_mass: Input;
	title: string;
}

export interface RepairAllTrailer {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface RepairTrailer {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface UnlockTrailerCountry {
	description_card: string;
	label_card: string;
	modal: UnlockTrailerCountryModal;
}

export interface UnlockTrailerCountryModal {
	btn_apply: string;
	btn_close: string;
	btn_how_to_use: string;
	btn_open: string;
	description: string;
	title: string;
	warning_message: PurpleWarningMessage;
}

export interface Trucks {
	change_truck_engine: ChangeTruckEngine;
	change_truck_transmission: ChangeTruckTransmission;
	fill_all_trucks_fuel: FillAllTrucksFuel;
	fill_fuel: FillFuel;
	custom_fuel: CustomFuel;
	license_plate: TrucksLicensePlate;
	license_plate_ats: TrucksLicensePlateAts;
	repair_all_trucks: RepairAllTrucks;
	repair_truck: RepairTruck;
	change_km: ChangeKM;
	change_truck: ChangeTruck;
	teleport_player: TeleportPlayer;
	tab_title: string;
}

export interface ChangeKM {
	description_card: string;
	label_card: string;
	modal: ChangeKMModal;
}

export interface ChangeKMModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	description: string;
	title: string;
	input_km: Input;
}

export interface ChangeTruck {
	description_card: string;
	label_card: string;
	modal: ChangeTruckModal;
}

export interface ChangeTruckModal {
	btn_apply: string;
	btn_how_to_use: string;
	btn_close: string;
	btn_open: string;
	description: string;
	title: string;
	select_label: string;
	select_error: string;
	select_placeholder: string;
	warning_message: PurpleWarningMessage;
}

export interface ChangeTruckEngine {
	description_card: string;
	label_card: string;
	modal: ChangeTruckEngineModal;
}

export interface ChangeTruckEngineModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	btn_remove_badge: string;
	description: string;
	input_brands: Input;
	input_engines: Input;
	input_models: Input;
	title: string;
	warning_message: PurpleWarningMessage;
}

export interface ChangeTruckTransmission {
	description_card: string;
	label_card: string;
	modal: ChangeTruckTransmissionModal;
}

export interface ChangeTruckTransmissionModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	btn_remove_badge: string;
	description: string;
	input_brands: Input;
	input_models: Input;
	input_transmissions: Input;
	title: string;
	warning_message: PurpleWarningMessage;
}

export interface FillAllTrucksFuel {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface FillFuel {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface CustomFuel {
	description_card: string;
	label_card: string;
	modal: CustomFuelModal;
}

export interface CustomFuelModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	btn_restore_fuel: string;
	description: string;
	title: string;
	fuel_level: string;
	warning_message: PurpleWarningMessage;
}

export interface TrucksLicensePlate {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface TrucksLicensePlateAts {
	description_card: string;
	label_card: string;
	modal: LicensePlateAtsModal;
}

export interface LicensePlateAtsModal {
	btn_apply: string;
	btn_close: string;
	btn_open: string;
	btn_random: string;
	current_plate: string;
	description: string;
	input_design: Input;
	input_state: Input;
	input_text: Input;
	load_error: string;
	loading: string;
	no_vehicle: { car: string; trailer: string; truck: string };
	plate_types: Record<string, string>;
	preview_front: string;
	preview_note: string;
	preview_rear: string;
	target_label: string;
	targets: { car: string; trailer: string; truck: string };
	text_help: string;
	title: string;
}

export interface RepairAllTrucks {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface RepairTruck {
	description_card: string;
	label_card: string;
	modal: LicensePlateModal;
}

export interface TeleportPlayer {
	description_card: string;
	label_card: string;
	modal: TeleportPlayerModal;
}

export interface TeleportPlayerModal {
	btn_apply: string;
	btn_how_to_use: string;
	btn_close: string;
	btn_open: string;
	description: string;
	title: string;
	warning_message: FluffyWarningMessage;
}

export interface FluffyWarningMessage {
	title: string;
	message_1: string;
	message_2: string;
}
