import { notFound } from "next/navigation";
import { McqPreview } from "@/components/mcq-preview";
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
			<div className="w-full max-w-2xl">
				<McqPreview
					mcqId={mcq.id}
					name={mcq.name}
					questionText={mcq.questionText}
					// isCorrect is dropped here on purpose: the answer key must not reach the
					// browser. Grading happens through the attempts endpoint.
					choices={mcq.choices.map((choice) => ({
						id: choice.id,
						choiceText: choice.choiceText,
					}))}
				/>
			</div>
		</div>
	);
}
