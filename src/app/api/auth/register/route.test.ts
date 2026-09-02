import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { UserAlreadyTakenError, createUser } from "@/lib/services/user-service";
import { POST } from "./route";

const HASH = "a".repeat(64);

const { createUserMock } = vi.hoisted(() => ({
	createUserMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(),
}));

vi.mock("@/lib/services/user-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user-service")>();
	return {
		...actual,
		createUser: createUserMock,
	};
});

const publicUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function registerRequest(body: unknown) {
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createUserMock.mockResolvedValue(publicUser);
	});

	it("creates a public user and does not return a password hash", async () => {
		const response = await POST(
			registerRequest({
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada@school.edu",
				email: "ada@school.edu",
				passwordHash: HASH,
			}),
		);
		const json = await response.json();

		expect(response.status).toBe(201);
		expect(json.user).toEqual(publicUser);
		expect(json.user).not.toHaveProperty("passwordHash");
		expect(json.user).not.toHaveProperty("password_hash");
		expect(JSON.stringify(json)).not.toContain(HASH);
		expect(createUser).toHaveBeenCalledWith({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada@school.edu",
			email: "ada@school.edu",
			passwordHash: HASH,
		});
		expect(getDb).not.toHaveBeenCalled();
	});

	it("accepts a registration where username and email are the same", async () => {
		const response = await POST(
			registerRequest({
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada@school.edu",
				email: "ada@school.edu",
				passwordHash: HASH,
			}),
		);

		expect(response.status).toBe(201);
		expect(createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				username: "ada@school.edu",
				email: "ada@school.edu",
			}),
		);
	});

	it("rejects missing or invalid fields with 400 and does not create a user", async () => {
		const invalidBodies = [
			{},
			{
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "not-an-email",
				passwordHash: HASH,
			},
			{
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "ada@school.edu",
				passwordHash: "too-short",
			},
			{
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada",
				email: "ada@school.edu",
			},
		];

		for (const body of invalidBodies) {
			createUserMock.mockClear();
			const response = await POST(registerRequest(body));
			expect(response.status, `expected 400 for ${JSON.stringify(body)}`).toBe(400);
			expect(createUser).not.toHaveBeenCalled();
		}
	});

	it("maps an already-taken user to 400", async () => {
		createUserMock.mockRejectedValueOnce(new UserAlreadyTakenError());

		const response = await POST(
			registerRequest({
				firstName: "Ada",
				lastName: "Lovelace",
				username: "ada@school.edu",
				email: "ada@school.edu",
				passwordHash: HASH,
			}),
		);
		const json = await response.json();

		expect(response.status).toBe(400);
		expect(json.error).toMatch(/already taken/i);
		expect(getDb).not.toHaveBeenCalled();
	});
});
