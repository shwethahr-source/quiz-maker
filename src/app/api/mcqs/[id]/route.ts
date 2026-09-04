import { NextResponse } from "next/server";
import { saveMcqBodySchema } from "@/lib/mcq-schemas";
import { readJson } from "@/lib/read-json";
import {
	InvalidChoiceSetError,
	McqNotFoundError,
	deleteMcq,
	getMcqWithChoices,
	updateMcq,
} from "@/lib/services/mcq-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		const mcq = await getMcqWithChoices(id);
		if (!mcq) {
			return NextResponse.json({ error: "Question not found" }, { status: 404 });
		}

		return NextResponse.json({ mcq });
	} catch (error) {
		console.error(`GET /api/mcqs/${id} failed`, error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

export async function PUT(request: Request, context: RouteContext) {
	const { id } = await context.params;

	const parsed = saveMcqBodySchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Validation failed" },
			{ status: 400 },
		);
	}

	try {
		const mcq = await updateMcq(id, parsed.data);
		return NextResponse.json({ mcq });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}
		if (error instanceof InvalidChoiceSetError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		console.error(`PUT /api/mcqs/${id} failed`, error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		await deleteMcq(id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}

		console.error(`DELETE /api/mcqs/${id} failed`, error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
