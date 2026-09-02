import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb(): Promise<D1Database> {
	const { env } = await getCloudflareContext({ async: true });
	if (!env.DB) {
		throw new Error(
			"D1 binding DB is not available. Restart `npm run dev` after changing wrangler.jsonc, and apply migrations with `npx wrangler d1 migrations apply quizmaker --local`.",
		);
	}
	return env.DB;
}
