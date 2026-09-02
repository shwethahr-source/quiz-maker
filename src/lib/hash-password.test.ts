import { describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/hash-password";

describe("hashPassword", () => {
	it("returns the same 64-character lowercase hex digest for the same input", async () => {
		const first = await hashPassword("teacher-password");
		const second = await hashPassword("teacher-password");

		expect(first).toBe(second);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
	});

	it("returns different hashes for different passwords", async () => {
		const left = await hashPassword("teacher-password");
		const right = await hashPassword("other-password");

		expect(left).not.toBe(right);
	});

	it("does not return the original password", async () => {
		const password = "teacher-password";
		const digest = await hashPassword(password);

		expect(digest).not.toBe(password);
		expect(digest.toLowerCase()).not.toBe(password.toLowerCase());
	});
});
