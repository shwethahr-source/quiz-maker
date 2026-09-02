import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqStub } from "@/components/mcq-stub";

const { push } = vi.hoisted(() => ({
	push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("McqStub", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("shows placeholder copy and no question-bank controls", () => {
		render(<McqStub />);

		expect(screen.getByRole("heading", { name: /multiple.choice|mcq|question bank/i })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /add question|create question|save question/i })).toBeNull();
		expect(screen.getByRole("button", { name: /log ?out/i })).toBeTruthy();
	});

	it("posts logout and navigates to login", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

		render(<McqStub />);
		await user.click(screen.getByRole("button", { name: /log ?out/i }));

		expect(fetch).toHaveBeenCalledWith(
			"/api/auth/logout",
			expect.objectContaining({ method: "POST" }),
		);
		expect(push).toHaveBeenCalledWith("/login");
	});
});
