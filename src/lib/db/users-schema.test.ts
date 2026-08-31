import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_COLUMNS = [
	"id",
	"first_name",
	"last_name",
	"username",
	"email",
	"password_hash",
	"created_at",
	"updated_at",
] as const;

function loadUsersMigrationSql(): string {
	const migrationsDir = join(process.cwd(), "migrations");
	if (!existsSync(migrationsDir)) {
		throw new Error("migrations/ directory does not exist");
	}

	const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
	const usersFile = files.find((file) => /users/i.test(file));
	if (!usersFile) {
		throw new Error("No users migration found in migrations/");
	}

	return readFileSync(join(migrationsDir, usersFile), "utf8");
}

function extractCreateUsersBody(sql: string): string {
	const startMatch = sql.match(/CREATE TABLE\s+users\s*\(/i);
	if (!startMatch || startMatch.index === undefined) {
		throw new Error("CREATE TABLE users statement not found");
	}

	const openParenIndex = startMatch.index + startMatch[0].length - 1;
	let depth = 0;
	for (let i = openParenIndex; i < sql.length; i += 1) {
		const char = sql[i];
		if (char === "(") {
			depth += 1;
		} else if (char === ")") {
			depth -= 1;
			if (depth === 0) {
				return sql.slice(openParenIndex + 1, i);
			}
		}
	}

	throw new Error("CREATE TABLE users body is not closed");
}

function columnDefinitions(tableBody: string): string[] {
	const definitions: string[] = [];
	let current = "";
	let depth = 0;

	for (const char of tableBody) {
		if (char === "(") {
			depth += 1;
		} else if (char === ")") {
			depth -= 1;
		}

		if (char === "," && depth === 0) {
			if (current.trim()) {
				definitions.push(current.trim());
			}
			current = "";
			continue;
		}

		current += char;
	}

	if (current.trim()) {
		definitions.push(current.trim());
	}

	return definitions;
}

function namedColumns(definitions: string[]): string[] {
	return definitions
		.filter((definition) => !/^(PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(definition))
		.map((definition) => {
			const name = definition.match(/^"?([A-Za-z_][A-Za-z0-9_]*)"?/)?.[1];
			if (!name) {
				throw new Error(`Could not parse column name from: ${definition}`);
			}
			return name.toLowerCase();
		});
}

describe("users table migration", () => {
	it("creates a users table with the required identity columns", () => {
		const sql = loadUsersMigrationSql();
		const columns = namedColumns(columnDefinitions(extractCreateUsersBody(sql)));

		expect(sql).toMatch(/CREATE TABLE\s+users\b/i);
		for (const column of REQUIRED_COLUMNS) {
			expect(columns, `missing column ${column}`).toContain(column);
		}
	});

	it("does not store a plaintext password column", () => {
		const columns = namedColumns(
			columnDefinitions(extractCreateUsersBody(loadUsersMigrationSql())),
		);

		expect(columns).not.toContain("password");
		expect(columns).toContain("password_hash");
	});

	it("makes username and email unique", () => {
		const sql = loadUsersMigrationSql();
		const body = extractCreateUsersBody(sql);
		const definitions = columnDefinitions(body);
		const username = definitions.find((definition) => /^username\b/i.test(definition));
		const email = definitions.find((definition) => /^email\b/i.test(definition));
		const tableUniques = definitions.filter((definition) => /^UNIQUE\b/i.test(definition));

		const usernameUnique =
			/\bUNIQUE\b/i.test(username ?? "") ||
			tableUniques.some((definition) => /\(\s*username\s*\)/i.test(definition));
		const emailUnique =
			/\bUNIQUE\b/i.test(email ?? "") ||
			tableUniques.some((definition) => /\(\s*email\s*\)/i.test(definition));

		expect(usernameUnique, "username must be UNIQUE").toBe(true);
		expect(emailUnique, "email must be UNIQUE").toBe(true);
	});

	it("uses id as the primary key", () => {
		const sql = loadUsersMigrationSql();
		const body = extractCreateUsersBody(sql);
		const definitions = columnDefinitions(body);
		const idDefinition = definitions.find((definition) => /^id\b/i.test(definition));
		const tablePrimaryKey = definitions.find((definition) => /^PRIMARY KEY\b/i.test(definition));

		const idIsPrimaryKey =
			/\bPRIMARY KEY\b/i.test(idDefinition ?? "") ||
			/\(\s*id\s*\)/i.test(tablePrimaryKey ?? "");

		expect(idIsPrimaryKey, "id must be the primary key").toBe(true);
	});
});
