import { notFound } from "next/navigation";
import { McqForm } from "@/components/mcq-form";
import { getMcqWithChoices } from "@/lib/services/mcq-service";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const mcq = await getMcqWithChoices(id);

	if (!mcq) {
		notFound();
	}

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="flex w-full max-w-2xl flex-col gap-6">
				<div className="flex flex-col gap-1">
					<h1 className="font-heading text-xl font-medium">Edit question</h1>
					<p className="text-sm text-muted-foreground">
						Saving replaces this question&apos;s choices and clears its recorded attempts.
					</p>
				</div>
				<McqForm
					mcqId={mcq.id}
					initialMcq={{
						name: mcq.name,
						description: mcq.description,
						questionText: mcq.questionText,
						choices: mcq.choices.map((choice) => ({
							choiceText: choice.choiceText,
							isCorrect: choice.isCorrect,
						})),
					}}
				/>
			</div>
		</div>
	);
}
