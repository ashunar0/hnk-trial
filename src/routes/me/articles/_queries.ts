/**
 * The read of /me/articles: one's own articles, drafts too
 */
import { and, desc, eq, lt, or } from "drizzle-orm";
import { toPage, type Page, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import { articlesWithin } from "#src/domains/articles/repo.d1";
import type { User } from "#src/domains/users/model";

const seen = (db: ReadDb, actor: User) => {
  const articles = articlesWithin(db, actor);
  const query = db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles);

  return { articles, query };
};

/** One's own article in the list. Its shape is the select above */
export type MyArticleRow = Awaited<ReturnType<typeof seen>["query"]>[number];

export function myArticlesQueries(db: ReadDb) {
  return {
    /** The actor's articles, the latest created first */
    async list(actor: User, { after, limit }: PageQuery): Promise<Page<MyArticleRow>> {
      const { articles, query } = seen(db, actor);
      const rows = await query
        .where(
          and(
            // The window shows others' published ones too; keep only the actor's
            eq(articles.authorId, actor.id),
            after
              ? or(
                  lt(articles.createdAt, after.at),
                  and(eq(articles.createdAt, after.at), lt(articles.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(limit + 1);

      return toPage(rows, limit, (row) => ({ at: row.createdAt, id: row.id }));
    },
  };
}
