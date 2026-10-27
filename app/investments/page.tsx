import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investments — Saneel Sreeni",
  description:
    "A selection of Saneel Sreeni's investments across financial services and capital markets.",
  alternates: {
    canonical: "/investments/",
  },
};

const externalLinkProps = {
  target: "_blank",
  rel: "noreferrer",
} as const;

export default function InvestmentsPage() {
  return (
    <main className="about-page investments-page">
      <article className="about-copy investments-copy" aria-labelledby="investments-title">
        <h1 id="investments-title">Investments</h1>

        <p>
          I have been fortunate enough to invest both via funds and as an
          angel. I invest broadly across categories, but, given my background,
          have the deepest experience and interest in businesses relevant to
          capital markets and financial services. Some select investments
          include:
        </p>

        <ul>
          <li>
            <a href="https://nof1.ai" {...externalLinkProps}>Nof1</a>: Open-ended learning for financial markets
          </li>
          <li>
            <a href="https://arcana.io" {...externalLinkProps}>Arcana</a>: Portfolio intelligence for asset managers
          </li>
          <li>
            <a href="https://entropy.io" {...externalLinkProps}>Entropy</a>: Perpetuals for frontier markets
          </li>
          <li>
            <a href="https://plasma.org" {...externalLinkProps}>Plasma</a>: Stablecoin-based financial products
          </li>
          <li>
            <a href="https://meetautumn.com" {...externalLinkProps}>Autumn</a>: Full-stack dental billing
          </li>
        </ul>

        <p>
          And a few others around defense, bio, data, and more in stealth.
          If you think I might be of help to you and your idea or company,
          please reach out.
        </p>
      </article>
    </main>
  );
}
