"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";

export function McqStub() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onLogout() {
		setError(null);
		setPending(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/login");
		} catch {
			setError("Unable to log out");
			setPending(false);
		}
	}

	return (
		<Card className="w-full max-w-lg">
			<CardHeader>
				<CardTitle>
					<h1>Question bank</h1>
				</CardTitle>
				<CardDescription>
					Multiple-choice questions will be created here in the next sprint.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{error ? <FieldError>{error}</FieldError> : null}
				<Button type="button" variant="outline" onClick={onLogout} disabled={pending}>
					Log out
				</Button>
			</CardContent>
		</Card>
	);
}
