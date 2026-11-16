import { useState, useContext } from "react";

// UI
import { useDisclosure } from "@heroui/use-disclosure";
import { Input } from "@heroui/input";
import { Slider } from "@heroui/slider";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
	Modal,
	ModalContent,
	ModalHeader,
	ModalBody,
	ModalFooter,
} from "@heroui/modal";
import AlertSave from "@/components/AlertSave";

// Hooks
import { ProfileContex } from "@/hooks/useProfileContex";
import { LocaleContext } from "@/hooks/useLocaleContext";

// Utils
import { setProfileBusSkills } from "@/utils/fileEdit";

// Icons
import { IconPencil, IconArrowBigUpLine } from "@tabler/icons-react";

// Types
import { BusExperienceSkillsTypes } from "@/types/SaveGameTypes";

interface completedProps {
	error: boolean;
	completed: boolean;
}

type BusSkillKey = Exclude<keyof BusExperienceSkillsTypes, "experience">;

// Every bus skill has max_rank 3 in def/skills.sii (ETS2 1.62)
const BUS_SKILL_MAX_RANK = 3;
// u32 limit on the Rust side
const MAX_EXPERIENCE = 4294967295;

const SetBusSkills = () => {
	const { selectedSave } = useContext(ProfileContex);
	const { translations } = useContext(LocaleContext);
	const { bus_skills } = translations.menu_options.profile;

	const { isOpen, onOpen, onOpenChange } = useDisclosure();

	const [Experience, setExperience] = useState<string>("5000000");
	const [Skills, setSkills] = useState<Record<BusSkillKey, number>>({
		longDuty: 0,
		tightSchedule: 0,
		satisfactionDecrease: 0,
		lowAcceleration: 0,
		satisfactionIncrease: 0,
		ecodriving: 0,
	});
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [completed, setCompleted] = useState<completedProps>({
		error: false,
		completed: false,
	});

	const SKILL_LIST: { key: BusSkillKey; label: string }[] = [
		{ key: "longDuty", label: bus_skills.modal.long_duty },
		{ key: "tightSchedule", label: bus_skills.modal.tight_schedule },
		{
			key: "satisfactionDecrease",
			label: bus_skills.modal.satisfaction_decrease,
		},
		{ key: "lowAcceleration", label: bus_skills.modal.low_acceleration },
		{
			key: "satisfactionIncrease",
			label: bus_skills.modal.satisfaction_increase,
		},
		{ key: "ecodriving", label: bus_skills.modal.ecodriving },
	];

	const isExperienceInvalid =
		Experience === "" || Number(Experience) > MAX_EXPERIENCE;

	const onClickApply = async () => {
		if (completed.completed) {
			setCompleted({ error: false, completed: false });
		}

		if (!selectedSave || isExperienceInvalid) return;

		setIsLoading(true);

		const res = await setProfileBusSkills(selectedSave.dir, {
			experience: Number(Experience),
			...Skills,
		});

		setCompleted({
			error: !res,
			completed: true,
		});
		setIsLoading(false);
	};

	const onClickMaxAll = () => {
		setSkills({
			longDuty: BUS_SKILL_MAX_RANK,
			tightSchedule: BUS_SKILL_MAX_RANK,
			satisfactionDecrease: BUS_SKILL_MAX_RANK,
			lowAcceleration: BUS_SKILL_MAX_RANK,
			satisfactionIncrease: BUS_SKILL_MAX_RANK,
			ecodriving: BUS_SKILL_MAX_RANK,
		});
	};

	const setExperienceNumbers = (value: string) => {
		const regex = /^[0-9]*$/;
		if (value === "" || regex.test(value)) {
			setExperience(value);
		}
	};

	return (
		<>
			<Button
				endContent={<IconPencil stroke={2} />}
				onPress={onOpen}
				isDisabled={!selectedSave}
				color="primary"
				variant="shadow"
			>
				{bus_skills.modal.btn_open}
			</Button>
			<Modal
				hideCloseButton
				size="md"
				backdrop="blur"
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				shouldBlockScroll={false}
			>
				<ModalContent>
					{(onClose) => (
						<>
							<ModalHeader className="flex flex-col gap-1">
								{bus_skills.modal.title}
							</ModalHeader>
							<Divider />
							<ModalBody className="py-1">
								<p>{bus_skills.modal.description}</p>
								<Input
									className="mt-1"
									startContent={<IconArrowBigUpLine />}
									isInvalid={isExperienceInvalid}
									label={bus_skills.modal.input_experience.label}
									placeholder={bus_skills.modal.input_experience.placeholder}
									value={Experience}
									onValueChange={(value) => setExperienceNumbers(value)}
									variant="bordered"
								/>
								{SKILL_LIST.map((skill) => (
									<Slider
										key={skill.key}
										size="lg"
										value={Skills[skill.key]}
										onChange={(e) =>
											setSkills({
												...Skills,
												[skill.key]: Array.isArray(e) ? e[0] : e,
											})
										}
										step={1}
										color="warning"
										label={skill.label}
										showSteps={true}
										maxValue={BUS_SKILL_MAX_RANK}
										minValue={0}
										className="max-w-md"
									/>
								))}
								<Button
									color="warning"
									variant="flat"
									size="sm"
									onPress={onClickMaxAll}
								>
									{bus_skills.modal.btn_max}
								</Button>
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
								<Button color="danger" variant="light" onPress={onClose}>
									{bus_skills.modal.btn_close}
								</Button>
								<Button
									endContent={<IconArrowBigUpLine />}
									isLoading={isLoading}
									isDisabled={isExperienceInvalid}
									color="success"
									onPress={onClickApply}
								>
									{bus_skills.modal.btn_apply}
								</Button>
							</ModalFooter>
						</>
					)}
				</ModalContent>
			</Modal>
		</>
	);
};

export default SetBusSkills;
