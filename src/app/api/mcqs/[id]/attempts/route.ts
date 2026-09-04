import { NextResponse } from "next/server";
import { attemptBodySchema } from "@/lib/mcq-schemas";
import { readJson } from "@/lib/read-json";
import {
	ChoiceNotInMcqError,
	McqNotFoundError,
	recordAttempt,
} from "@/lib/services/mcq-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
	const { id } = await context.params;

	const parsed = attemptBodySchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Validation failed" },
			{ status: 400 },
		);
	}

	try {
		// Only the question id from the route and the chosen id from the body are passed on.
		// Any correctness or user claim in the payload is dropped by the schema.
		const { attempt, correctChoiceId } = await recordAttempt({
			mcqId: id,
			choiceId: parsed.data.choiceId,
		});

		return NextResponse.json({ attempt, correctChoiceId }, { status: 201 });
	} catch (error) {
		if (error instanceof McqNotFoundError || error instanceof ChoiceNotInMcqError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}

		console.error(`POST /api/mcqs/${id}/attempts failed`, error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
