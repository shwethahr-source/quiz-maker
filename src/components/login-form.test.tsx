import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/hash-password";
import { LoginForm } from "@/components/login-form";

const HASH = "a".repeat(64);

const { push } = vi.hoisted(() => ({
	push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

vi.mock("@/lib/hash-password", () => ({
	hashPassword: vi.fn(async () => HASH),
}));

describe("LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders username and password from the shadcn login block", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/username/i)).toBeTruthy();
		expect(screen.getByLabelText(/password/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /^login$/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /sign up/i })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
		expect(screen.queryByRole("link", { name: /forgot/i })).toBeNull();
	});

	it("hashes the password and posts passwordHash without the raw password", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }),
		);

		render(<LoginForm />);
		await user.type(screen.getByLabelText(/username/i), "ada@school.edu");
		await user.type(screen.getByLabelText(/password/i), "secretpass");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(hashPassword).toHaveBeenCalledWith("secretpass");
		expect(fetch).toHaveBeenCalledWith(
			"/api/auth/login",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}),
		);
		const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
		expect(body).toEqual({
			username: "ada@school.edu",
			passwordHash: HASH,
		});
		expect(body).not.toHaveProperty("password");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows a generic failure and stays on the form when login returns 401", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid username or password" }), {
				status: 401,
			}),
		);

		render(<LoginForm />);
		await user.type(screen.getByLabelText(/username/i), "ada");
		await user.type(screen.getByLabelText(/password/i), "secretpass");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect((await screen.findByRole("alert")).textContent).toMatch(
			/invalid username or password/i,
		);
		expect(push).not.toHaveBeenCalled();
	});
});
