import type { Metadata } from "next";
import { TruthBack } from "./TruthBack";

export const metadata: Metadata = {
  title: "Truth — Saneel Sreeni",
  alternates: {
    canonical: "/truth/",
  },
};

export default function TruthPage() {
  return (
    <main className="truth-page">
      <TruthBack />

      <figure className="truth-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/truth/poem.jpg" alt="The poem, photographed from the page" />
      </figure>
    </main>
  );
}
