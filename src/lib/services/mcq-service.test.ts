import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import {
	ChoiceNotInMcqError,
	InvalidChoiceSetError,
	MAX_CHOICES,
	McqNotFoundError,
	MIN_CHOICES,
	createMcq,
	deleteMcq,
	getMcqWithChoices,
	listMcqs,
	recordAttempt,
	updateMcq,
} from "@/lib/services/mcq-service";
import { createMemoryD1, type MemoryD1 } from "@/test-support/memory-d1";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

let db: MemoryD1;

const photosynthesis = {
	name: "Photosynthesis basics",
	description: "Unit 3 warm-up",
	questionText: "Which gas do plants absorb during photosynthesis?",
	choices: [
		{ choiceText: "Carbon dioxide", isCorrect: true },
		{ choiceText: "Oxygen", isCorrect: false },
	],
};

function choiceSet(count: number, correctIndexes: number[] = [0]) {
	return Array.from({ length: count }, (_, index) => ({
		choiceText: `Choice ${index + 1}`,
		isCorrect: correctIndexes.includes(index),
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
	db = createMemoryD1();
	vi.mocked(getDb).mockImplementation(async () => db as never);
});

afterEach(() => {
	db.close();
});

describe("createMcq", () => {
	it("stores the question with its choices in display order", async () => {
		const created = await createMcq(photosynthesis);

		expect(created.id).toBeTruthy();
		expect(created.name).toBe("Photosynthesis basics");
		expect(created.description).toBe("Unit 3 warm-up");
		expect(created.questionText).toBe("Which gas do plants absorb during photosynthesis?");
		expect(created.choices.map((choice) => choice.choiceText)).toEqual([
			"Carbon dioxide",
			"Oxygen",
		]);
		expect(created.choices.map((choice) => choice.position)).toEqual([0, 1]);
		expect(created.choices.map((choice) => choice.isCorrect)).toEqual([true, false]);
		expect(created.choices.every((choice) => choice.mcqId === created.id)).toBe(true);
	});

	it("persists is_correct as 0 and 1 but exposes booleans", async () => {
		const created = await createMcq(photosynthesis);

		const stored = db.query<{ choice_text: string; is_correct: number }>(
			"SELECT choice_text, is_correct FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position",
			created.id,
		);

		expect(stored.map((row) => row.is_correct)).toEqual([1, 0]);
		expect(created.choices[1].isCorrect).toBe(false);
	});

	it("accepts a null description", async () => {
		const created = await createMcq({ ...photosynthesis, description: null });

		expect(created.description).toBeNull();
		const reloaded = await getMcqWithChoices(created.id);
		expect(reloaded?.description).toBeNull();
	});

	it("accepts the minimum and the maximum number of choices", async () => {
		const smallest = await createMcq({ ...photosynthesis, choices: choiceSet(MIN_CHOICES) });
		const largest = await createMcq({ ...photosynthesis, choices: choiceSet(MAX_CHOICES) });

		expect(smallest.choices).toHaveLength(2);
		expect(largest.choices).toHaveLength(6);
	});

	it("rejects fewer than two choices and writes nothing", async () => {
		await expect(
			createMcq({ ...photosynthesis, choices: choiceSet(1) }),
		).rejects.toBeInstanceOf(InvalidChoiceSetError);

		expect(db.query("SELECT id FROM mcqs")).toHaveLength(0);
	});

	it("rejects more than six choices and writes nothing", async () => {
		await expect(
			createMcq({ ...photosynthesis, choices: choiceSet(7) }),
		).rejects.toBeInstanceOf(InvalidChoiceSetError);

		expect(db.query("SELECT id FROM mcqs")).toHaveLength(0);
	});

	it("rejects a choice set with no correct answer", async () => {
		await expect(
			createMcq({ ...photosynthesis, choices: choiceSet(3, []) }),
		).rejects.toBeInstanceOf(InvalidChoiceSetError);
	});

	it("rejects a choice set with more than one correct answer", async () => {
		await expect(
			createMcq({ ...photosynthesis, choices: choiceSet(3, [0, 2]) }),
		).rejects.toBeInstanceOf(InvalidChoiceSetError);
	});
});

describe("listMcqs", () => {
	it("returns every question with a choice count, newest first", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		await createMcq({ ...photosynthesis, name: "Older", choices: choiceSet(2) });
		vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
		await createMcq({ ...photosynthesis, name: "Newer", choices: choiceSet(4) });
		vi.useRealTimers();

		const list = await listMcqs();

		expect(list.map((item) => item.name)).toEqual(["Newer", "Older"]);
		expect(list.map((item) => item.choiceCount)).toEqual([4, 2]);
	});

	it("returns an empty list when the bank is empty", async () => {
		expect(await listMcqs()).toEqual([]);
	});
});

describe("getMcqWithChoices", () => {
	it("returns the question with choices ordered by position", async () => {
		const created = await createMcq({ ...photosynthesis, choices: choiceSet(4, [2]) });

		const found = await getMcqWithChoices(created.id);

		expect(found?.id).toBe(created.id);
		expect(found?.choices.map((choice) => choice.position)).toEqual([0, 1, 2, 3]);
		expect(found?.choices.map((choice) => choice.choiceText)).toEqual([
			"Choice 1",
			"Choice 2",
			"Choice 3",
			"Choice 4",
		]);
		expect(found?.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
		expect(found?.choices[2].isCorrect).toBe(true);
	});

	it("returns null for an unknown id", async () => {
		expect(await getMcqWithChoices("does-not-exist")).toBeNull();
	});
});

describe("updateMcq", () => {
	it("replaces the question fields and the whole choice set", async () => {
		const created = await createMcq(photosynthesis);

		const updated = await updateMcq(created.id, {
			name: "Renamed",
			description: null,
			questionText: "Which gas is released?",
			choices: [
				{ choiceText: "Oxygen", isCorrect: true },
				{ choiceText: "Nitrogen", isCorrect: false },
				{ choiceText: "Argon", isCorrect: false },
			],
		});

		expect(updated.name).toBe("Renamed");
		expect(updated.description).toBeNull();
		expect(updated.questionText).toBe("Which gas is released?");
		expect(updated.choices.map((choice) => choice.choiceText)).toEqual([
			"Oxygen",
			"Nitrogen",
			"Argon",
		]);
		expect(updated.choices.map((choice) => choice.position)).toEqual([0, 1, 2]);

		// The old choices are gone, not merely detached.
		expect(db.query("SELECT id FROM mcq_choices WHERE mcq_id = ?1", created.id)).toHaveLength(3);
	});

	it("refreshes updated_at but keeps created_at", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		const created = await createMcq(photosynthesis);

		vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
		const updated = await updateMcq(created.id, { ...photosynthesis, name: "Touched" });
		vi.useRealTimers();

		expect(updated.createdAt).toBe(created.createdAt);
		expect(updated.updatedAt).not.toBe(created.updatedAt);
		expect(updated.updatedAt).toBe("2026-01-02T00:00:00.000Z");
	});

	it("discards attempts that pointed at the replaced choices", async () => {
		const created = await createMcq(photosynthesis);
		await recordAttempt({ mcqId: created.id, choiceId: created.choices[0].id });
		expect(db.query("SELECT id FROM mcq_attempts WHERE mcq_id = ?1", created.id)).toHaveLength(1);

		await updateMcq(created.id, { ...photosynthesis, name: "Touched" });

		expect(db.query("SELECT id FROM mcq_attempts WHERE mcq_id = ?1", created.id)).toHaveLength(0);
	});

	it("throws when the question does not exist", async () => {
		await expect(updateMcq("does-not-exist", photosynthesis)).rejects.toBeInstanceOf(
			McqNotFoundError,
		);
	});

	it("rejects an invalid choice set and leaves the stored question untouched", async () => {
		const created = await createMcq(photosynthesis);

		await expect(
			updateMcq(created.id, { ...photosynthesis, name: "Nope", choices: choiceSet(3, [0, 1]) }),
		).rejects.toBeInstanceOf(InvalidChoiceSetError);

		const reloaded = await getMcqWithChoices(created.id);
		expect(reloaded?.name).toBe("Photosynthesis basics");
		expect(reloaded?.choices).toHaveLength(2);
	});
});

describe("deleteMcq", () => {
	it("removes the question together with its choices and attempts", async () => {
		const created = await createMcq(photosynthesis);
		await recordAttempt({ mcqId: created.id, choiceId: created.choices[0].id });

		await deleteMcq(created.id);

		expect(await getMcqWithChoices(created.id)).toBeNull();
		expect(db.query("SELECT id FROM mcq_choices WHERE mcq_id = ?1", created.id)).toHaveLength(0);
		expect(db.query("SELECT id FROM mcq_attempts WHERE mcq_id = ?1", created.id)).toHaveLength(0);
	});

	it("leaves other questions alone", async () => {
		const kept = await createMcq({ ...photosynthesis, name: "Keep me" });
		const doomed = await createMcq({ ...photosynthesis, name: "Delete me" });

		await deleteMcq(doomed.id);

		expect(await getMcqWithChoices(kept.id)).not.toBeNull();
		expect((await listMcqs()).map((item) => item.name)).toEqual(["Keep me"]);
	});

	it("throws when the question does not exist", async () => {
		await expect(deleteMcq("does-not-exist")).rejects.toBeInstanceOf(McqNotFoundError);
	});
});

describe("recordAttempt", () => {
	it("marks the correct choice as correct and reports the answer key", async () => {
		const created = await createMcq(photosynthesis);
		const correct = created.choices.find((choice) => choice.isCorrect)!;

		const { attempt, correctChoiceId } = await recordAttempt({
			mcqId: created.id,
			choiceId: correct.id,
		});

		expect(attempt.isCorrect).toBe(true);
		expect(attempt.choiceId).toBe(correct.id);
		expect(attempt.mcqId).toBe(created.id);
		expect(attempt.userId).toBeNull();
		expect(correctChoiceId).toBe(correct.id);
	});

	it("marks a wrong choice as incorrect while still naming the correct one", async () => {
		const created = await createMcq(photosynthesis);
		const wrong = created.choices.find((choice) => !choice.isCorrect)!;
		const correct = created.choices.find((choice) => choice.isCorrect)!;

		const { attempt, correctChoiceId } = await recordAttempt({
			mcqId: created.id,
			choiceId: wrong.id,
		});

		expect(attempt.isCorrect).toBe(false);
		expect(correctChoiceId).toBe(correct.id);
	});

	it("derives correctness from storage rather than trusting the caller", async () => {
		const created = await createMcq(photosynthesis);
		const wrong = created.choices.find((choice) => !choice.isCorrect)!;

		// A caller claiming its wrong answer is correct must not be believed.
		const { attempt } = await recordAttempt({
			mcqId: created.id,
			choiceId: wrong.id,
			isCorrect: true,
		} as never);

		expect(attempt.isCorrect).toBe(false);
		const stored = db.query<{ is_correct: number }>(
			"SELECT is_correct FROM mcq_attempts WHERE id = ?1",
			attempt.id,
		);
		expect(stored[0].is_correct).toBe(0);
	});

	it("persists the attempt so it can be counted later", async () => {
		const created = await createMcq(photosynthesis);

		await recordAttempt({ mcqId: created.id, choiceId: created.choices[0].id });
		await recordAttempt({ mcqId: created.id, choiceId: created.choices[1].id });

		expect(db.query("SELECT id FROM mcq_attempts WHERE mcq_id = ?1", created.id)).toHaveLength(2);
	});

	it("rejects a choice that belongs to a different question", async () => {
		const first = await createMcq({ ...photosynthesis, name: "First" });
		const second = await createMcq({ ...photosynthesis, name: "Second" });

		await expect(
			recordAttempt({ mcqId: first.id, choiceId: second.choices[0].id }),
		).rejects.toBeInstanceOf(ChoiceNotInMcqError);

		expect(db.query("SELECT id FROM mcq_attempts")).toHaveLength(0);
	});

	it("rejects an unknown choice id", async () => {
		const created = await createMcq(photosynthesis);

		await expect(
			recordAttempt({ mcqId: created.id, choiceId: "does-not-exist" }),
		).rejects.toBeInstanceOf(ChoiceNotInMcqError);
	});

	it("throws when the question does not exist", async () => {
		await expect(
			recordAttempt({ mcqId: "does-not-exist", choiceId: "whatever" }),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("stores the user id when one is supplied", async () => {
		db.query(
			"INSERT INTO users (id, first_name, last_name, username, email, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			"user-1",
			"Ada",
			"Lovelace",
			"ada",
			"ada@school.edu",
			"a".repeat(64),
		);
		const created = await createMcq(photosynthesis);

		const { attempt } = await recordAttempt({
			mcqId: created.id,
			choiceId: created.choices[0].id,
			userId: "user-1",
		});

		expect(attempt.userId).toBe("user-1");
	});
});
