import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/hash-password";
import { SignupForm } from "@/components/signup-form";

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

describe("SignupForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders the registration fields from the shadcn signup block", () => {
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeTruthy();
		expect(screen.getByLabelText(/last name/i)).toBeTruthy();
		expect(screen.getByLabelText(/^username$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
		expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /create account/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
	});

	it("hashes the password and posts passwordHash without the raw password", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ user: { id: "1" } }), { status: 201 }),
		);

		render(<SignupForm />);
		await user.type(screen.getByLabelText(/first name/i), "Ada");
		await user.type(screen.getByLabelText(/last name/i), "Lovelace");
		await user.type(screen.getByLabelText(/^username$/i), "ada@school.edu");
		await user.type(screen.getByLabelText(/^email$/i), "ada@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "secretpass");
		await user.type(screen.getByLabelText(/confirm password/i), "secretpass");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(hashPassword).toHaveBeenCalledWith("secretpass");
		expect(fetch).toHaveBeenCalledWith(
			"/api/auth/register",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}),
		);
		const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
		expect(body).toEqual({
			firstName: "Ada",
			lastName: "Lovelace",
			username: "ada@school.edu",
			email: "ada@school.edu",
			passwordHash: HASH,
		});
		expect(body).not.toHaveProperty("password");
		expect(body).not.toHaveProperty("confirmPassword");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows the API error and stays on the form when register returns 400", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Username or email already taken" }), {
				status: 400,
			}),
		);

		render(<SignupForm />);
		await user.type(screen.getByLabelText(/first name/i), "Ada");
		await user.type(screen.getByLabelText(/last name/i), "Lovelace");
		await user.type(screen.getByLabelText(/^username$/i), "ada");
		await user.type(screen.getByLabelText(/^email$/i), "ada@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "secretpass");
		await user.type(screen.getByLabelText(/confirm password/i), "secretpass");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect((await screen.findByRole("alert")).textContent).toMatch(/already taken/i);
		expect(push).not.toHaveBeenCalled();
	});

	it("does not call the API when the confirmed password does not match", async () => {
		const user = userEvent.setup();

		render(<SignupForm />);
		await user.type(screen.getByLabelText(/first name/i), "Ada");
		await user.type(screen.getByLabelText(/last name/i), "Lovelace");
		await user.type(screen.getByLabelText(/^username$/i), "ada");
		await user.type(screen.getByLabelText(/^email$/i), "ada@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "secretpass");
		await user.type(screen.getByLabelText(/confirm password/i), "different1");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect((await screen.findByRole("alert")).textContent).toMatch(/match/i);
		expect(fetch).not.toHaveBeenCalled();
		expect(push).not.toHaveBeenCalled();
	});
});
