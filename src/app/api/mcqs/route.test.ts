import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { InvalidChoiceSetError, createMcq, listMcqs } from "@/lib/services/mcq-service";
import { GET, POST } from "./route";

const { createMcqMock, listMcqsMock } = vi.hoisted(() => ({
	createMcqMock: vi.fn(),
	listMcqsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return { ...actual, createMcq: createMcqMock, listMcqs: listMcqsMock };
});

const storedMcq = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	description: "Unit 3 warm-up",
	questionText: "Which gas do plants absorb during photosynthesis?",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	choices: [
		{
			id: "choice-1",
			mcqId: "mcq-1",
			choiceText: "Carbon dioxide",
			isCorrect: true,
			position: 0,
		},
		{ id: "choice-2", mcqId: "mcq-1", choiceText: "Oxygen", isCorrect: false, position: 1 },
	],
};

const validBody = {
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

function postRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	createMcqMock.mockResolvedValue(storedMcq);
	listMcqsMock.mockResolvedValue([{ ...storedMcq, choiceCount: 2, choices: undefined }]);
});

describe("GET /api/mcqs", () => {
	it("returns the question list from the service", async () => {
		listMcqsMock.mockResolvedValue([
			{
				id: "mcq-1",
				name: "Photosynthesis basics",
				description: "Unit 3 warm-up",
				questionText: "Which gas?",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				choiceCount: 2,
			},
		]);

		const response = await GET();
		const json = (await response.json()) as { mcqs: { name: string; choiceCount: number }[] };

		expect(response.status).toBe(200);
		expect(json.mcqs).toHaveLength(1);
		expect(json.mcqs[0].name).toBe("Photosynthesis basics");
		expect(json.mcqs[0].choiceCount).toBe(2);
		expect(listMcqs).toHaveBeenCalledTimes(1);
	});

	it("returns an empty list rather than an error when the bank is empty", async () => {
		listMcqsMock.mockResolvedValue([]);

		const response = await GET();
		const json = (await response.json()) as { mcqs: unknown[] };

		expect(response.status).toBe(200);
		expect(json.mcqs).toEqual([]);
	});

	it("returns 500 when the service throws", async () => {
		listMcqsMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await GET();
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(500);
		expect(json.error).toBe("Server error");
	});

	it("never reaches the database directly", async () => {
		await GET();

		expect(getDb).not.toHaveBeenCalled();
	});
});

describe("POST /api/mcqs", () => {
	it("creates a question with its choices", async () => {
		const response = await POST(postRequest(validBody));
		const json = (await response.json()) as { mcq: { id: string; choices: unknown[] } };

		expect(response.status).toBe(201);
		expect(json.mcq.id).toBe("mcq-1");
		expect(json.mcq.choices).toHaveLength(2);
		expect(createMcq).toHaveBeenCalledWith({
			name: "Photosynthesis basics",
			description: "Unit 3 warm-up",
			questionText: "Which gas do plants absorb during photosynthesis?",
			choices: [
				{ choiceText: "Carbon dioxide", isCorrect: true },
				{ choiceText: "Oxygen", isCorrect: false },
			],
		});
		expect(getDb).not.toHaveBeenCalled();
	});

	it("treats a missing or blank description as null", async () => {
		await POST(postRequest({ ...validBody, description: undefined }));
		expect(createMcq).toHaveBeenCalledWith(expect.objectContaining({ description: null }));

		createMcqMock.mockClear();
		await POST(postRequest({ ...validBody, description: "   " }));
		expect(createMcq).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
	});

	it("accepts the minimum and maximum choice counts", async () => {
		for (const count of [2, 6]) {
			createMcqMock.mockClear();
			const response = await POST(postRequest({ ...validBody, choices: choiceSet(count) }));
			expect(response.status, `expected 201 for ${count} choices`).toBe(201);
			expect(createMcq).toHaveBeenCalledTimes(1);
		}
	});

	it("rejects invalid bodies with 400 and does not call the service", async () => {
		const invalidBodies: [string, unknown][] = [
			["empty object", {}],
			["blank name", { ...validBody, name: "   " }],
			["missing question text", { ...validBody, questionText: undefined }],
			["blank question text", { ...validBody, questionText: "" }],
			["one choice", { ...validBody, choices: choiceSet(1) }],
			["seven choices", { ...validBody, choices: choiceSet(7) }],
			["no correct choice", { ...validBody, choices: choiceSet(3, []) }],
			["two correct choices", { ...validBody, choices: choiceSet(3, [0, 1]) }],
			["blank choice text", { ...validBody, choices: [{ choiceText: " ", isCorrect: true }, { choiceText: "Oxygen", isCorrect: false }] }],
			["choice missing isCorrect", { ...validBody, choices: [{ choiceText: "A" }, { choiceText: "B" }] }],
			["choices not an array", { ...validBody, choices: "nope" }],
			["malformed json", "{ not json"],
		];

		for (const [label, body] of invalidBodies) {
			createMcqMock.mockClear();
			const response = await POST(postRequest(body));
			expect(response.status, `expected 400 for ${label}`).toBe(400);
			expect(createMcq, `service must not run for ${label}`).not.toHaveBeenCalled();
		}
	});

	it("maps a service-level invalid choice set to 400", async () => {
		createMcqMock.mockRejectedValueOnce(
			new InvalidChoiceSetError("Exactly one choice must be marked correct"),
		);

		const response = await POST(postRequest(validBody));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(400);
		expect(json.error).toMatch(/exactly one choice/i);
	});

	it("returns 500 when the service fails unexpectedly", async () => {
		createMcqMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await POST(postRequest(validBody));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(500);
		expect(json.error).toBe("Server error");
	});
});
