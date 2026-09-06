import type { Metadata } from "next";
import { TruthCarousel } from "./TruthCarousel";

export const metadata: Metadata = {
  title: "Truth — Saneel Sreeni",
  alternates: {
    canonical: "/truth/",
  },
};

export default function TruthPage() {
  return (
    <main className="truth-page">
      <TruthCarousel />
    </main>
  );
}
