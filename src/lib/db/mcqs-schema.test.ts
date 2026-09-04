import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function loadMcqMigrationSql(): string {
	const migrationsDir = join(process.cwd(), "migrations");
	if (!existsSync(migrationsDir)) {
		throw new Error("migrations/ directory does not exist");
	}

	const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));
	const mcqFile = files.find((file) => /mcq/i.test(file));
	if (!mcqFile) {
		throw new Error("No MCQ migration found in migrations/");
	}

	return readFileSync(join(migrationsDir, mcqFile), "utf8");
}

function extractCreateTableBody(sql: string, table: string): string {
	const startMatch = sql.match(new RegExp(`CREATE TABLE\\s+${table}\\s*\\(`, "i"));
	if (!startMatch || startMatch.index === undefined) {
		throw new Error(`CREATE TABLE ${table} statement not found`);
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

	throw new Error(`CREATE TABLE ${table} body is not closed`);
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

function definitionFor(definitions: string[], column: string): string {
	const definition = definitions.find((candidate) =>
		new RegExp(`^"?${column}"?\\b`, "i").test(candidate),
	);
	if (!definition) {
		throw new Error(`Column ${column} is not declared`);
	}
	return definition;
}

/**
 * True when `column` is a foreign key to `table (id)`, declared either inline on the
 * column or as a table-level FOREIGN KEY clause.
 */
function referencesTable(definitions: string[], column: string, table: string): boolean {
	const inline = definitions.find((candidate) =>
		new RegExp(`^"?${column}"?\\b`, "i").test(candidate),
	);
	if (inline && new RegExp(`REFERENCES\\s+${table}\\s*\\(\\s*id\\s*\\)`, "i").test(inline)) {
		return true;
	}

	return definitions.some(
		(candidate) =>
			/^FOREIGN KEY\b/i.test(candidate) &&
			new RegExp(`\\(\\s*${column}\\s*\\)`, "i").test(candidate) &&
			new RegExp(`REFERENCES\\s+${table}\\s*\\(\\s*id\\s*\\)`, "i").test(candidate),
	);
}

function isPrimaryKey(definitions: string[], column: string): boolean {
	const inline = definitions.find((candidate) =>
		new RegExp(`^"?${column}"?\\b`, "i").test(candidate),
	);
	if (inline && /\bPRIMARY KEY\b/i.test(inline)) {
		return true;
	}

	return definitions.some(
		(candidate) =>
			/^PRIMARY KEY\b/i.test(candidate) &&
			new RegExp(`\\(\\s*${column}\\s*\\)`, "i").test(candidate),
	);
}

describe("mcqs table migration", () => {
	it("creates an mcqs table with the question columns", () => {
		const sql = loadMcqMigrationSql();
		const definitions = columnDefinitions(extractCreateTableBody(sql, "mcqs"));
		const columns = namedColumns(definitions);

		for (const column of ["id", "name", "description", "question_text", "created_at", "updated_at"]) {
			expect(columns, `mcqs is missing column ${column}`).toContain(column);
		}
		expect(isPrimaryKey(definitions, "id"), "mcqs.id must be the primary key").toBe(true);
	});

	it("requires a name and question text but leaves the description optional", () => {
		const definitions = columnDefinitions(extractCreateTableBody(loadMcqMigrationSql(), "mcqs"));

		expect(definitionFor(definitions, "name")).toMatch(/NOT NULL/i);
		expect(definitionFor(definitions, "question_text")).toMatch(/NOT NULL/i);
		expect(definitionFor(definitions, "description")).not.toMatch(/NOT NULL/i);
	});
});

describe("mcq_choices table migration", () => {
	it("creates an mcq_choices table with the choice columns", () => {
		const sql = loadMcqMigrationSql();
		const definitions = columnDefinitions(extractCreateTableBody(sql, "mcq_choices"));
		const columns = namedColumns(definitions);

		for (const column of ["id", "mcq_id", "choice_text", "is_correct", "position"]) {
			expect(columns, `mcq_choices is missing column ${column}`).toContain(column);
		}
		expect(isPrimaryKey(definitions, "id"), "mcq_choices.id must be the primary key").toBe(true);
	});

	it("links every choice to a question with a foreign key", () => {
		const definitions = columnDefinitions(
			extractCreateTableBody(loadMcqMigrationSql(), "mcq_choices"),
		);

		expect(
			referencesTable(definitions, "mcq_id", "mcqs"),
			"mcq_choices.mcq_id must reference mcqs (id)",
		).toBe(true);
		expect(definitionFor(definitions, "mcq_id")).toMatch(/NOT NULL/i);
	});

	it("requires choice text and a correctness flag that defaults to false", () => {
		const definitions = columnDefinitions(
			extractCreateTableBody(loadMcqMigrationSql(), "mcq_choices"),
		);

		expect(definitionFor(definitions, "choice_text")).toMatch(/NOT NULL/i);
		expect(definitionFor(definitions, "is_correct")).toMatch(/NOT NULL/i);
		expect(definitionFor(definitions, "is_correct")).toMatch(/DEFAULT\s+0/i);
	});
});

describe("mcq_attempts table migration", () => {
	it("creates an mcq_attempts table that records the selected choice and correctness", () => {
		const sql = loadMcqMigrationSql();
		const definitions = columnDefinitions(extractCreateTableBody(sql, "mcq_attempts"));
		const columns = namedColumns(definitions);

		for (const column of ["id", "mcq_id", "choice_id", "user_id", "is_correct", "created_at"]) {
			expect(columns, `mcq_attempts is missing column ${column}`).toContain(column);
		}
		expect(definitionFor(definitions, "is_correct")).toMatch(/NOT NULL/i);
	});

	it("links an attempt to both its question and the choice that was selected", () => {
		const definitions = columnDefinitions(
			extractCreateTableBody(loadMcqMigrationSql(), "mcq_attempts"),
		);

		expect(
			referencesTable(definitions, "mcq_id", "mcqs"),
			"mcq_attempts.mcq_id must reference mcqs (id)",
		).toBe(true);
		expect(
			referencesTable(definitions, "choice_id", "mcq_choices"),
			"mcq_attempts.choice_id must reference mcq_choices (id)",
		).toBe(true);
	});

	it("allows an attempt with no user, because this sprint has no session", () => {
		const definitions = columnDefinitions(
			extractCreateTableBody(loadMcqMigrationSql(), "mcq_attempts"),
		);

		expect(
			referencesTable(definitions, "user_id", "users"),
			"mcq_attempts.user_id must reference users (id)",
		).toBe(true);
		expect(definitionFor(definitions, "user_id")).not.toMatch(/NOT NULL/i);
	});
});

describe("mcq migration indexes", () => {
	it("indexes the foreign keys the service looks questions up by", () => {
		const sql = loadMcqMigrationSql();

		expect(sql).toMatch(/CREATE INDEX\s+\w+\s+ON\s+mcq_choices\s*\(\s*mcq_id\s*\)/i);
		expect(sql).toMatch(/CREATE INDEX\s+\w+\s+ON\s+mcq_attempts\s*\(\s*mcq_id\s*\)/i);
	});
});
