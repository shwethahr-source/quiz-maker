"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * The choices deliberately carry no correctness flag. The page strips it before rendering,
 * so the answer key is never part of the payload sent to the browser — grading is a server
 * round-trip through the attempts endpoint.
 */
export type PreviewChoice = {
	id: string;
	choiceText: string;
};

type McqPreviewProps = {
	mcqId: string;
	name: string;
	questionText: string;
	choices: PreviewChoice[];
};

type Verdict = {
	isCorrect: boolean;
	correctChoiceId: string;
};

export function McqPreview({ mcqId, name, questionText, choices }: McqPreviewProps) {
	const router = useRouter();
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
	const [verdict, setVerdict] = useState<Verdict | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit() {
		if (!selectedChoiceId) {
			return;
		}

		setError(null);
		setSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: selectedChoiceId }),
			});

			const body = (await response.json().catch(() => null)) as
				| { attempt?: { isCorrect: boolean }; correctChoiceId?: string; error?: string }
				| null;

			if (!response.ok || !body?.attempt || !body.correctChoiceId) {
				setError(body?.error ?? "Unable to record this attempt");
				return;
			}

			setVerdict({
				isCorrect: body.attempt.isCorrect,
				correctChoiceId: body.correctChoiceId,
			});
		} catch {
			setError("Unable to record this attempt");
		} finally {
			setSubmitting(false);
		}
	}

	const correctChoiceText = verdict
		? choices.find((choice) => choice.id === verdict.correctChoiceId)?.choiceText
		: undefined;

	return (
		<FieldGroup>
			<div className="flex flex-col gap-1">
				<h1 className="font-heading text-lg font-medium">{name}</h1>
				<p className="text-muted-foreground">{questionText}</p>
			</div>

			{error ? <FieldError>{error}</FieldError> : null}

			<Field>
				<FieldLabel>Choose an answer</FieldLabel>
				<RadioGroup
					value={selectedChoiceId ?? ""}
					onValueChange={(value) => setSelectedChoiceId(String(value))}
				>
					{choices.map((choice) => (
						<FieldLabel key={choice.id} className="items-center gap-2">
							{/* The label text names the radio; an aria-label here would duplicate it. */}
							<RadioGroupItem value={choice.id} />
							{choice.choiceText}
						</FieldLabel>
					))}
				</RadioGroup>
			</Field>

			{verdict ? (
				<div role="status" className="text-sm font-medium">
					{verdict.isCorrect
						? "That's correct."
						: `Incorrect. The correct answer is ${correctChoiceText}.`}
				</div>
			) : null}

			<div className="flex gap-2">
				<Button onClick={onSubmit} disabled={!selectedChoiceId || submitting || verdict !== null}>
					Submit answer
				</Button>
				<Button variant="outline" onClick={() => router.push("/mcqs")}>
					Back to questions
				</Button>
			</div>
		</FieldGroup>
	);
}
