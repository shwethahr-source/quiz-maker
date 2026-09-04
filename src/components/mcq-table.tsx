"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type McqRow = {
	id: string;
	name: string;
	description: string | null;
	questionText: string;
	choiceCount: number;
	createdAt: string;
	updatedAt: string;
};

type McqTableProps = {
	mcqs: McqRow[];
	onDelete: (id: string) => Promise<void>;
};

export function McqTable({ mcqs, onDelete }: McqTableProps) {
	const router = useRouter();
	const [pendingDelete, setPendingDelete] = useState<McqRow | null>(null);
	const [deleting, setDeleting] = useState(false);

	async function confirmDelete() {
		if (!pendingDelete) {
			return;
		}

		setDeleting(true);
		try {
			await onDelete(pendingDelete.id);
			setPendingDelete(null);
		} finally {
			setDeleting(false);
		}
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Description</TableHead>
						<TableHead>Choices</TableHead>
						<TableHead>Created</TableHead>
						<TableHead className="w-12 text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{mcqs.map((mcq) => (
						<TableRow key={mcq.id}>
							<TableCell className="font-medium">{mcq.name}</TableCell>
							<TableCell className="max-w-xs truncate text-muted-foreground">
								{mcq.description ?? "—"}
							</TableCell>
							<TableCell>{mcq.choiceCount}</TableCell>
							{/* Sliced rather than localized so the column does not shift with locale. */}
							<TableCell className="text-muted-foreground">
								{mcq.createdAt.slice(0, 10)}
							</TableCell>
							<TableCell className="text-right">
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="ghost" size="icon-sm" aria-label="Open actions" />
										}
									>
										<MoreVerticalIcon />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/edit`)}>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/preview`)}>
											Preview
										</DropdownMenuItem>
										<DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(mcq)}>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<Dialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingDelete(null);
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete question?</DialogTitle>
						<DialogDescription>
							{pendingDelete?.name} will be removed along with its choices and any recorded
							attempts. This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
