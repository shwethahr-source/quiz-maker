import { NextResponse } from "next/server";
import { loginBodySchema } from "@/lib/auth-schemas";
import { hashesMatch } from "@/lib/hashes-match";
import { getStoredUserByUsername, toPublicUser } from "@/lib/services/user-service";

const INVALID_AUTH = "Invalid username or password";

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export async function POST(request: Request) {
	const parsed = loginBodySchema.safeParse(await readJson(request));
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const stored = await getStoredUserByUsername(parsed.data.username);
		if (!stored || !hashesMatch(stored.passwordHash, parsed.data.passwordHash)) {
			return NextResponse.json({ error: INVALID_AUTH }, { status: 401 });
		}

		return NextResponse.json({ user: toPublicUser(stored) }, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
