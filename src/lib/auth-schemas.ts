import { z } from "zod";

export const passwordHashSchema = z
	.string()
	.regex(/^[a-f0-9]{64}$/, "passwordHash must be a 64-character lowercase hex SHA-256 digest");

export const registerBodySchema = z.object({
	firstName: z.string().trim().min(1),
	lastName: z.string().trim().min(1),
	username: z.string().trim().min(1),
	email: z.string().trim().email(),
	passwordHash: passwordHashSchema,
});

export const loginBodySchema = z.object({
	username: z.string().trim().min(1),
	passwordHash: passwordHashSchema,
});
