import { useState, useContext, useMemo } from "react";

// UI
import { useDisclosure } from "@heroui/use-disclosure";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
} from "@heroui/modal";
import AlertSave from "@/components/AlertSave";
import Warning from "@/components/Warning";
import Step from "@/routes/pages/RoutesOptions/RouteStep";

// Hooks
import { ProfileContex } from "@/hooks/useProfileContex";
import { LocaleContext } from "@/hooks/useLocaleContext";

// Utils
import { getSaveCarRouteData, setCustomCarRoute } from "@/utils/fileEdit";
import { formatCityName, getCityCountryOrState } from "@/utils/citiesData";
import { formatCompanyName } from "@/utils/companiesData";
import { estimateRoadKm } from "@/utils/routeDistance";

// Icons
import {
	IconCar,
	IconPencil,
	IconRefresh,
	IconMapPin,
	IconPackage,
	IconFlag,
	IconUser,
	IconCircleCheck,
} from "@tabler/icons-react";

// Types
import {
	ResponseSaveCarRouteData,
	CarRoutePayload,
} from "@/types/fileEditTypes";

const titleCase = (value: string) =>
	value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const CreateCarRouteModal = () => {
	const { selectedSave, game } = useContext(ProfileContex);
	const { translations, lang } = useContext(LocaleContext);
	const text = translations.menu_options.routes.create_car_route.modal;

	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const [loadingData, setLoadingData] = useState<boolean>(false);
	const [routeData, setRouteData] = useState<ResponseSaveCarRouteData | null>(
		null
	);
	const [onlyDiscovered, setOnlyDiscovered] = useState<boolean>(true);
	const [showLocked, setShowLocked] = useState<boolean>(false);
	const [longRouteTest, setLongRouteTest] = useState<boolean>(false);

	// Form selections. effective* values fall back to the first valid option, so
	// changing one step never leaves an invalid route.
	const [originCity, setOriginCity] = useState<string>("");
	const [originCompany, setOriginCompany] = useState<string>("");
	const [selectedJob, setSelectedJob] = useState<string>("");
	const [selectedCargo, setSelectedCargo] = useState<string>("");
	const [destCity, setDestCity] = useState<string>("");
	const [destCompany, setDestCompany] = useState<string>("");
	const [selectedCar, setSelectedCar] = useState<string>("");
	const [urgency, setUrgency] = useState<number>(0);
	const [prioTime, setPrioTime] = useState<boolean>(false);
	const [prioCargo, setPrioCargo] = useState<boolean>(false);
	const [prioAppearance, setPrioAppearance] = useState<boolean>(false);

	const [isApplying, setIsApplying] = useState<boolean>(false);
	const [failed, setFailed] = useState<boolean>(false);
	const [applied, setApplied] = useState<boolean>(false);

	const loadSaveRouteInfo = async () => {
		if (!selectedSave) return;
		setLoadingData(true);
		setApplied(false);
		const data = await getSaveCarRouteData(selectedSave.dir, game);
		setRouteData(data);
		setLoadingData(false);

		if (data?.visited_cities.length === 0) setOnlyDiscovered(false);
	};

	const handleOpen = () => {
		onOpen();
		loadSaveRouteInfo();
	};

	const isAvailable = Boolean(routeData?.res);

	const cityName = (city: string) =>
		routeData?.cities[city]?.name || formatCityName(city);
	const cityRegion = (city: string) => {
		const known = getCityCountryOrState(city, game, lang);
		if (known && known !== "USA") return known;
		return titleCase(routeData?.cities[city]?.region || "");
	};
	const companyName = (company: string) =>
		routeData?.companies[company]?.name || formatCompanyName(company, game);
	const cargoName = (cargo: string) =>
		routeData?.cargos[cargo]?.name || titleCase(cargo);

	// "ford_bronco_24_azure_gray" -> model "ford_bronco_24" + color "Azure Gray"
	const carModel = (car: string) =>
		Object.keys(routeData?.models ?? {})
			.filter((model) => car.startsWith(model + "_"))
			.sort((a, b) => b.length - a.length)[0];
	const carName = (car: string) => {
		const model = carModel(car);
		if (!model) return titleCase(car);
		const color = titleCase(car.slice(model.length + 1));
		return `${routeData?.models[model]?.name || titleCase(model)} · ${color}`;
	};
	const carTypes = (car: string) =>
		routeData?.models[carModel(car) ?? ""]?.types ?? [];

	const jobLabel = (job: string) => {
		const data = routeData?.jobs[job];
		if (!data) return job;
		const name =
			data.name ||
			(data.cargos.length > 0 ? cargoName(data.cargos[0]) : titleCase(job));
		return `${name} · ${data.distance[0]}-${data.distance[1]} km`;
	};

	// STEP 1: origin, among the companies that take part in car jobs.
	const allCities = useMemo(
		() => routeData?.companies_by_city.map((c) => c.city) ?? [],
		[routeData]
	);
	const cityList = useMemo(() => {
		if (!routeData) return [];
		const visited = allCities.filter((city) =>
			routeData.visited_cities.includes(city)
		);
		return onlyDiscovered && visited.length > 0 ? visited : allCities;
	}, [routeData, allCities, onlyDiscovered]);

	const sortCities = (cities: string[]) =>
		[...cities].sort((a, b) => cityName(a).localeCompare(cityName(b)));
	const companiesOf = (city: string) =>
		routeData?.companies_by_city.find((c) => c.city === city)?.companies ?? [];

	const originCityList = sortCities(cityList);
	const effectiveOriginCity = originCityList.includes(originCity)
		? originCity
		: originCityList[0] || "";
	const originCompanies = companiesOf(effectiveOriginCity);
	const effectiveOriginCompany = originCompanies.includes(originCompany)
		? originCompany
		: originCompanies[0] || "";

	// STEP 2: jobs a car of this save can do, within the player's courier rating.
	const jobList = useMemo(() => {
		if (!routeData) return [];
		return Object.entries(routeData.jobs)
			.filter(([, job]) => showLocked || job.rating <= routeData.courier_rating)
			.filter(([, job]) =>
				routeData.cars.some((car) =>
					carTypes(car).some((type) => job.vehicle_types.includes(type))
				)
			)
			.map(([key]) => key)
			.sort((a, b) => jobLabel(a).localeCompare(jobLabel(b)));
		// carTypes and jobLabel only read routeData
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [routeData, showLocked]);

	const effectiveJob = jobList.includes(selectedJob)
		? selectedJob
		: jobList[0] || "";
	const job = routeData?.jobs[effectiveJob];
	const isDelivery = Boolean(job && job.cargos.length > 0);
	const cargoList = job?.cargos ?? [];
	const effectiveCargo = cargoList.includes(selectedCargo)
		? selectedCargo
		: cargoList[0] || "";
	const isLockedJob = Boolean(
		job && routeData && job.rating > routeData.courier_rating
	);

	// STEP 3: destination. The game drops offers outside the job's distance range,
	// so only companies inside it are offered (those without coordinates are kept).
	// Long route test mode lifts that limit and saves a distance inside the range.
	const originPosition =
		routeData?.positions[`${effectiveOriginCompany}.${effectiveOriginCity}`];
	const routeKm = (company: string, city: string) =>
		estimateRoadKm(originPosition, routeData?.positions[`${company}.${city}`]);
	const destinationsOf = (city: string) =>
		companiesOf(city).filter((company) => {
			if (city === effectiveOriginCity && company === effectiveOriginCompany)
				return false;
			const km = routeKm(company, city);
			if (!job) return false;
			if (longRouteTest) return km === null || km >= job.distance[0];
			return km === null || (km >= job.distance[0] && km <= job.distance[1]);
		});
	const destCityList = sortCities(
		cityList.filter((city) => destinationsOf(city).length > 0)
	);
	const effectiveDestCity = destCityList.includes(destCity)
		? destCity
		: destCityList.find((city) => city !== effectiveOriginCity) ||
			destCityList[0] ||
			"";
	const destCompanies = destinationsOf(effectiveDestCity);
	const effectiveDestCompany = destCompanies.includes(destCompany)
		? destCompany
		: destCompanies[0] || "";

	// STEP 4: company cars the job accepts.
	const carList = (routeData?.cars ?? []).filter((car) =>
		carTypes(car).some((type) => job?.vehicle_types.includes(type))
	);
	const effectiveCar = carList.includes(selectedCar)
		? selectedCar
		: carList[0] || "";

	const jobMinKm = job?.distance[0] ?? 0;
	const jobMaxKm = job?.distance[1] ?? 0;
	// Real route distance; the backend saves it clamped to the job's range.
	const distanceKm = Math.max(
		routeKm(effectiveDestCompany, effectiveDestCity) ??
			Math.round((jobMinKm + jobMaxKm) / 2),
		jobMinKm
	);
	const isShortened = distanceKm > jobMaxKm;

	const canApply =
		isAvailable &&
		Boolean(effectiveOriginCity && effectiveOriginCompany) &&
		Boolean(effectiveDestCity && effectiveDestCompany) &&
		Boolean(effectiveJob) &&
		(!isDelivery || Boolean(effectiveCargo)) &&
		Boolean(effectiveCar);

	const buildPayload = (): CarRoutePayload => ({
		source_city: effectiveOriginCity,
		source_company: effectiveOriginCompany,
		target_city: effectiveDestCity,
		target_company: effectiveDestCompany,
		job: effectiveJob,
		cargo: isDelivery ? effectiveCargo : null,
		company_car: effectiveCar,
		distance_km: distanceKm,
		urgency,
		prio_cargo_handling: prioCargo,
		prio_time: prioTime,
		prio_vehicle_appearance: prioAppearance,
		long_route_test: longRouteTest,
		game,
	});

	const applyCarRoute = async () => {
		if (!selectedSave || !canApply) return;

		setIsApplying(true);
		setFailed(false);
		const res = await setCustomCarRoute(selectedSave.dir, buildPayload(), game);
		setIsApplying(false);

		if (res) {
			setApplied(true);
		} else {
			setFailed(true);
		}
	};

	const cityItems = (cities: string[]) =>
		cities.map((city) => (
			<AutocompleteItem
				key={city}
				textValue={`${cityName(city)} ${cityRegion(city)}`}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="text-sm font-semibold">{cityName(city)}</span>
					<span className="text-default-400 text-xs">{cityRegion(city)}</span>
				</div>
			</AutocompleteItem>
		));

	const companyItems = (companies: string[]) =>
		companies.map((company) => (
			<AutocompleteItem key={company} textValue={companyName(company)}>
				{companyName(company)}
			</AutocompleteItem>
		));

	return (
		<>
			<Button
				endContent={<IconPencil stroke={2} />}
				onPress={handleOpen}
				isDisabled={!selectedSave}
				color="primary"
				variant="shadow"
			>
				{text.btn_open}
			</Button>

			<Modal
				size="3xl"
				backdrop="blur"
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				scrollBehavior="inside"
			>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader className="border-default-200 flex flex-col gap-1 border-b">
								<div className="flex items-center justify-between gap-2">
									<span className="flex items-center gap-2 text-xl font-bold">
										<IconCar className="text-primary" size={26} />
										{text.title}
									</span>
									<Button
										isIconOnly
										size="sm"
										variant="light"
										aria-label={text.btn_reload}
										onPress={loadSaveRouteInfo}
										isLoading={loadingData}
										className="mr-6"
									>
										<IconRefresh size={18} />
									</Button>
								</div>
								<p className="text-default-500 text-sm font-normal">
									{text.description}
								</p>
							</ModalHeader>

							<ModalBody className="gap-6 py-5">
								<AlertSave
									message={text.error_message}
									error={true}
									show={failed}
									setShowFalse={() => setFailed(false)}
								/>

								{loadingData ? (
									<div className="flex flex-col items-center justify-center gap-3 py-12">
										<Spinner size="lg" color="primary" />
										<p className="text-default-400 text-sm">
											{text.loading_data}
										</p>
									</div>
								) : !isAvailable ? (
									<Warning
										text={<div className="text-sm">{text.not_available}</div>}
									/>
								) : applied ? (
									<div className="flex flex-col items-center gap-3 py-8 text-center">
										<IconCircleCheck className="text-success" size={56} />
										<h3 className="text-xl font-bold">{text.success_title}</h3>
										<p className="text-default-600 max-w-md text-sm">
											{text.next_offer
												.replace(
													"{company}",
													companyName(effectiveOriginCompany)
												)
												.replace("{city}", cityName(effectiveOriginCity))}
										</p>
										<Button
											variant="flat"
											color="primary"
											onPress={loadSaveRouteInfo}
										>
											{text.btn_new_route}
										</Button>
									</div>
								) : (
									<>
										<Step
											number={1}
											icon={<IconMapPin size={18} />}
											title={text.step_origin}
										>
											<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
												<Autocomplete
													aria-label={text.origin_city_label}
													label={text.origin_city_label}
													selectedKey={effectiveOriginCity || null}
													onSelectionChange={(key) => {
														if (key) setOriginCity(key as string);
													}}
													size="sm"
													variant="bordered"
													isClearable={false}
												>
													{cityItems(originCityList)}
												</Autocomplete>
												<Autocomplete
													aria-label={text.origin_company_label}
													label={text.origin_company_label}
													selectedKey={effectiveOriginCompany || null}
													onSelectionChange={(key) => {
														if (key) setOriginCompany(key as string);
													}}
													size="sm"
													variant="bordered"
													isClearable={false}
												>
													{companyItems(originCompanies)}
												</Autocomplete>
											</div>
											<Switch
												isSelected={onlyDiscovered}
												onValueChange={setOnlyDiscovered}
												size="sm"
											>
												<span className="text-xs">
													{text.filter_discovered_only}
												</span>
											</Switch>
										</Step>

										<Step
											number={2}
											icon={<IconPackage size={18} />}
											title={text.step_job}
										>
											<Autocomplete
												aria-label={text.job_label}
												label={text.job_label}
												selectedKey={effectiveJob || null}
												onSelectionChange={(key) => {
													if (key) setSelectedJob(key as string);
												}}
												size="sm"
												variant="bordered"
												isClearable={false}
												description={
													job
														? text.distance_hint
																.replace("{min}", job.distance[0].toString())
																.replace("{max}", job.distance[1].toString())
														: undefined
												}
											>
												{jobList.map((key) => {
													const data = routeData?.jobs[key];
													return (
														<AutocompleteItem
															key={key}
															textValue={jobLabel(key)}
														>
															<div className="flex items-center justify-between gap-2">
																<span className="text-sm">{jobLabel(key)}</span>
																<span className="flex gap-1">
																	{data?.express && (
																		<Chip
																			size="sm"
																			color="warning"
																			variant="flat"
																		>
																			{text.job_express}
																		</Chip>
																	)}
																	<Chip size="sm" variant="flat">
																		{data && data.cargos.length > 0
																			? text.job_delivery
																			: text.job_driving}
																	</Chip>
																</span>
															</div>
														</AutocompleteItem>
													);
												})}
											</Autocomplete>
											{isDelivery && (
												<Select
													label={text.cargo_label}
													selectedKeys={
														effectiveCargo
															? new Set([effectiveCargo])
															: new Set([])
													}
													onSelectionChange={(keys) => {
														const val = Array.from(keys)[0] as string;
														if (val) setSelectedCargo(val);
													}}
													size="sm"
													variant="bordered"
												>
													{cargoList.map((cargo) => (
														<SelectItem
															key={cargo}
															textValue={cargoName(cargo)}
														>
															{cargoName(cargo)}
														</SelectItem>
													))}
												</Select>
											)}
											<Switch
												isSelected={showLocked}
												onValueChange={setShowLocked}
												size="sm"
												color="warning"
											>
												<span className="text-xs">{text.show_locked_jobs}</span>
											</Switch>
											{isLockedJob && job && (
												<p className="text-warning text-xs">
													{text.locked_job_hint.replace(
														"{rating}",
														job.rating.toString()
													)}
												</p>
											)}
										</Step>

										<Step
											number={3}
											icon={<IconFlag size={18} />}
											title={text.step_destination}
										>
											<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
												<Autocomplete
													aria-label={text.dest_city_label}
													label={text.dest_city_label}
													selectedKey={effectiveDestCity || null}
													onSelectionChange={(key) => {
														if (key) setDestCity(key as string);
													}}
													size="sm"
													variant="bordered"
													isClearable={false}
													description={
														destCityList.length === 0
															? text.no_destinations
															: longRouteTest
																? undefined
																: text.destination_hint
																		.replace("{min}", jobMinKm.toString())
																		.replace("{max}", jobMaxKm.toString())
													}
												>
													{cityItems(destCityList)}
												</Autocomplete>
												<Autocomplete
													aria-label={text.dest_company_label}
													label={text.dest_company_label}
													selectedKey={effectiveDestCompany || null}
													onSelectionChange={(key) => {
														if (key) setDestCompany(key as string);
													}}
													size="sm"
													variant="bordered"
													isClearable={false}
												>
													{companyItems(destCompanies)}
												</Autocomplete>
											</div>
											<Switch
												isSelected={longRouteTest}
												onValueChange={setLongRouteTest}
												size="sm"
												color="warning"
											>
												<span className="text-xs">{text.long_route_mode}</span>
											</Switch>
											{longRouteTest && isShortened && (
												<p className="text-warning text-xs">
													{text.long_route_hint
														.replace("{km}", distanceKm.toString())
														.replace("{max}", jobMaxKm.toString())}
												</p>
											)}
										</Step>

										<Step
											number={4}
											icon={<IconUser size={18} />}
											title={text.step_details}
										>
											<Select
												label={text.car_label}
												selectedKeys={
													effectiveCar ? new Set([effectiveCar]) : new Set([])
												}
												onSelectionChange={(keys) => {
													const val = Array.from(keys)[0] as string;
													if (val) setSelectedCar(val);
												}}
												size="sm"
												variant="bordered"
												description={
													carList.length === 0 ? text.no_cars : undefined
												}
											>
												{carList.map((car) => (
													<SelectItem key={car} textValue={carName(car)}>
														{carName(car)}
													</SelectItem>
												))}
											</Select>

											<div className="flex flex-wrap items-center gap-2">
												<span className="text-default-500 text-xs">
													{text.urgency_label}
												</span>
												{[
													text.urgency_normal,
													text.urgency_urgent,
													text.urgency_critical,
												].map((label, index) => (
													<Chip
														key={label}
														as="button"
														size="sm"
														variant={urgency === index ? "solid" : "flat"}
														color={urgency === index ? "primary" : "default"}
														onClick={() => setUrgency(index)}
													>
														{label}
													</Chip>
												))}
											</div>

											<div className="flex flex-col gap-2">
												<span className="text-default-500 text-xs">
													{text.prio_label}
												</span>
												<div className="flex flex-wrap gap-4">
													<Switch
														isSelected={prioTime}
														onValueChange={setPrioTime}
														size="sm"
													>
														<span className="text-xs">{text.prio_time}</span>
													</Switch>
													<Switch
														isSelected={prioCargo}
														onValueChange={setPrioCargo}
														size="sm"
													>
														<span className="text-xs">
															{text.prio_cargo_handling}
														</span>
													</Switch>
													<Switch
														isSelected={prioAppearance}
														onValueChange={setPrioAppearance}
														size="sm"
													>
														<span className="text-xs">
															{text.prio_vehicle_appearance}
														</span>
													</Switch>
												</div>
											</div>
										</Step>

										{routeData?.free_slots === 0 && (
											<p className="text-default-500 text-xs">
												{text.no_free_slots}
											</p>
										)}
										{routeData?.current_car_job && (
											<Warning
												text={
													<div className="text-xs">
														{text.active_job_warning}
													</div>
												}
											/>
										)}
										<p className="text-default-400 text-xs">
											{text.close_game_note}
										</p>
									</>
								)}
							</ModalBody>

							<ModalFooter className="border-default-200 flex flex-wrap items-center justify-between gap-3 border-t">
								{applied || loadingData || !isAvailable ? (
									<span />
								) : (
									<div className="flex min-w-0 flex-col text-xs">
										<span className="truncate font-semibold">
											{effectiveOriginCity && effectiveDestCity
												? `${cityName(effectiveOriginCity)} → ${cityName(effectiveDestCity)}`
												: ""}
										</span>
										<span className="text-default-500 truncate">
											{isDelivery && effectiveCargo
												? cargoName(effectiveCargo)
												: text.job_driving}{" "}
											·{" "}
											{text.distance_estimate.replace(
												"{km}",
												distanceKm.toString()
											)}
										</span>
									</div>
								)}
								<div className="flex items-center gap-2">
									<Button variant="light" onPress={onClose}>
										{text.btn_close}
									</Button>
									{!applied && !loadingData && isAvailable && (
										<Button
											endContent={<IconCar size={18} />}
											isLoading={isApplying}
											isDisabled={!canApply}
											color="success"
											onPress={applyCarRoute}
										>
											{text.btn_apply}
										</Button>
									)}
								</div>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</>
	);
};

export default CreateCarRouteModal;
