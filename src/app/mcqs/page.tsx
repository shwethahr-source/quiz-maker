import { McqBank } from "@/components/mcq-bank";
import { listMcqs } from "@/lib/services/mcq-service";

// Read on the server so the list never round-trips through the browser to be rendered.
export const dynamic = "force-dynamic";

export default async function Page() {
	const mcqs = await listMcqs();

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="w-full max-w-4xl">
				<McqBank mcqs={mcqs.map((mcq) => ({ ...mcq }))} />
			</div>
		</div>
	);
}
