import { getDb } from "@/lib/db";

/** A question needs enough choices to be a choice, and few enough to stay readable. */
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

export type McqChoice = {
	id: string;
	mcqId: string;
	choiceText: string;
	isCorrect: boolean;
	position: number;
};

export type Mcq = {
	id: string;
	name: string;
	description: string | null;
	questionText: string;
	createdAt: string;
	updatedAt: string;
};

export type McqWithChoices = Mcq & { choices: McqChoice[] };

export type McqListItem = Mcq & { choiceCount: number };

export type McqAttempt = {
	id: string;
	mcqId: string;
	choiceId: string;
	userId: string | null;
	isCorrect: boolean;
	createdAt: string;
};

export type ChoiceInput = {
	choiceText: string;
	isCorrect: boolean;
};

export type SaveMcqInput = {
	name: string;
	description?: string | null;
	questionText: string;
	choices: ChoiceInput[];
};

export type RecordAttemptInput = {
	mcqId: string;
	choiceId: string;
	userId?: string | null;
};

type McqRow = {
	id: string;
	name: string;
	description: string | null;
	question_text: string;
	created_at: string;
	updated_at: string;
};

type McqListRow = McqRow & { choice_count: number };

type McqChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
};

export class McqNotFoundError extends Error {
	readonly code = "MCQ_NOT_FOUND";

	constructor(message = "Question not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class ChoiceNotInMcqError extends Error {
	readonly code = "CHOICE_NOT_IN_MCQ";

	constructor(message = "Choice does not belong to this question") {
		super(message);
		this.name = "ChoiceNotInMcqError";
	}
}

export class InvalidChoiceSetError extends Error {
	readonly code = "INVALID_CHOICE_SET";

	constructor(message: string) {
		super(message);
		this.name = "InvalidChoiceSetError";
	}
}

const MCQ_COLUMNS = "id, name, description, question_text, created_at, updated_at";
const CHOICE_COLUMNS = "id, mcq_id, choice_text, is_correct, position";

function toMcq(row: McqRow): Mcq {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		questionText: row.question_text,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toChoice(row: McqChoiceRow): McqChoice {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceText: row.choice_text,
		// SQLite has no boolean type, so this is the only place 0/1 is interpreted.
		isCorrect: row.is_correct === 1,
		position: row.position,
	};
}

/**
 * Re-checks what SQLite cannot express as a constraint. Zod enforces the same rules at the
 * HTTP edge, but the service is callable directly, so it must not depend on that.
 */
function assertChoiceSet(choices: ChoiceInput[]): void {
	if (choices.length < MIN_CHOICES) {
		throw new InvalidChoiceSetError(`A question needs at least ${MIN_CHOICES} choices`);
	}
	if (choices.length > MAX_CHOICES) {
		throw new InvalidChoiceSetError(`A question can have at most ${MAX_CHOICES} choices`);
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		throw new InvalidChoiceSetError("Exactly one choice must be marked correct");
	}
}

async function findMcqRow(id: string): Promise<McqRow | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${MCQ_COLUMNS} FROM mcqs WHERE id = ?1`)
		.bind(id)
		.all<McqRow>();

	return results[0] ?? null;
}

async function findChoiceRows(mcqId: string): Promise<McqChoiceRow[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(`SELECT ${CHOICE_COLUMNS} FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position ASC`)
		.bind(mcqId)
		.all<McqChoiceRow>();

	return results;
}

/**
 * Builds the insert statements for a choice set. `position` comes from array order, so the
 * caller controls display order and never sends a position itself.
 */
async function choiceInsertStatements(mcqId: string, choices: ChoiceInput[], now: string) {
	const db = await getDb();

	return choices.map((choice, index) =>
		db
			.prepare(
				`INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
			)
			.bind(
				crypto.randomUUID(),
				mcqId,
				choice.choiceText,
				choice.isCorrect ? 1 : 0,
				index,
				now,
				now,
			),
	);
}

export async function createMcq(input: SaveMcqInput): Promise<McqWithChoices> {
	assertChoiceSet(input.choices);

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const description = input.description ?? null;
	const db = await getDb();

	await db.batch([
		db
			.prepare(
				`INSERT INTO mcqs (id, name, description, question_text, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			)
			.bind(id, input.name, description, input.questionText, now, now),
		...(await choiceInsertStatements(id, input.choices, now)),
	]);

	return {
		id,
		name: input.name,
		description,
		questionText: input.questionText,
		createdAt: now,
		updatedAt: now,
		choices: (await findChoiceRows(id)).map(toChoice),
	};
}

export async function listMcqs(): Promise<McqListItem[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT m.id, m.name, m.description, m.question_text, m.created_at, m.updated_at, COUNT(c.id) AS choice_count
			 FROM mcqs m
			 LEFT JOIN mcq_choices c ON c.mcq_id = m.id
			 GROUP BY m.id
			 ORDER BY m.created_at DESC, m.id DESC`,
		)
		.all<McqListRow>();

	return results.map((row) => ({ ...toMcq(row), choiceCount: Number(row.choice_count) }));
}

export async function getMcqWithChoices(id: string): Promise<McqWithChoices | null> {
	const row = await findMcqRow(id);
	if (!row) {
		return null;
	}

	return { ...toMcq(row), choices: (await findChoiceRows(id)).map(toChoice) };
}

export async function updateMcq(id: string, input: SaveMcqInput): Promise<McqWithChoices> {
	assertChoiceSet(input.choices);

	const existing = await findMcqRow(id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	const now = new Date().toISOString();
	const description = input.description ?? null;
	const db = await getDb();

	// Choices are replaced wholesale, so attempts must go too: their choice_id would
	// otherwise reference a row that no longer exists.
	await db.batch([
		db.prepare("DELETE FROM mcq_attempts WHERE mcq_id = ?1").bind(id),
		db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
		db
			.prepare(
				`UPDATE mcqs SET name = ?1, description = ?2, question_text = ?3, updated_at = ?4 WHERE id = ?5`,
			)
			.bind(input.name, description, input.questionText, now, id),
		...(await choiceInsertStatements(id, input.choices, now)),
	]);

	return {
		id,
		name: input.name,
		description,
		questionText: input.questionText,
		createdAt: existing.created_at,
		updatedAt: now,
		choices: (await findChoiceRows(id)).map(toChoice),
	};
}

export async function deleteMcq(id: string): Promise<void> {
	const existing = await findMcqRow(id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	const db = await getDb();

	// Children are removed explicitly rather than relying on ON DELETE CASCADE, because
	// D1 foreign-key enforcement depends on PRAGMA state we do not control.
	await db.batch([
		db.prepare("DELETE FROM mcq_attempts WHERE mcq_id = ?1").bind(id),
		db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
		db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id),
	]);
}

export async function recordAttempt(
	input: RecordAttemptInput,
): Promise<{ attempt: McqAttempt; correctChoiceId: string }> {
	const mcq = await findMcqRow(input.mcqId);
	if (!mcq) {
		throw new McqNotFoundError();
	}

	const choices = await findChoiceRows(input.mcqId);
	const selected = choices.find((choice) => choice.id === input.choiceId);
	if (!selected) {
		throw new ChoiceNotInMcqError();
	}

	// Correctness is read from storage. A caller cannot report its own score.
	const isCorrect = selected.is_correct === 1;
	const correctChoice = choices.find((choice) => choice.is_correct === 1);
	if (!correctChoice) {
		throw new InvalidChoiceSetError("Stored question has no correct choice");
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const userId = input.userId ?? null;
	const db = await getDb();

	await db
		.prepare(
			`INSERT INTO mcq_attempts (id, mcq_id, choice_id, user_id, is_correct, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
		)
		.bind(id, input.mcqId, input.choiceId, userId, isCorrect ? 1 : 0, now)
		.run();

	return {
		attempt: {
			id,
			mcqId: input.mcqId,
			choiceId: input.choiceId,
			userId,
			isCorrect,
			createdAt: now,
		},
		correctChoiceId: correctChoice.id,
	};
}
