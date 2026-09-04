import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import {
	ChoiceNotInMcqError,
	McqNotFoundError,
	recordAttempt,
} from "@/lib/services/mcq-service";
import { POST } from "./route";

const { recordAttemptMock } = vi.hoisted(() => ({ recordAttemptMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return { ...actual, recordAttempt: recordAttemptMock };
});

const correctResult = {
	attempt: {
		id: "attempt-1",
		mcqId: "mcq-1",
		choiceId: "choice-1",
		userId: null,
		isCorrect: true,
		createdAt: "2026-01-01T00:00:00.000Z",
	},
	correctChoiceId: "choice-1",
};

function context(id = "mcq-1") {
	return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1/attempts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	recordAttemptMock.mockResolvedValue(correctResult);
});

describe("POST /api/mcqs/[id]/attempts", () => {
	it("records the attempt and reports the correct choice", async () => {
		const response = await POST(postRequest({ choiceId: "choice-1" }), context());
		const json = (await response.json()) as {
			attempt: { isCorrect: boolean; choiceId: string };
			correctChoiceId: string;
		};

		expect(response.status).toBe(201);
		expect(json.attempt.isCorrect).toBe(true);
		expect(json.attempt.choiceId).toBe("choice-1");
		expect(json.correctChoiceId).toBe("choice-1");
		expect(recordAttempt).toHaveBeenCalledWith({ mcqId: "mcq-1", choiceId: "choice-1" });
		expect(getDb).not.toHaveBeenCalled();
	});

	it("reports an incorrect answer without hiding the correct choice", async () => {
		recordAttemptMock.mockResolvedValueOnce({
			attempt: { ...correctResult.attempt, choiceId: "choice-2", isCorrect: false },
			correctChoiceId: "choice-1",
		});

		const response = await POST(postRequest({ choiceId: "choice-2" }), context());
		const json = (await response.json()) as {
			attempt: { isCorrect: boolean };
			correctChoiceId: string;
		};

		expect(response.status).toBe(201);
		expect(json.attempt.isCorrect).toBe(false);
		expect(json.correctChoiceId).toBe("choice-1");
	});

	it("takes the question id from the route", async () => {
		await POST(postRequest({ choiceId: "choice-9" }), context("another-mcq"));

		expect(recordAttempt).toHaveBeenCalledWith({
			mcqId: "another-mcq",
			choiceId: "choice-9",
		});
	});

	it("ignores a client-supplied correctness claim", async () => {
		await POST(postRequest({ choiceId: "choice-2", isCorrect: true }), context());

		expect(recordAttempt).toHaveBeenCalledWith({ mcqId: "mcq-1", choiceId: "choice-2" });
		expect(recordAttempt).not.toHaveBeenCalledWith(
			expect.objectContaining({ isCorrect: expect.anything() }),
		);
	});

	it("ignores a client-supplied user id, because there is no session to trust", async () => {
		await POST(postRequest({ choiceId: "choice-1", userId: "someone-else" }), context());

		expect(recordAttempt).toHaveBeenCalledWith({ mcqId: "mcq-1", choiceId: "choice-1" });
	});

	it("rejects a missing or malformed choiceId with 400", async () => {
		const invalidBodies: [string, unknown][] = [
			["empty object", {}],
			["blank choiceId", { choiceId: "   " }],
			["numeric choiceId", { choiceId: 7 }],
			["malformed json", "{ not json"],
		];

		for (const [label, body] of invalidBodies) {
			recordAttemptMock.mockClear();
			const response = await POST(postRequest(body), context());
			expect(response.status, `expected 400 for ${label}`).toBe(400);
			expect(recordAttempt, `service must not run for ${label}`).not.toHaveBeenCalled();
		}
	});

	it("returns 404 when the question does not exist", async () => {
		recordAttemptMock.mockRejectedValueOnce(new McqNotFoundError());

		const response = await POST(postRequest({ choiceId: "choice-1" }), context("missing"));
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(404);
		expect(json.error).toMatch(/not found/i);
	});

	it("returns 404 when the choice belongs to another question", async () => {
		recordAttemptMock.mockRejectedValueOnce(new ChoiceNotInMcqError());

		const response = await POST(postRequest({ choiceId: "foreign-choice" }), context());
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(404);
		expect(json.error).toMatch(/does not belong/i);
	});

	it("returns 500 when the service fails unexpectedly", async () => {
		recordAttemptMock.mockRejectedValueOnce(new Error("d1 exploded"));

		const response = await POST(postRequest({ choiceId: "choice-1" }), context());
		const json = (await response.json()) as { error: string };

		expect(response.status).toBe(500);
		expect(json.error).toBe("Server error");
	});
});
