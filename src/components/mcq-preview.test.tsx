import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqPreview } from "@/components/mcq-preview";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const question = {
	mcqId: "mcq-1",
	name: "Photosynthesis basics",
	questionText: "Which gas do plants absorb during photosynthesis?",
	choices: [
		{ id: "choice-1", choiceText: "Carbon dioxide" },
		{ id: "choice-2", choiceText: "Oxygen" },
	],
};

function attemptResponse(isCorrect: boolean, correctChoiceId: string) {
	return new Response(
		JSON.stringify({ attempt: { id: "attempt-1", isCorrect }, correctChoiceId }),
		{ status: 201 },
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", vi.fn());
});

describe("McqPreview", () => {
	it("shows the question and every choice", () => {
		render(<McqPreview {...question} />);

		expect(screen.getByText(/which gas do plants absorb/i)).toBeTruthy();
		expect(screen.getByRole("radio", { name: "Carbon dioxide" })).toBeTruthy();
		expect(screen.getByRole("radio", { name: "Oxygen" })).toBeTruthy();
	});

	it("does not reveal the answer before the attempt is submitted", () => {
		render(<McqPreview {...question} />);

		expect(screen.queryByText(/that's correct|incorrect/i)).toBeNull();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("cannot be submitted until a choice is selected", async () => {
		const user = userEvent.setup();
		render(<McqPreview {...question} />);

		const submit = screen.getByRole("button", { name: /submit answer/i });
		expect(submit.hasAttribute("disabled")).toBe(true);

		await user.click(screen.getByRole("radio", { name: "Oxygen" }));

		expect(screen.getByRole("button", { name: /submit answer/i }).hasAttribute("disabled")).toBe(
			false,
		);
	});

	it("records the chosen answer and reports a correct result", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(attemptResponse(true, "choice-1"));
		render(<McqPreview {...question} />);

		await user.click(screen.getByRole("radio", { name: "Carbon dioxide" }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(fetch).toHaveBeenCalledWith(
			"/api/mcqs/mcq-1/attempts",
			expect.objectContaining({ method: "POST" }),
		);
		const init = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit;
		expect(JSON.parse(String(init.body))).toEqual({ choiceId: "choice-1" });

		expect((await screen.findByRole("status")).textContent).toMatch(/correct/i);
	});

	it("reports an incorrect result and names the right answer", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(attemptResponse(false, "choice-1"));
		render(<McqPreview {...question} />);

		await user.click(screen.getByRole("radio", { name: "Oxygen" }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		const status = await screen.findByRole("status");
		expect(status.textContent).toMatch(/incorrect/i);
		expect(status.textContent).toMatch(/carbon dioxide/i);
	});

	it("surfaces an error when the attempt cannot be recorded", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Question not found" }), { status: 404 }),
		);
		render(<McqPreview {...question} />);

		await user.click(screen.getByRole("radio", { name: "Oxygen" }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect((await screen.findByRole("alert")).textContent).toMatch(/not found/i);
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("returns to the question bank", async () => {
		const user = userEvent.setup();
		render(<McqPreview {...question} />);

		await user.click(screen.getByRole("button", { name: /back to questions/i }));

		expect(push).toHaveBeenCalledWith("/mcqs");
	});
});
