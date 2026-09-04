import { McqForm } from "@/components/mcq-form";

export default function Page() {
	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="flex w-full max-w-2xl flex-col gap-6">
				<div className="flex flex-col gap-1">
					<h1 className="font-heading text-xl font-medium">New question</h1>
					<p className="text-sm text-muted-foreground">
						Write the question, then mark the one correct choice.
					</p>
				</div>
				<McqForm />
			</div>
		</div>
	);
}
