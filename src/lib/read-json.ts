/**
 * Parses a request body without throwing on malformed JSON. Returning `null` lets the
 * caller treat a broken body as a validation failure (400) instead of a crash (500).
 */
export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}
