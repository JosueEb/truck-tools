import type { ReactNode } from "react";

interface RouteStepProps {
	number: number;
	icon: ReactNode;
	title: string;
	children: ReactNode;
}

const RouteStep = ({ number, icon, title, children }: RouteStepProps) => (
	<section className="flex gap-3">
		<div className="bg-primary/15 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">
			{number}
		</div>
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<h3 className="flex h-7 items-center gap-2 font-semibold">
				{icon}
				{title}
			</h3>
			{children}
		</div>
	</section>
);

export default RouteStep;
