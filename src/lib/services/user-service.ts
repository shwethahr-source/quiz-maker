import { getDb } from "@/lib/db";

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type StoredUser = PublicUser & {
	passwordHash: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	passwordHash?: string;
};

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

export class UserAlreadyTakenError extends Error {
	readonly code = "USER_ALREADY_TAKEN";

	constructor(message = "Username or email already taken") {
		super(message);
		this.name = "UserAlreadyTakenError";
	}
}

export class UserNotFoundError extends Error {
	readonly code = "USER_NOT_FOUND";

	constructor(message = "User not found") {
		super(message);
		this.name = "UserNotFoundError";
	}
}

export function toPublicUser(user: StoredUser): PublicUser {
	return {
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
		email: user.email,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}

function toStoredUser(row: UserRow): StoredUser {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function isUniqueConstraintError(error: unknown): boolean {
	return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

const USER_COLUMNS =
	"id, first_name, last_name, username, email, password_hash, created_at, updated_at";

async function findRowBy(column: "id" | "username" | "email", value: string): Promise<UserRow | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE ${column} = ?1`)
		.bind(value)
		.all<UserRow>();

	return results[0] ?? null;
}

async function getStoredUserById(id: string): Promise<StoredUser | null> {
	const row = await findRowBy("id", id);
	return row ? toStoredUser(row) : null;
}

export async function getStoredUserByUsername(username: string): Promise<StoredUser | null> {
	const row = await findRowBy("username", username);
	return row ? toStoredUser(row) : null;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const db = await getDb();

	try {
		await db
			.prepare(
				`INSERT INTO users (id, first_name, last_name, username, email, password_hash, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
			)
			.bind(
				id,
				input.firstName,
				input.lastName,
				input.username,
				input.email,
				input.passwordHash,
				now,
				now,
			)
			.run();
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new UserAlreadyTakenError();
		}
		throw error;
	}

	return toPublicUser({
		id,
		firstName: input.firstName,
		lastName: input.lastName,
		username: input.username,
		email: input.email,
		passwordHash: input.passwordHash,
		createdAt: now,
		updatedAt: now,
	});
}

export async function getUserById(id: string): Promise<PublicUser | null> {
	const stored = await getStoredUserById(id);
	return stored ? toPublicUser(stored) : null;
}

export async function getUserByUsername(username: string): Promise<PublicUser | null> {
	const stored = await getStoredUserByUsername(username);
	return stored ? toPublicUser(stored) : null;
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
	const row = await findRowBy("email", email);
	return row ? toPublicUser(toStoredUser(row)) : null;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<PublicUser> {
	const existing = await getStoredUserById(id);
	if (!existing) {
		throw new UserNotFoundError();
	}

	const next: StoredUser = {
		...existing,
		firstName: patch.firstName ?? existing.firstName,
		lastName: patch.lastName ?? existing.lastName,
		username: patch.username ?? existing.username,
		email: patch.email ?? existing.email,
		passwordHash: patch.passwordHash ?? existing.passwordHash,
		updatedAt: new Date().toISOString(),
	};

	const db = await getDb();
	try {
		await db
			.prepare(
				`UPDATE users SET first_name = ?1, last_name = ?2, username = ?3, email = ?4, password_hash = ?5, updated_at = ?6 WHERE id = ?7`,
			)
			.bind(
				next.firstName,
				next.lastName,
				next.username,
				next.email,
				next.passwordHash,
				next.updatedAt,
				id,
			)
			.run();
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new UserAlreadyTakenError();
		}
		throw error;
	}

	return toPublicUser(next);
}

export async function deleteUser(id: string): Promise<void> {
	const db = await getDb();
	await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
}
