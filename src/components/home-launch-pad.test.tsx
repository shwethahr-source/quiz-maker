import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeLaunchPad } from "@/components/home-launch-pad";

describe("HomeLaunchPad", () => {
	it("links to register and login", () => {
		render(<HomeLaunchPad />);

		expect(screen.getByRole("link", { name: /register|sign up|create an account/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /log ?in|sign in/i })).toBeTruthy();
	});
});
