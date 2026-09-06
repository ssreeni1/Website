import type { Metadata } from "next";
import { PostNavigation } from "../PostNavigation";
import { notFound } from "next/navigation";
import { getPost, posts } from "../../../content/posts";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) return {};

  const title = `${post.title} — Saneel`;
  const canonical = `/collections/${post.slug}/`;

  return {
    title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: post.description,
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: post.description,
      images: ["/og.png"],
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) notFound();

  return (
    <div className="post-page">
      <style
        data-post-styles={post.slug}
        dangerouslySetInnerHTML={{ __html: post.styles }}
      />
      <PostNavigation key={post.slug} slug={post.slug} html={post.document} />
    </div>
  );
}
