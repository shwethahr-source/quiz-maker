import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqBank } from "@/components/mcq-bank";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const mcqs = [
	{
		id: "mcq-1",
		name: "Photosynthesis basics",
		description: "Unit 3 warm-up",
		questionText: "Which gas do plants absorb?",
		choiceCount: 4,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
];

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
	);
});

describe("McqBank", () => {
	it("lists the questions it was given", () => {
		render(<McqBank mcqs={mcqs} />);

		expect(screen.getByRole("cell", { name: "Photosynthesis basics" })).toBeTruthy();
	});

	it("explains the bank is empty but still offers to create a question", () => {
		render(<McqBank mcqs={[]} />);

		expect(screen.getByText(/no questions yet/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /create question/i })).toBeTruthy();
	});

	it("opens the create page", async () => {
		const user = userEvent.setup();
		render(<McqBank mcqs={mcqs} />);

		await user.click(screen.getByRole("button", { name: /create question/i }));

		expect(push).toHaveBeenCalledWith("/mcqs/new");
	});

	it("deletes a confirmed question and refreshes the list", async () => {
		const user = userEvent.setup();
		render(<McqBank mcqs={mcqs} />);

		await user.click(screen.getByRole("button", { name: /open actions/i }));
		await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		expect(fetch).toHaveBeenCalledWith(
			"/api/mcqs/mcq-1",
			expect.objectContaining({ method: "DELETE" }),
		);
		expect(refresh).toHaveBeenCalled();
	});

	it("reports a failed delete instead of pretending it worked", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Question not found" }), { status: 404 }),
		);
		render(<McqBank mcqs={mcqs} />);

		await user.click(screen.getByRole("button", { name: /open actions/i }));
		await user.click(await screen.findByRole("menuitem", { name: /delete/i }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		expect((await screen.findByRole("alert")).textContent).toMatch(/not found/i);
		expect(refresh).not.toHaveBeenCalled();
	});

	it("keeps the logout the previous sprint shipped", async () => {
		const user = userEvent.setup();
		render(<McqBank mcqs={mcqs} />);

		await user.click(screen.getByRole("button", { name: /log ?out/i }));

		expect(fetch).toHaveBeenCalledWith(
			"/api/auth/logout",
			expect.objectContaining({ method: "POST" }),
		);
		expect(push).toHaveBeenCalledWith("/login");
	});
});
