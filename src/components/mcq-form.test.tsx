import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqForm } from "@/components/mcq-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const existingMcq = {
	name: "Photosynthesis basics",
	description: "Unit 3 warm-up",
	questionText: "Which gas do plants absorb?",
	choices: [
		{ choiceText: "Carbon dioxide", isCorrect: true },
		{ choiceText: "Oxygen", isCorrect: false },
		{ choiceText: "Argon", isCorrect: false },
	],
};

function okResponse(body: unknown, status = 201) {
	return new Response(JSON.stringify(body), { status });
}

function lastFetchBody() {
	const call = vi.mocked(fetch).mock.calls.at(-1);
	const init = call?.[1] as RequestInit | undefined;
	return JSON.parse(String(init?.body ?? "{}"));
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ mcq: { id: "mcq-1" } })));
});

describe("McqForm", () => {
	it("starts with two empty choice rows", () => {
		render(<McqForm />);

		expect(screen.getByRole("textbox", { name: /choice 1/i })).toBeTruthy();
		expect(screen.getByRole("textbox", { name: /choice 2/i })).toBeTruthy();
		expect(screen.queryByRole("textbox", { name: /choice 3/i })).toBeNull();
	});

	it("adds choices up to six and then stops offering more", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		const addChoice = screen.getByRole("button", { name: /add choice/i });
		for (let count = 3; count <= 6; count += 1) {
			await user.click(addChoice);
			expect(screen.getByRole("textbox", { name: new RegExp(`choice ${count}`, "i") })).toBeTruthy();
		}

		expect(screen.queryByRole("textbox", { name: /choice 7/i })).toBeNull();
		expect(addChoice.hasAttribute("disabled")).toBe(true);
	});

	it("will not drop below two choices", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));

		expect(screen.queryByRole("textbox", { name: /choice 3/i })).toBeNull();
		// With only the minimum left, removal must no longer be offered.
		expect(screen.queryByRole("button", { name: /remove choice 1/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /remove choice 2/i })).toBeNull();
	});

	it("posts a new question with exactly one correct choice", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.type(screen.getByRole("textbox", { name: /^name/i }), "Photosynthesis basics");
		await user.type(screen.getByRole("textbox", { name: /description/i }), "Unit 3 warm-up");
		await user.type(
			screen.getByRole("textbox", { name: /question text/i }),
			"Which gas do plants absorb?",
		);
		await user.type(screen.getByRole("textbox", { name: /choice 1/i }), "Carbon dioxide");
		await user.type(screen.getByRole("textbox", { name: /choice 2/i }), "Oxygen");
		await user.click(screen.getByRole("radio", { name: /choice 2 .*correct/i }));
		await user.click(screen.getByRole("button", { name: /save/i }));

		expect(fetch).toHaveBeenCalledWith("/api/mcqs", expect.objectContaining({ method: "POST" }));
		expect(lastFetchBody()).toEqual({
			name: "Photosynthesis basics",
			description: "Unit 3 warm-up",
			questionText: "Which gas do plants absorb?",
			choices: [
				{ choiceText: "Carbon dioxide", isCorrect: false },
				{ choiceText: "Oxygen", isCorrect: true },
			],
		});
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("never marks two choices correct at once", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.type(screen.getByRole("textbox", { name: /^name/i }), "Q");
		await user.type(screen.getByRole("textbox", { name: /question text/i }), "Q?");
		await user.type(screen.getByRole("textbox", { name: /choice 1/i }), "A");
		await user.type(screen.getByRole("textbox", { name: /choice 2/i }), "B");
		await user.click(screen.getByRole("radio", { name: /choice 2 .*correct/i }));
		await user.click(screen.getByRole("radio", { name: /choice 1 .*correct/i }));
		await user.click(screen.getByRole("button", { name: /save/i }));

		const correct = lastFetchBody().choices.filter(
			(choice: { isCorrect: boolean }) => choice.isCorrect,
		);
		expect(correct).toHaveLength(1);
		expect(correct[0].choiceText).toBe("A");
	});

	it("seeds every field when editing an existing question", () => {
		render(<McqForm mcqId="mcq-1" initialMcq={existingMcq} />);

		expect(screen.getByRole("textbox", { name: /^name/i })).toHaveProperty(
			"value",
			"Photosynthesis basics",
		);
		expect(screen.getByRole("textbox", { name: /description/i })).toHaveProperty(
			"value",
			"Unit 3 warm-up",
		);
		expect(screen.getByRole("textbox", { name: /choice 3/i })).toHaveProperty("value", "Argon");
		expect(
			screen.getByRole("radio", { name: /choice 1 .*correct/i }).getAttribute("aria-checked"),
		).toBe("true");
	});

	it("updates an existing question with PUT instead of creating a new one", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(okResponse({ mcq: { id: "mcq-1" } }, 200));
		render(<McqForm mcqId="mcq-1" initialMcq={existingMcq} />);

		await user.click(screen.getByRole("button", { name: /save/i }));

		expect(fetch).toHaveBeenCalledWith(
			"/api/mcqs/mcq-1",
			expect.objectContaining({ method: "PUT" }),
		);
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows the server error and stays on the form", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			okResponse({ error: "Exactly one choice must be marked correct" }, 400),
		);
		render(<McqForm />);

		await user.type(screen.getByRole("textbox", { name: /^name/i }), "Q");
		await user.type(screen.getByRole("textbox", { name: /question text/i }), "Q?");
		await user.click(screen.getByRole("button", { name: /save/i }));

		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toMatch(/exactly one choice/i);
		expect(push).not.toHaveBeenCalled();
	});

	it("returns to the question bank without saving when cancelled", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.type(screen.getByRole("textbox", { name: /^name/i }), "Abandoned");
		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(fetch).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith("/mcqs");
	});
});
