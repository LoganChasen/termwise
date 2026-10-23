"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setDemo } from "@/app/actions";
import { Button } from "./Button";

/** Switches on demo mode (a sample semester) so new visitors can look around before connecting Canvas. */
export function DemoButton({ label = "Explore a demo semester" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      onClick={() =>
        start(async () => {
          await setDemo(true);
          router.refresh();
        })
      }
      disabled={pending}
    >
      {pending ? "Loading…" : label}
    </Button>
  );
}
