import { NextResponse } from "next/server";
import { registerBodySchema } from "@/lib/auth-schemas";
import { UserAlreadyTakenError, createUser } from "@/lib/services/user-service";

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export async function POST(request: Request) {
	const parsed = registerBodySchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const user = await createUser(parsed.data);
		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		if (error instanceof UserAlreadyTakenError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
