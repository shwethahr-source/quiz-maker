import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import {
	InvalidChoiceSetError,
	McqNotFoundError,
	deleteMcq,
	getMcqWithChoices,
	updateMcq,
} from "@/lib/services/mcq-service";
import { DELETE, GET, PUT } from "./route";

const { deleteMcqMock, getMcqWithChoicesMock, updateMcqMock } = vi.hoisted(() => ({
	deleteMcqMock: vi.fn(),
	getMcqWithChoicesMock: vi.fn(),
	updateMcqMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return {
		...actual,
		deleteMcq: deleteMcqMock,
		getMcqWithChoices: getMcqWithChoicesMock,
		updateMcq: updateMcqMock,
	};
});

const storedMcq = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	description: "Unit 3 warm-up",
	questionText: "Which gas do plants absorb during photosynthesis?",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	choices: [
		{ id: "choice-1", mcqId: "mcq-1", choiceText: "Carbon dioxide", isCorrect: true, position: 0 },
		{ id: "choice-2", mcqId: "mcq-1", choiceText: "Oxygen", isCorrect: false, position: 1 },
	],
};

const validBody = {
	name: "Renamed",
	description: null,
	questionText: "Which gas is released?",
	choices: [
		{ choiceText: "Oxygen", isCorrect: true },
		{ choiceText: "Nitrogen", isCorrect: false },
	],
};

function context(id = "mcq-1") {
	return { params: Promise.resolve({ id }) };
}

function jsonRequest(method: string, body?: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1", {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	getMcqWithChoicesMock.mockResolvedValue(storedMcq);
	updateMcqMock.mockResolvedValue({ ...storedMcq, name: "Renamed" });
	deleteMcqMock.mockResolvedValue(undefined);
});

describe("GET /api/mcqs/[id]", () => {
	it("returns the question with its choices", async () => {
		const response = await GET(jsonRequest("GET"), context());
		const json = (await response.json()) as { mcq: { id: string; choices: unknown[] } };

		expect(response.status).toBe(200);
		expect(json.mcq.id).toBe("mcq-1");
		expect(json.mcq.choices).toHaveLength(2);
		expect(getMcqWithChoices).toHaveBeenCalledWith("mcq-1");
		expect(getDb).not.toHaveBeenCalled();
	});

	it("uses the id from the route, not a hard-coded one", async () => {
		await GET(jsonRequest("GET"), context("another-id"));

		expect(getMcqWithChoices).toHaveBeenCalledWith("another-id");
	});

	it("returns 404 when the question does not exist", async () => {
		getMcqWithChoicesMock.mockResolvedValueOnce(null);

		const response = await GET(jsonRequest("GET"), context("missing"));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(404);
		expect(json.error).toMatch(/not found/i);
	});

	it("returns 500 when the service throws", async () => {
		getMcqWithChoicesMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await GET(jsonRequest("GET"), context());

		expect(response.status).toBe(500);
	});
});

describe("PUT /api/mcqs/[id]", () => {
	it("updates the question and returns the saved version", async () => {
		const response = await PUT(jsonRequest("PUT", validBody), context());
		const json = (await response.json()) as { mcq: { name: string } };

		expect(response.status).toBe(200);
		expect(json.mcq.name).toBe("Renamed");
		expect(updateMcq).toHaveBeenCalledWith("mcq-1", {
			name: "Renamed",
			description: null,
			questionText: "Which gas is released?",
			choices: [
				{ choiceText: "Oxygen", isCorrect: true },
				{ choiceText: "Nitrogen", isCorrect: false },
			],
		});
		expect(getDb).not.toHaveBeenCalled();
	});

	it("rejects an invalid body with 400 and does not call the service", async () => {
		const invalidBodies: [string, unknown][] = [
			["empty object", {}],
			["blank name", { ...validBody, name: " " }],
			["one choice", { ...validBody, choices: [{ choiceText: "Only", isCorrect: true }] }],
			[
				"two correct",
				{
					...validBody,
					choices: [
						{ choiceText: "A", isCorrect: true },
						{ choiceText: "B", isCorrect: true },
					],
				},
			],
			["malformed json", "{ not json"],
		];

		for (const [label, body] of invalidBodies) {
			updateMcqMock.mockClear();
			const response = await PUT(jsonRequest("PUT", body), context());
			expect(response.status, `expected 400 for ${label}`).toBe(400);
			expect(updateMcq, `service must not run for ${label}`).not.toHaveBeenCalled();
		}
	});

	it("returns 404 when the question does not exist", async () => {
		updateMcqMock.mockRejectedValueOnce(new McqNotFoundError());

		const response = await PUT(jsonRequest("PUT", validBody), context("missing"));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(404);
		expect(json.error).toMatch(/not found/i);
	});

	it("maps a service-level invalid choice set to 400", async () => {
		updateMcqMock.mockRejectedValueOnce(new InvalidChoiceSetError("A question needs at least 2 choices"));

		const response = await PUT(jsonRequest("PUT", validBody), context());
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(400);
		expect(json.error).toMatch(/at least 2 choices/i);
	});

	it("returns 500 when the service fails unexpectedly", async () => {
		updateMcqMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await PUT(jsonRequest("PUT", validBody), context());

		expect(response.status).toBe(500);
	});
});

describe("DELETE /api/mcqs/[id]", () => {
	it("deletes the question and confirms", async () => {
		const response = await DELETE(jsonRequest("DELETE"), context());
		const json = (await response.json()) as { ok: boolean };

		expect(response.status).toBe(200);
		expect(json.ok).toBe(true);
		expect(deleteMcq).toHaveBeenCalledWith("mcq-1");
		expect(getDb).not.toHaveBeenCalled();
	});

	it("returns 404 when the question does not exist", async () => {
		deleteMcqMock.mockRejectedValueOnce(new McqNotFoundError());

		const response = await DELETE(jsonRequest("DELETE"), context("missing"));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(404);
		expect(json.error).toMatch(/not found/i);
	});

	it("returns 500 when the service fails unexpectedly", async () => {
		deleteMcqMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await DELETE(jsonRequest("DELETE"), context());

		expect(response.status).toBe(500);
	});
});
