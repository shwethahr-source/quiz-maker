"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { McqTable, type McqRow } from "@/components/mcq-table";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

type McqBankProps = {
	mcqs: McqRow[];
};

export function McqBank({ mcqs }: McqBankProps) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	async function deleteMcq(id: string) {
		setError(null);

		const response = await fetch(`/api/mcqs/${id}`, { method: "DELETE" });
		if (!response.ok) {
			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			setError(body?.error ?? "Unable to delete this question");
			return;
		}

		// The list is rendered from a Server Component, so refresh re-fetches it.
		router.refresh();
	}

	async function onLogout() {
		setError(null);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/login");
		} catch {
			setError("Unable to log out");
		}
	}

	return (
		<div className="flex w-full flex-col gap-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="font-heading text-xl font-medium">Question bank</h1>
					<p className="text-sm text-muted-foreground">
						Multiple-choice questions available to your quizzes.
					</p>
				</div>
				<div className="flex gap-2">
					<Button onClick={() => router.push("/mcqs/new")}>
						<PlusIcon />
						Create question
					</Button>
					<Button variant="outline" onClick={onLogout}>
						Log out
					</Button>
				</div>
			</div>

			{error ? <FieldError>{error}</FieldError> : null}

			{mcqs.length === 0 ? (
				<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					No questions yet. Create your first multiple-choice question to get started.
				</p>
			) : (
				<McqTable mcqs={mcqs} onDelete={deleteMcq} />
			)}
		</div>
	);
}
