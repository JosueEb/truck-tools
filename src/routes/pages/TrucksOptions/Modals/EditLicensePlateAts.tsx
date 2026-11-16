import { useState, useContext, useEffect, useMemo, useRef } from "react";

// UI
import { useDisclosure } from "@heroui/use-disclosure";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
} from "@heroui/modal";
import AlertSave from "@/components/AlertSave";
import Warning from "@/components/Warning";

// Hooks
import { ProfileContex } from "@/hooks/useProfileContex";
import { LocaleContext } from "@/hooks/useLocaleContext";

// Utils
import {
	getLicensePlatesAts,
	getCurrentLicensePlatesAts,
	setLicensePlateAts,
} from "@/utils/fileEdit";
import {
	defaultDesign,
	drawPlate,
	plateTextPattern,
	randomPlateText,
	sanitizePlateText,
	MAX_PLATE_TEXT_LENGTH,
	PLATE_HEIGHT,
	PLATE_WIDTH,
} from "@/utils/atsLicensePlate";

// Icons
import { IconPencil, IconDeviceFloppy, IconDice5 } from "@tabler/icons-react";

// Types
import {
	AtsPlateCatalog,
	AtsPlateDesign,
	AtsPlateState,
	AtsPlateTarget,
	ResponseAtsCurrentPlates,
} from "@/types/fileEditTypes";

interface completedProps {
	error: boolean;
	completed: boolean;
}

interface PlatePreviewProps {
	stateId: string;
	state: AtsPlateState;
	design: AtsPlateDesign;
	text: string;
	side: "front" | "rear";
	label: string;
}

const PlatePreview = ({
	stateId,
	state,
	design,
	text,
	side,
	label,
}: PlatePreviewProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (canvasRef.current) {
			drawPlate(canvasRef.current, stateId, state, design, text, side).catch(
				() => undefined
			);
		}
	}, [stateId, state, design, text, side]);

	return (
		<div className="flex flex-col items-center gap-1">
			<canvas
				ref={canvasRef}
				width={PLATE_WIDTH}
				height={PLATE_HEIGHT}
				className="h-[120px] w-[240px] rounded-lg shadow-lg"
			/>
			<span className="text-default-500 text-xs">{label}</span>
		</div>
	);
};

const TARGETS: AtsPlateTarget[] = ["truck", "trailer", "car"];

interface EditLicensePlateAtsProps {
	defaultTarget?: AtsPlateTarget;
}

const EditLicensePlateAts = ({
	defaultTarget = "truck",
}: EditLicensePlateAtsProps) => {
	const { selectedSave } = useContext(ProfileContex);
	const { translations } = useContext(LocaleContext);
	const text = translations.menu_options.trucks.license_plate_ats.modal;

	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const [catalog, setCatalog] = useState<AtsPlateCatalog | null>(null);
	const [current, setCurrent] = useState<ResponseAtsCurrentPlates | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [loadError, setLoadError] = useState<boolean>(false);
	const [target, setTarget] = useState<AtsPlateTarget>(defaultTarget);
	const [stateId, setStateId] = useState<string>("");
	const [designId, setDesignId] = useState<string>("");
	const [plateText, setPlateText] = useState<string>("");
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [completed, setCompleted] = useState<completedProps>({
		error: false,
		completed: false,
	});

	const states = useMemo(
		() =>
			catalog
				? Object.entries(catalog.states).sort((a, b) =>
						a[1].name.localeCompare(b[1].name)
					)
				: [],
		[catalog]
	);
	const plateState = catalog?.states[stateId];
	const design = plateState?.designs.find((item) => item.id === designId);

	/** Selects the state, design and text of the target's current plate */
	const selectTarget = (
		newTarget: AtsPlateTarget,
		plates: ResponseAtsCurrentPlates | null,
		plateCatalog: AtsPlateCatalog
	) => {
		setTarget(newTarget);
		const plate = plates?.[newTarget];
		const ids = Object.keys(plateCatalog.states);
		const newStateId =
			plate && plateCatalog.states[plate.state]
				? plate.state
				: stateId && plateCatalog.states[stateId]
					? stateId
					: (ids.find((id) => id === "california") ?? ids[0]);
		const newState = plateCatalog.states[newStateId];
		const newDesign = defaultDesign(newState, newTarget);
		setStateId(newStateId);
		setDesignId(newDesign?.id ?? "");
		const currentText = plate
			? sanitizePlateText(plate.text, newState.chars)
			: "";
		setPlateText(currentText || (newDesign ? randomPlateText(newDesign) : ""));
	};

	const loadData = async () => {
		if (!selectedSave) return;
		setLoading(true);
		setLoadError(false);
		setCompleted({ error: false, completed: false });

		const [plateCatalog, plates] = await Promise.all([
			getLicensePlatesAts(),
			getCurrentLicensePlatesAts(selectedSave.dir),
		]);

		if (!plateCatalog || !plates || !plates.res) {
			setLoadError(true);
			setLoading(false);
			return;
		}

		setCatalog(plateCatalog);
		setCurrent(plates);
		const firstTarget = plates[defaultTarget]
			? defaultTarget
			: (TARGETS.find((item) => plates[item]) ?? defaultTarget);
		selectTarget(firstTarget, plates, plateCatalog);
		setLoading(false);
	};

	const onOpenModal = () => {
		onOpen();
		loadData();
	};

	const onChangeState = (newStateId: string) => {
		if (!catalog) return;
		const newState = catalog.states[newStateId];
		const newDesign = defaultDesign(newState, target);
		setStateId(newStateId);
		setDesignId(newDesign?.id ?? "");
		setPlateText(
			sanitizePlateText(plateText, newState.chars) ||
				(newDesign ? randomPlateText(newDesign) : "")
		);
	};

	const onClickApply = async () => {
		if (!selectedSave || !design) return;
		setIsSaving(true);
		setCompleted({ error: false, completed: false });

		const res = await setLicensePlateAts(
			selectedSave.dir,
			target,
			stateId,
			design.id,
			plateText
		);
		if (res) {
			const plates = await getCurrentLicensePlatesAts(selectedSave.dir);
			if (plates?.res) setCurrent(plates);
		}
		setCompleted({ error: !res, completed: true });
		setIsSaving(false);
	};

	const designLabel = (item: AtsPlateDesign) =>
		`${text.plate_types[item.type] ?? item.type} · ${plateTextPattern(item)}`;

	const targetPlate = current?.[target];
	const hasTarget = Boolean(targetPlate);
	const showRear =
		design !== undefined &&
		target !== "trailer" &&
		design.backgroundRear !== design.backgroundFront;
	const canApply = hasTarget && Boolean(design) && plateText.trim().length > 0;

	return (
		<>
			<Button
				endContent={<IconPencil stroke={2} />}
				onPress={onOpenModal}
				isDisabled={!selectedSave}
				color="primary"
				variant="shadow"
			>
				{text.btn_open}
			</Button>
			<Modal
				size="2xl"
				hideCloseButton
				backdrop="blur"
				scrollBehavior="inside"
				isOpen={isOpen}
				onOpenChange={onOpenChange}
			>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader className="flex flex-col gap-1">
								{text.title}
							</ModalHeader>
							<Divider />
							<ModalBody className="py-3">
								<p className="text-sm">{text.description}</p>
								{loading ? (
									<div className="flex items-center justify-center gap-2 py-10">
										<Spinner size="sm" />
										<span className="text-sm">{text.loading}</span>
									</div>
								) : loadError || !catalog ? (
									<Warning
										text={<div className="text-sm">{text.load_error}</div>}
									/>
								) : (
									<>
										<Tabs
											aria-label={text.target_label}
											selectedKey={target}
											onSelectionChange={(key) =>
												selectTarget(key as AtsPlateTarget, current, catalog)
											}
											color="primary"
											fullWidth
										>
											{TARGETS.map((item) => (
												<Tab key={item} title={text.targets[item]} />
											))}
										</Tabs>

										{!hasTarget ? (
											<Warning
												text={
													<div className="text-sm">
														{text.no_vehicle[target]}
													</div>
												}
											/>
										) : (
											<>
												{targetPlate && targetPlate.text && (
													<p className="text-default-500 text-xs">
														{text.current_plate.replace(
															"{plate}",
															`${targetPlate.text}${
																catalog.states[targetPlate.state]
																	? ` (${catalog.states[targetPlate.state].name})`
																	: ""
															}`
														)}
													</p>
												)}

												{plateState && design && (
													<div className="bg-default-100 flex flex-wrap items-center justify-center gap-4 rounded-xl p-4">
														<PlatePreview
															stateId={stateId}
															state={plateState}
															design={design}
															text={plateText}
															side={target === "trailer" ? "rear" : "front"}
															label={
																target === "trailer" || !showRear
																	? ""
																	: text.preview_front
															}
														/>
														{showRear && (
															<PlatePreview
																stateId={stateId}
																state={plateState}
																design={design}
																text={plateText}
																side="rear"
																label={text.preview_rear}
															/>
														)}
													</div>
												)}
												<p className="text-default-400 text-center text-xs">
													{text.preview_note}
												</p>

												<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
													<Autocomplete
														aria-label={text.input_state.label}
														label={text.input_state.label}
														placeholder={text.input_state.placeholder}
														selectedKey={stateId || null}
														onSelectionChange={(key) => {
															if (key) onChangeState(key as string);
														}}
														size="sm"
														variant="bordered"
														isClearable={false}
													>
														{states.map(([id, item]) => (
															<AutocompleteItem
																key={id}
																textValue={item.name}
																endContent={
																	<span className="text-default-400 text-xs">
																		{item.code}
																	</span>
																}
															>
																{item.name}
															</AutocompleteItem>
														))}
													</Autocomplete>
													<Select
														aria-label={text.input_design.label}
														label={text.input_design.label}
														placeholder={text.input_design.placeholder}
														selectedKeys={
															designId ? new Set([designId]) : new Set([])
														}
														onSelectionChange={(keys) => {
															const value = Array.from(keys)[0] as string;
															if (value) setDesignId(value);
														}}
														size="sm"
														variant="bordered"
													>
														{(plateState?.designs ?? []).map((item) => (
															<SelectItem
																key={item.id}
																textValue={designLabel(item)}
															>
																{designLabel(item)}
															</SelectItem>
														))}
													</Select>
												</div>

												<div className="flex items-start gap-2">
													<Input
														label={text.input_text.label}
														placeholder={text.input_text.placeholder}
														value={plateText}
														onValueChange={(value) =>
															setPlateText(
																sanitizePlateText(
																	value,
																	plateState?.chars ?? ""
																)
															)
														}
														maxLength={MAX_PLATE_TEXT_LENGTH}
														description={
															design
																? text.text_help.replace(
																		"{pattern}",
																		plateTextPattern(design)
																	)
																: undefined
														}
														size="sm"
														variant="bordered"
														classNames={{ input: "font-mono uppercase" }}
													/>
													<Button
														isIconOnly
														aria-label={text.btn_random}
														title={text.btn_random}
														variant="flat"
														className="mt-1"
														isDisabled={!design}
														onPress={() =>
															design && setPlateText(randomPlateText(design))
														}
													>
														<IconDice5 />
													</Button>
												</div>
											</>
										)}
									</>
								)}
								<AlertSave
									message={
										completed.error
											? translations.components.alert_on_save_default.error
											: translations.components.alert_on_save_default.succes
									}
									error={completed.error}
									show={completed.completed}
									setShowFalse={() =>
										setCompleted({ error: completed.error, completed: false })
									}
								/>
							</ModalBody>
							<ModalFooter>
								<Button
									isDisabled={isSaving}
									color="danger"
									variant="light"
									onPress={onClose}
								>
									{text.btn_close}
								</Button>
								<Button
									endContent={<IconDeviceFloppy />}
									isLoading={isSaving}
									isDisabled={!canApply}
									color="success"
									onPress={onClickApply}
								>
									{text.btn_apply}
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</>
	);
};

export default EditLicensePlateAts;
