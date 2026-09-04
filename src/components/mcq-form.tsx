"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { MAX_CHOICES, MIN_CHOICES } from "@/lib/services/mcq-service";

export type McqFormValues = {
	name: string;
	description: string | null;
	questionText: string;
	choices: { choiceText: string; isCorrect: boolean }[];
};

type McqFormProps = {
	/** Present when editing; absent when creating. */
	mcqId?: string;
	initialMcq?: McqFormValues;
};

function initialChoiceTexts(initialMcq?: McqFormValues): string[] {
	if (initialMcq && initialMcq.choices.length > 0) {
		return initialMcq.choices.map((choice) => choice.choiceText);
	}
	return Array.from({ length: MIN_CHOICES }, () => "");
}

function initialCorrectIndex(initialMcq?: McqFormValues): number {
	const found = initialMcq?.choices.findIndex((choice) => choice.isCorrect) ?? -1;
	return found >= 0 ? found : 0;
}

export function McqForm({ mcqId, initialMcq }: McqFormProps) {
	const router = useRouter();
	const [name, setName] = useState(initialMcq?.name ?? "");
	const [description, setDescription] = useState(initialMcq?.description ?? "");
	const [questionText, setQuestionText] = useState(initialMcq?.questionText ?? "");
	const [choiceTexts, setChoiceTexts] = useState(() => initialChoiceTexts(initialMcq));
	// A single index is the state, which is what makes "exactly one correct" impossible to
	// violate from the UI.
	const [correctIndex, setCorrectIndex] = useState(() => initialCorrectIndex(initialMcq));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	function updateChoice(index: number, value: string) {
		setChoiceTexts((current) => current.map((text, at) => (at === index ? value : text)));
	}

	function addChoice() {
		setChoiceTexts((current) =>
			current.length < MAX_CHOICES ? [...current, ""] : current,
		);
	}

	function removeChoice(index: number) {
		setChoiceTexts((current) => {
			if (current.length <= MIN_CHOICES) {
				return current;
			}
			return current.filter((_, at) => at !== index);
		});

		// Keep the correct answer pointing at the same choice after the list shifts.
		setCorrectIndex((current) => {
			if (index === current) {
				return 0;
			}
			return index < current ? current - 1 : current;
		});
	}

	async function onSave() {
		setError(null);
		setSaving(true);

		try {
			const response = await fetch(mcqId ? `/api/mcqs/${mcqId}` : "/api/mcqs", {
				method: mcqId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					description,
					questionText,
					choices: choiceTexts.map((choiceText, index) => ({
						choiceText,
						isCorrect: index === correctIndex,
					})),
				}),
			});

			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				setError(body?.error ?? "Unable to save this question");
				return;
			}

			// Push then refresh so the bank re-reads D1 instead of showing a cached empty list.
			router.push("/mcqs");
			router.refresh();
		} catch {
			setError("Unable to save this question");
		} finally {
			setSaving(false);
		}
	}

	return (
		<FieldGroup>
			{error ? <FieldError>{error}</FieldError> : null}

			<Field>
				<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
				<Input
					id="mcq-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Photosynthesis basics"
				/>
				<FieldDescription>A short title, shown in the question bank.</FieldDescription>
			</Field>

			<Field>
				<FieldLabel htmlFor="mcq-description">Description</FieldLabel>
				<Textarea
					id="mcq-description"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder="Optional notes for you, not the student"
				/>
			</Field>

			<Field>
				<FieldLabel htmlFor="mcq-question-text">Question text</FieldLabel>
				<Textarea
					id="mcq-question-text"
					value={questionText}
					onChange={(event) => setQuestionText(event.target.value)}
					placeholder="Which gas do plants absorb during photosynthesis?"
				/>
				<FieldDescription>This is what the student reads.</FieldDescription>
			</Field>

			<Field>
				<FieldLabel>Choices</FieldLabel>
				<FieldDescription>
					Between {MIN_CHOICES} and {MAX_CHOICES} choices. Select the one correct answer.
				</FieldDescription>
				<RadioGroup
					value={String(correctIndex)}
					onValueChange={(value) => setCorrectIndex(Number(value))}
				>
					{choiceTexts.map((choiceText, index) => (
						<div key={index} className="flex items-center gap-2">
							<RadioGroupItem
								value={String(index)}
								aria-label={`Choice ${index + 1} is correct`}
							/>
							<Input
								aria-label={`Choice ${index + 1}`}
								value={choiceText}
								onChange={(event) => updateChoice(index, event.target.value)}
								placeholder={`Choice ${index + 1}`}
							/>
							{choiceTexts.length > MIN_CHOICES ? (
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Remove choice ${index + 1}`}
									onClick={() => removeChoice(index)}
								>
									<XIcon />
								</Button>
							) : null}
						</div>
					))}
				</RadioGroup>
				<Button
					variant="outline"
					onClick={addChoice}
					disabled={choiceTexts.length >= MAX_CHOICES}
					className="w-fit"
				>
					<PlusIcon />
					Add choice
				</Button>
			</Field>

			<div className="flex gap-2">
				<Button onClick={onSave} disabled={saving}>
					Save
				</Button>
				<Button variant="outline" onClick={() => router.push("/mcqs")} disabled={saving}>
					Cancel
				</Button>
			</div>
		</FieldGroup>
	);
}
