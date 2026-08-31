import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { getStoredUserByUsername } from "@/lib/services/user-service";
import { POST } from "./route";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const INVALID_AUTH = "Invalid username or password";

const { getStoredUserByUsernameMock } = vi.hoisted(() => ({
	getStoredUserByUsernameMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/services/user-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user-service")>();
	return {
		...actual,
		getStoredUserByUsername: getStoredUserByUsernameMock,
	};
});

const storedUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	passwordHash: HASH,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function loginRequest(body: unknown) {
	return new Request("http://localhost/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getStoredUserByUsernameMock.mockResolvedValue(storedUser);
	});

	it("returns the public user when username and hash match", async () => {
		const response = await POST(
			loginRequest({
				username: "ada@school.edu",
				passwordHash: HASH,
			}),
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.user).toEqual({
			id: storedUser.id,
			firstName: storedUser.firstName,
			lastName: storedUser.lastName,
			username: storedUser.username,
			email: storedUser.email,
			createdAt: storedUser.createdAt,
			updatedAt: storedUser.updatedAt,
		});
		expect(json.user).not.toHaveProperty("passwordHash");
		expect(json.user).not.toHaveProperty("password_hash");
		expect(JSON.stringify(json)).not.toContain(HASH);
		expect(getStoredUserByUsername).toHaveBeenCalledWith("ada@school.edu");
		expect(getDb).not.toHaveBeenCalled();
	});

	it("returns the same 401 message for an unknown user and a wrong password", async () => {
		getStoredUserByUsernameMock.mockResolvedValueOnce(null);
		const unknownUser = await POST(
			loginRequest({
				username: "missing",
				passwordHash: HASH,
			}),
		);
		const unknownJson = await unknownUser.json();

		getStoredUserByUsernameMock.mockResolvedValueOnce({
			...storedUser,
			passwordHash: OTHER_HASH,
		});
		const wrongPassword = await POST(
			loginRequest({
				username: "ada@school.edu",
				passwordHash: HASH,
			}),
		);
		const wrongJson = await wrongPassword.json();

		expect(unknownUser.status).toBe(401);
		expect(wrongPassword.status).toBe(401);
		expect(unknownJson.error).toBe(INVALID_AUTH);
		expect(wrongJson.error).toBe(INVALID_AUTH);
		expect(unknownJson).toEqual(wrongJson);
		expect(getDb).not.toHaveBeenCalled();
	});

	it("rejects missing or invalid fields with 400 and does not look up a user", async () => {
		const invalidBodies = [
			{},
			{ username: "ada@school.edu" },
			{ username: "ada@school.edu", passwordHash: "too-short" },
			{ passwordHash: HASH },
		];

		for (const body of invalidBodies) {
			getStoredUserByUsernameMock.mockClear();
			const response = await POST(loginRequest(body));
			expect(response.status, `expected 400 for ${JSON.stringify(body)}`).toBe(400);
			expect(getStoredUserByUsername).not.toHaveBeenCalled();
		}
	});
});
