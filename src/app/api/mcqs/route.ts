import { NextResponse } from "next/server";
import { saveMcqBodySchema } from "@/lib/mcq-schemas";
import { readJson } from "@/lib/read-json";
import { InvalidChoiceSetError, createMcq, listMcqs } from "@/lib/services/mcq-service";

export async function GET() {
	try {
		const mcqs = await listMcqs();
		return NextResponse.json({ mcqs });
	} catch (error) {
		console.error("GET /api/mcqs failed", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const parsed = saveMcqBodySchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Validation failed" },
			{ status: 400 },
		);
	}

	try {
		const mcq = await createMcq(parsed.data);
		return NextResponse.json({ mcq }, { status: 201 });
	} catch (error) {
		if (error instanceof InvalidChoiceSetError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		console.error("POST /api/mcqs failed", error);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
