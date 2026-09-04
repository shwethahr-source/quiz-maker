import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqTable } from "@/components/mcq-table";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
	{
		id: "mcq-2",
		name: "Cell division",
		description: null,
		questionText: "What is mitosis?",
		choiceCount: 2,
		createdAt: "2026-02-03T00:00:00.000Z",
		updatedAt: "2026-02-03T00:00:00.000Z",
	},
];

function rowFor(name: string) {
	const cell = screen.getByRole("cell", { name });
	const row = cell.closest("tr");
	if (!row) {
		throw new Error(`No row found for ${name}`);
	}
	return row;
}

async function openActionsFor(name: string) {
	const user = userEvent.setup();
	const trigger = within(rowFor(name)).getByRole("button", { name: /open actions/i });
	await user.click(trigger);
	return user;
}

let onDelete: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	onDelete = vi.fn().mockResolvedValue(undefined);
});

describe("McqTable", () => {
	it("lists each question with its description and choice count", () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		expect(screen.getByRole("cell", { name: "Photosynthesis basics" })).toBeTruthy();
		expect(screen.getByRole("cell", { name: "Unit 3 warm-up" })).toBeTruthy();
		expect(screen.getByRole("cell", { name: "Cell division" })).toBeTruthy();

		expect(within(rowFor("Photosynthesis basics")).getByRole("cell", { name: "4" })).toBeTruthy();
		expect(within(rowFor("Cell division")).getByRole("cell", { name: "2" })).toBeTruthy();
	});

	it("shows a placeholder instead of an empty description", () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		expect(within(rowFor("Cell division")).getByRole("cell", { name: "—" })).toBeTruthy();
	});

	it("shows the date the question was created", () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		expect(within(rowFor("Photosynthesis basics")).getByRole("cell", { name: "2026-01-01" })).toBeTruthy();
	});

	it("offers edit, preview and delete behind the row actions menu", async () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		await openActionsFor("Photosynthesis basics");

		expect(await screen.findByRole("menuitem", { name: /edit/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /preview/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /delete/i })).toBeTruthy();
	});

	it("does not show the actions until the menu is opened", () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		expect(screen.queryByRole("menuitem", { name: /edit/i })).toBeNull();
	});

	it("navigates to the edit page for the chosen question", async () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		const user = await openActionsFor("Cell division");
		await user.click(await screen.findByRole("menuitem", { name: /edit/i }));

		expect(push).toHaveBeenCalledWith("/mcqs/mcq-2/edit");
	});

	it("navigates to the preview page for the chosen question", async () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		const user = await openActionsFor("Photosynthesis basics");
		await user.click(await screen.findByRole("menuitem", { name: /preview/i }));

		expect(push).toHaveBeenCalledWith("/mcqs/mcq-1/preview");
	});

	it("asks for confirmation before deleting and names the question", async () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		const user = await openActionsFor("Photosynthesis basics");
		await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText(/photosynthesis basics/i)).toBeTruthy();
		expect(onDelete).not.toHaveBeenCalled();

		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		expect(onDelete).toHaveBeenCalledWith("mcq-1");
	});

	it("keeps the question when the confirmation is cancelled", async () => {
		render(<McqTable mcqs={mcqs} onDelete={onDelete} />);

		const user = await openActionsFor("Photosynthesis basics");
		await user.click(await screen.findByRole("menuitem", { name: /delete/i }));

		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

		expect(onDelete).not.toHaveBeenCalled();
	});
});
