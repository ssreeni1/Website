import type { Metadata } from "next";
import { collectionEntries } from "../../content/collection";
import { CollectionList } from "./CollectionList";

export const metadata: Metadata = {
  title: "Collection — Saneel Sreeni",
  description: "A collection of projects, research, and writing.",
  alternates: {
    canonical: "/collection/",
  },
};

export default function CollectionPage() {
  return (
    <main className="collection-page">

      <section className="collection-shell" aria-labelledby="collection-title">
        <header className="collection-heading">
          <div className="collection-heading-title">
            <h1 id="collection-title">COLLECTION</h1>
            <span
              className="collection-key-hint"
              aria-label="Use up and down arrow keys to change selection"
            >
              [↓] [↑]
            </span>
          </div>
        </header>

        <CollectionList entries={collectionEntries} />
      </section>
    </main>
  );
}
