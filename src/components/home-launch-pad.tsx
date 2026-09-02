import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function HomeLaunchPad() {
	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Quiz Maker</CardTitle>
				<CardDescription>
					A shared test bank for teachers. Register or log in to continue.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Link href="/register" className={buttonVariants()}>
					Register
				</Link>
				<Link href="/login" className={buttonVariants({ variant: "outline" })}>
					Log in
				</Link>
			</CardContent>
		</Card>
	);
}
