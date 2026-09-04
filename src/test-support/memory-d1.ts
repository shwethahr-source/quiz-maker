/**
 * TEST SUPPORT ONLY — never import this from application code.
 *
 * A D1-shaped facade over an in-memory `node:sqlite` database, used to unit test the
 * service layer. Tests mock `@/lib/db` and hand back one of these, so the service still
 * runs its real SQL: real placeholders, real foreign keys, real ORDER BY, real aggregates.
 *
 * The alternative — a hand-written SQL parser — can pass while the production SQL is
 * broken, because the parser and the database disagree. This trades that risk for a thin
 * adapter over a real SQLite engine.
 *
 * This is not the Workers runtime and does not pretend to be. It stands in for the D1
 * binding only. Exercising real Workers behavior would need `@cloudflare/vitest-pool-workers`,
 * which both sprints deliberately declined.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

type Row = Record<string, unknown>;

/**
 * D1 accepts only null, numbers, and strings as bound values. Rejecting anything else here
 * keeps the fake honest: a service that tries to bind a boolean or an object fails in tests
 * the same way it would against the real binding.
 */
function toSqlValues(params: unknown[]): SQLInputValue[] {
	return params.map((param) => {
		if (param === null || param === undefined) {
			return null;
		}
		if (typeof param === "string" || typeof param === "number" || typeof param === "bigint") {
			return param;
		}
		throw new Error(`D1 cannot bind a value of type ${typeof param}`);
	});
}

export type MemoryD1BoundStatement = {
	sql: string;
	params: unknown[];
	run(): Promise<{ success: true }>;
	all<T = Row>(): Promise<{ results: T[] }>;
};

/**
 * Mirrors D1, where a prepared statement can be executed directly when it takes no
 * parameters, or bound first when it does.
 */
export type MemoryD1PreparedStatement = MemoryD1BoundStatement & {
	bind(...params: unknown[]): MemoryD1BoundStatement;
};

export type MemoryD1 = {
	prepare(sql: string): MemoryD1PreparedStatement;
	batch(statements: MemoryD1BoundStatement[]): Promise<{ success: true }[]>;
	/** Escape hatch for assertions that need to look at stored rows directly. */
	query<T = Row>(sql: string, ...params: unknown[]): T[];
	close(): void;
};

function migrationSql(): string {
	const migrationsDir = join(process.cwd(), "migrations");
	return readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".sql"))
		.sort()
		.map((file) => readFileSync(join(migrationsDir, file), "utf8"))
		.join("\n");
}

/**
 * Builds a fresh database with the real migrations applied. Foreign keys are enabled so
 * tests catch a dangling reference instead of silently storing one.
 */
export function createMemoryD1(): MemoryD1 {
	const db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(migrationSql());

	function bound(sql: string, params: unknown[]): MemoryD1BoundStatement {
		return {
			sql,
			params,
			async run() {
				db.prepare(sql).run(...toSqlValues(params));
				return { success: true };
			},
			async all<T = Row>() {
				return { results: db.prepare(sql).all(...toSqlValues(params)) as T[] };
			},
		};
	}

	return {
		prepare(sql: string): MemoryD1PreparedStatement {
			return {
				...bound(sql, []),
				bind(...params: unknown[]) {
					return bound(sql, params);
				},
			};
		},
		// D1 runs a batch as a single transaction; mirror that so a partial write cannot
		// survive a mid-batch failure in tests either.
		async batch(statements: MemoryD1BoundStatement[]) {
			db.exec("BEGIN");
			try {
				for (const statement of statements) {
					db.prepare(statement.sql).run(...toSqlValues(statement.params));
				}
				db.exec("COMMIT");
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
			return statements.map(() => ({ success: true }) as const);
		},
		query<T = Row>(sql: string, ...params: unknown[]) {
			return db.prepare(sql).all(...toSqlValues(params)) as T[];
		},
		close() {
			db.close();
		},
	};
}
