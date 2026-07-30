# Publishing posts

Posts are first-class Collection subpages. A post with the slug `five-lines`
is published at `/collections/five-lines/`, receives canonical and social
metadata, shares the site's navigation, and is listed automatically in
Collection.

## Add a post

1. Create `content/posts/<slug>/`.
2. Add:
   - `index.html` containing either a complete HTML document or the article
     fragment.
   - `styles.css` containing the post's visual system.
   - `visuals.js` only when the post needs client-side interaction.
3. Import those files with `?raw` in `content/posts/index.ts`.
4. Add one registry entry with:
   - `slug`
   - `title`
   - `description`
   - `publishedAt`
   - the imported document, styles, and optional runtime
5. Run `npm test`.

## Conventions

- Slugs use lowercase words separated by hyphens.
- Routes live at `/collections/<slug>/`.
- Collection entries are generated from the registry.
- Each post owns its article-level HTML, CSS, diagrams, and optional runtime.
- The site owns navigation, routing, canonical URLs, social metadata,
  publication dates, and discovery through Collection.
- A full HTML document is accepted for easy migration from a standalone essay.
  The registry extracts its body and the site supplies the document shell.
- Keep post scripts self-contained and make DOM queries specific to the post.
