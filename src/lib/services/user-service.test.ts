import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import {
	UserAlreadyTakenError,
	createUser,
	deleteUser,
	getUserByEmail,
	getUserById,
	getUserByUsername,
	toPublicUser,
	updateUser,
} from "@/lib/services/user-service";

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

const { getMemoryDb, resetMemoryDb } = vi.hoisted(() => {
	function createMemoryD1() {
		const rows: UserRow[] = [];

		function throwIfTaken(username: string, email: string, exceptId?: string) {
			const taken = rows.some(
				(row) =>
					row.id !== exceptId && (row.username === username || row.email === email),
			);
			if (taken) {
				throw new Error("UNIQUE constraint failed: users.username");
			}
		}

		function bindStatement(sql: string, params: unknown[]) {
			const normalized = sql.replace(/\s+/g, " ").trim();

			return {
				async run() {
					if (/^INSERT INTO users/i.test(normalized)) {
						const columns =
							normalized
								.match(/INSERT INTO users \(([^)]+)\)/i)?.[1]
								.split(",")
								.map((column) => column.trim()) ?? [];
						const record: Record<string, unknown> = {};
						columns.forEach((column, index) => {
							record[column] = params[index];
						});

						throwIfTaken(String(record.username), String(record.email));

						const now = new Date().toISOString();
						rows.push({
							id: String(record.id ?? crypto.randomUUID()),
							first_name: String(record.first_name),
							last_name: String(record.last_name),
							username: String(record.username),
							email: String(record.email),
							password_hash: String(record.password_hash),
							created_at: String(record.created_at ?? now),
							updated_at: String(record.updated_at ?? now),
						});
						return { success: true };
					}

					if (/^UPDATE users/i.test(normalized)) {
						const setClause = normalized.match(/SET (.+) WHERE/i)?.[1] ?? "";
						const updates: Record<string, unknown> = {};
						for (const assignment of setClause.split(",")) {
							const match = assignment.trim().match(/^(\w+)\s*=\s*\?(\d+)$/);
							if (match) {
								updates[match[1]] = params[Number(match[2]) - 1];
							}
						}

						const where = normalized.match(/WHERE (\w+) = \?(\d+)/i);
						if (!where) {
							throw new Error(`Unsupported UPDATE: ${sql}`);
						}
						const whereValue = params[Number(where[2]) - 1];
						const row = rows.find(
							(candidate) => candidate[where[1] as keyof UserRow] === whereValue,
						);
						if (!row) {
							return { success: true };
						}

						throwIfTaken(
							String(updates.username ?? row.username),
							String(updates.email ?? row.email),
							row.id,
						);
						Object.assign(row, updates);
						return { success: true };
					}

					if (/^DELETE FROM users/i.test(normalized)) {
						const where = normalized.match(/WHERE (\w+) = \?(\d+)/i);
						if (!where) {
							throw new Error(`Unsupported DELETE: ${sql}`);
						}
						const whereValue = params[Number(where[2]) - 1];
						const index = rows.findIndex(
							(candidate) => candidate[where[1] as keyof UserRow] === whereValue,
						);
						if (index >= 0) {
							rows.splice(index, 1);
						}
						return { success: true };
					}

					throw new Error(`Unsupported SQL: ${sql}`);
				},
				async all() {
					if (!/SELECT /i.test(normalized)) {
						return { results: [] };
					}

					const where = normalized.match(/WHERE (\w+) = \?(\d+)/i);
					if (!where) {
						return { results: [...rows] };
					}

					const whereValue = params[Number(where[2]) - 1];
					return {
						results: rows.filter(
							(candidate) => candidate[where[1] as keyof UserRow] === whereValue,
						),
					};
				},
			};
		}

		return {
			rows,
			prepare(sql: string) {
				return {
					bind(...params: unknown[]) {
						return bindStatement(sql, params);
					},
				};
			},
		};
	}

	let db = createMemoryD1();

	return {
		getMemoryDb: () => db,
		resetMemoryDb: () => {
			db = createMemoryD1();
		},
	};
});

vi.mock("@/lib/db", () => ({
	getDb: vi.fn(async () => getMemoryDb()),
}));

const ada = {
	firstName: "Ada",
	lastName: "Lovelace",
	username: "ada@school.edu",
	email: "ada@school.edu",
	passwordHash: "a".repeat(64),
};

function expectPublicUser(user: object) {
	expect(user).not.toHaveProperty("passwordHash");
	expect(user).not.toHaveProperty("password_hash");
}

describe("user service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetMemoryDb();
		vi.mocked(getDb).mockImplementation(async () => getMemoryDb() as never);
	});

	it("createUser stores a password hash and returns a public user without the hash", async () => {
		const created = await createUser({ ...ada, passwordHash: ada.passwordHash });

		expect(created.firstName).toBe("Ada");
		expect(created.lastName).toBe("Lovelace");
		expect(created.username).toBe(ada.username);
		expect(created.email).toBe(ada.email);
		expect(created.id).toBeTruthy();
		expectPublicUser(created);

		const stored = getMemoryDb().rows[0];
		expect(stored.password_hash).toBe(ada.passwordHash);
		expect(stored.password_hash).not.toBe("plaintext-password");
		expect(getMemoryDb().rows).toHaveLength(1);
	});

	it("createUser allows username and email to be the same value", async () => {
		const created = await createUser(ada);

		expect(created.username).toBe(created.email);
		expect(getMemoryDb().rows[0]?.username).toBe(getMemoryDb().rows[0]?.email);
	});

	it("createUser rejects a duplicate username or email as already taken", async () => {
		await createUser(ada);

		await expect(
			createUser({
				...ada,
				firstName: "Other",
				username: "other-teacher",
			}),
		).rejects.toMatchObject({
			name: "UserAlreadyTakenError",
			message: expect.stringMatching(/already taken/i),
		});

		await expect(createUser(ada)).rejects.toBeInstanceOf(UserAlreadyTakenError);
		expect(getMemoryDb().rows).toHaveLength(1);
	});

	it("looks up users by id, username, and email, and returns null when missing", async () => {
		const created = await createUser(ada);

		const byId = await getUserById(created.id);
		const byUsername = await getUserByUsername(ada.username);
		const byEmail = await getUserByEmail(ada.email);

		expect(byId).toEqual(created);
		expect(byUsername).toEqual(created);
		expect(byEmail).toEqual(created);
		expectPublicUser(byId!);
		expectPublicUser(byUsername!);
		expectPublicUser(byEmail!);

		expect(await getUserById("missing")).toBeNull();
		expect(await getUserByUsername("missing")).toBeNull();
		expect(await getUserByEmail("missing@school.edu")).toBeNull();
	});

	it("updateUser changes provided fields and refreshes updated_at", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		const created = await createUser(ada);

		vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
		const updated = await updateUser(created.id, { lastName: "Byron" });
		vi.useRealTimers();

		expect(updated.lastName).toBe("Byron");
		expect(updated.firstName).toBe("Ada");
		expect(updated.updatedAt).not.toBe(created.updatedAt);
		expect(updated.updatedAt).toBe("2026-01-02T00:00:00.000Z");
		expectPublicUser(updated);
	});

	it("deleteUser removes the user so later lookups are not found", async () => {
		const created = await createUser(ada);

		await deleteUser(created.id);

		expect(await getUserById(created.id)).toBeNull();
		expect(await getUserByUsername(ada.username)).toBeNull();
		expect(getMemoryDb().rows).toHaveLength(0);
	});

	it("toPublicUser never includes the stored password hash", () => {
		const publicUser = toPublicUser({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada",
			email: "ada@school.edu",
			passwordHash: "secret-hash",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});

		expect(publicUser).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada",
			email: "ada@school.edu",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
		expectPublicUser(publicUser);
	});
});
