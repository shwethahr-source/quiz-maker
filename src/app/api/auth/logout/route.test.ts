import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
	it("returns ok without requiring a body", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", { method: "POST" }),
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({ ok: true });
	});
});
