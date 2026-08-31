export async function hashPassword(password: string): Promise<string> {
	const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
