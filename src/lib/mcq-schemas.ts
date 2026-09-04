import { z } from "zod";
import { MAX_CHOICES, MIN_CHOICES } from "@/lib/services/mcq-service";

export const choiceInputSchema = z.object({
	choiceText: z.string().trim().min(1, "Choice text is required").max(300),
	isCorrect: z.boolean(),
});

/**
 * SQLite cannot express "between 2 and 6 rows, exactly one of them correct", so the rule
 * lives here and is re-checked in the service for callers that bypass HTTP.
 */
export const choiceSetSchema = z
	.array(choiceInputSchema)
	.min(MIN_CHOICES, `A question needs at least ${MIN_CHOICES} choices`)
	.max(MAX_CHOICES, `A question can have at most ${MAX_CHOICES} choices`)
	.refine(
		(choices) => choices.filter((choice) => choice.isCorrect).length === 1,
		"Exactly one choice must be marked correct",
	);

export const saveMcqBodySchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	// Absent, null, or whitespace-only all collapse to null so the column has one empty value.
	description: z
		.string()
		.trim()
		.max(500)
		.nullish()
		.transform((value) => (value && value.length > 0 ? value : null)),
	questionText: z.string().trim().min(1, "Question text is required").max(1000),
	choices: choiceSetSchema,
});

/**
 * Only the chosen id is accepted. Correctness is derived server-side, and there is no
 * session, so a client-supplied user id would be unverifiable and is deliberately dropped.
 */
export const attemptBodySchema = z.object({
	choiceId: z.string().trim().min(1, "choiceId is required"),
});

export type SaveMcqBody = z.infer<typeof saveMcqBodySchema>;
export type AttemptBody = z.infer<typeof attemptBodySchema>;
