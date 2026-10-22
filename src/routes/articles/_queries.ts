/**
 * The reads of articles. /articles and /users/:id/articles list published ones (a summary);
 * /articles/:id shows one in full, and so do the writes after they write.
 * Articles are read only through articlesWithin, which decides who sees which: drafts only by their author
 */
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { toPage, type Page, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import { publishedAtOf, type ArticleId } from "#src/domains/articles/model";
import { articlesWithin } from "#src/domains/articles/repo.d1";
import { commentCountByArticleWithin } from "#src/domains/comments/repo.d1";
import { profilesWithin } from "#src/domains/profiles/repo.d1";
import type { Account } from "#src/domains/accounts/model";

/** The author and comment count every article shows */
const extras = (db: ReadDb) => {
  const authors = profilesWithin(db);
  const counts = commentCountByArticleWithin(db);

  return {
    authors,
    counts,
    author: { id: authors.userId, name: authors.name },
    commentCount: sql<number>`coalesce(${counts.commentCount}, 0)`,
  };
};

const summaries = (db: ReadDb) => {
  // Lists show only published articles, so they are read as someone signed out sees them
  const articles = articlesWithin(db, null);
  const { authors, counts, author, commentCount } = extras(db);
  const query = db
    .select({
      id: articles.id,
      title: articles.title,
      author,
      publishedAt: articles.publishedAt,
      commentCount,
    })
    .from(articles)
    .innerJoin(authors, eq(authors.userId, articles.authorId))
    .leftJoin(counts, eq(counts.articleId, articles.id));

  return { articles, query };
};

const details = (db: ReadDb, actor: Account | null) => {
  const articles = articlesWithin(db, actor);
  const { authors, counts, author, commentCount } = extras(db);
  const query = db
    .select({
      id: articles.id,
      title: articles.title,
      body: articles.body,
      author,
      status: articles.status,
      publishedAt: articles.publishedAt,
      commentCount,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .innerJoin(authors, eq(authors.userId, articles.authorId))
    .leftJoin(counts, eq(counts.articleId, articles.id));

  return { articles, query };
};

/** A published article in a list. Its shape is the select above */
export type ArticleSummaryRow = Awaited<ReturnType<typeof summaries>["query"]>[number];

/** One article in full */
export type ArticleRow = Awaited<ReturnType<typeof details>["query"]>[number];

/** A list's conditions: the position and size, and optionally one author's */
export type ArticleListQuery = PageQuery & { authorId?: string };

export function articlesQueries(db: ReadDb) {
  return {
    /** Published articles, the latest published first */
    async list({ authorId, after, limit }: ArticleListQuery): Promise<Page<ArticleSummaryRow>> {
      const { articles, query } = summaries(db);
      const rows = await query
        .where(
          and(
            authorId ? eq(articles.authorId, authorId) : undefined,
            after
              ? or(
                  lt(articles.publishedAt, after.at),
                  and(eq(articles.publishedAt, after.at), lt(articles.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(articles.publishedAt), desc(articles.id))
        .limit(limit + 1);

      return toPage(rows, limit, (row) => ({ at: publishedAtOf(row), id: row.id }));
    },

    /** null if the actor does not see it (someone else's draft is as absent as a missing one) */
    async get(actor: Account | null, id: ArticleId): Promise<ArticleRow | null> {
      const { articles, query } = details(db, actor);
      const [row] = await query.where(eq(articles.id, id)).limit(1);

      return row ?? null;
    },
  };
}
