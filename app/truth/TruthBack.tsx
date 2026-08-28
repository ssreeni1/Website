"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const BACK_HREF = "/about";

export function TruthBack() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        router.push(BACK_HREF);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <header className="topbar">
      <nav className="topbar-nav" aria-label="Back navigation">
        <Link href={BACK_HREF}>
          Back <span>[B]</span>
        </Link>
      </nav>
    </header>
  );
}
