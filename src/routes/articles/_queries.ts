import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { toPage, type Cursor, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import type { ArticleId } from "#src/domains/articles/model";
import {
  articlesWithin,
  ownArticlesWithin,
  publishedArticlesWithin,
} from "#src/domains/articles/repo.d1";
import { commentCountByArticleWithin } from "#src/domains/comments/repo.d1";
import type { Actor, User, UserId } from "#src/domains/users/model";
import { usersWithin } from "#src/domains/users/repo.d1";

/** The columns every article screen shows: the article, its author and the number of comments */
const selectArticles = (db: ReadDb, articles: ReturnType<typeof articlesWithin>) => {
  const authors = usersWithin(db);
  const counts = commentCountByArticleWithin(db);

  return db
    .select({
      id: articles.id,
      title: articles.title,
      body: articles.body,
      status: articles.status,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
      authorId: authors.id,
      authorName: authors.name,
      commentCount: sql<number>`coalesce(${counts.count}, 0)`,
    })
    .from(articles)
    .innerJoin(authors, eq(authors.id, articles.authorId))
    .leftJoin(counts, eq(counts.articleId, articles.id));
};

export function articlesQueries(db: ReadDb) {
  return {
    /** Published articles, newest published first */
    async listPublished(query: PageQuery) {
      const articles = publishedArticlesWithin(db);
      const rows = await selectArticles(db, articles)
        .where(after(articles.publishedAt, articles.id, query.after))
        .orderBy(desc(articles.publishedAt), desc(articles.id))
        .limit(query.limit + 1);

      return toPage(rows, query.limit, publishedCursor);
    },

    /** One author's published articles, newest published first */
    async listPublishedBy(authorId: UserId, query: PageQuery) {
      const articles = publishedArticlesWithin(db);
      const rows = await selectArticles(db, articles)
        .where(
          and(
            eq(articles.authorId, authorId),
            after(articles.publishedAt, articles.id, query.after),
          ),
        )
        .orderBy(desc(articles.publishedAt), desc(articles.id))
        .limit(query.limit + 1);

      return toPage(rows, query.limit, publishedCursor);
    },

    /** One's own articles, drafts included, newest created first */
    async listOwn(actor: User, query: PageQuery) {
      const articles = ownArticlesWithin(db, actor);
      const rows = await selectArticles(db, articles)
        .where(after(articles.createdAt, articles.id, query.after))
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(query.limit + 1);

      return toPage(rows, query.limit, (row): Cursor => ({ at: row.createdAt, id: row.id }));
    },

    /** An article the viewer sees: a published one, or the viewer's own draft. null if absent */
    async get(viewer: Actor | null, id: ArticleId) {
      const articles = articlesWithin(db, viewer);
      const [row] = await selectArticles(db, articles).where(eq(articles.id, id)).limit(1);

      return row ?? null;
    },

    /** A published article, whoever looks. null if absent or a draft */
    async getPublished(id: ArticleId) {
      const articles = publishedArticlesWithin(db);
      const [row] = await selectArticles(db, articles).where(eq(articles.id, id)).limit(1);

      return row ?? null;
    },
  };
}

/** The condition "after this position" of a list sorted newest first by (time, id) */
const after = (
  time: Parameters<typeof lt>[0],
  id: Parameters<typeof lt>[0],
  cursor: Cursor | undefined,
) =>
  cursor === undefined
    ? undefined
    : or(lt(time, cursor.at), and(eq(time, cursor.at), lt(id, cursor.id)));

export type ArticleRow = Awaited<ReturnType<typeof selectArticles>>[number];

const publishedCursor = (row: ArticleRow): Cursor => {
  if (row.publishedAt === null)
    throw new Error(`article ${row.id} is listed as published but has no publishedAt`);

  return { at: row.publishedAt, id: row.id };
};
