import type { Metadata } from "next";
import { SiteNav } from "../SiteNav";

export const metadata: Metadata = {
  title: "About — Saneel Sreeni",
  description:
    "Saneel Sreeni works with companies to implement frontier agentic systems.",
};

const externalLinkProps = {
  target: "_blank",
  rel: "noreferrer",
} as const;

export default function AboutPage() {
  return (
    <main className="about-page">
      <SiteNav />

      <article className="about-copy" aria-labelledby="about-title">
        <h1 id="about-title">About Saneel Sreeni</h1>

        <p>
          Currently, I&apos;m exploring while independently working with
          companies to implement frontier agentic systems. My work there spans
          both legacy and technology-forward industries.
        </p>

        <p>
          Most recently, I was on the founding team at{" "}
          <a href="https://ritual.net" {...externalLinkProps}>
            Ritual
          </a>
          , which builds infrastructure for autonomous intelligence, and a
          Partner at{" "}
          <a href="https://accomplice.co" {...externalLinkProps}>
            Accomplice
          </a>
          .
        </p>

        <p>
          In a previous life, I worked on derivative markets for BTC miners,
          an assortment of investing/data science at a few venture/liquid
          funds, and graduated from{" "}
          <a href="https://met.berkeley.edu/" {...externalLinkProps}>
            UC Berkeley&apos;s M.E.T.
          </a>{" "}
          program.
        </p>

        <p>
          I&apos;m interested in the synthesis of new institutions/structures,
          the{" "}
          <a
            href="https://x.com/sanlsrni/status/2054306602849652752"
            {...externalLinkProps}
          >
            economics of permanence
          </a>
          , frontier markets,{" "}
          <a href="https://center.study/" {...externalLinkProps}>
            center studies
          </a>
          , and philosophy/theology generally. And motorsports (if you
          couldn&apos;t tell).
        </p>

        <nav className="about-socials" aria-label="Social profiles">
          <a href="https://x.com/sanlsrni" {...externalLinkProps}>
            X
          </a>
          <a
            href="https://www.linkedin.com/in/snlsrn/"
            {...externalLinkProps}
          >
            LI
          </a>
        </nav>
      </article>
    </main>
  );
}
