import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { toPage, type PageQuery } from "hono-kit/page";
import type { ReadDb } from "#src/db/index";
import type { Account } from "#src/domains/accounts/model";
import type { ArticleId, ArticleStatus } from "#src/domains/articles/model";
import { articlesWithin } from "#src/domains/articles/repo.d1";
import { commentCountByArticleWithin } from "#src/domains/comments/repo.d1";
import { profilesWithin } from "#src/domains/profiles/repo.d1";

export type Author = { id: string; displayName: string };

/** One article as GET /articles/:id shows it */
export type ArticleRow = {
  id: string;
  title: string;
  body: string;
  author: Author;
  status: ArticleStatus;
  publishedAt: Date | null;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** One line of a published list */
export type ArticleListRow = {
  id: string;
  title: string;
  author: Author;
  publishedAt: Date;
  commentCount: number;
};

/** One line of my own list (drafts too) */
export type MyArticleRow = {
  id: string;
  title: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** The rows after `after` in a newest-first list ordered by (at, id) */
const olderThan = (at: SQLiteColumn, id: SQLiteColumn, after: PageQuery["after"]) =>
  after === undefined ? undefined : or(lt(at, after.at), and(eq(at, after.at), lt(id, after.id)));

/** Every read of articles: the detail, the published lists and my list */
export const articlesQueries = (db: ReadDb) => {
  /** The article joined with its author's name and its comment count */
  const joined = (actor: Account | null) => {
    const articles = articlesWithin(db, actor);
    const profiles = profilesWithin(db);
    const counts = commentCountByArticleWithin(db);
    const from = db
      .select({
        id: articles.id,
        title: articles.title,
        body: articles.body,
        status: articles.status,
        publishedAt: articles.publishedAt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        authorId: profiles.accountId,
        authorName: profiles.displayName,
        commentCount: sql<number>`coalesce(${counts.commentCount}, 0)`,
      })
      .from(articles)
      .innerJoin(profiles, eq(profiles.accountId, articles.authorId))
      .leftJoin(counts, eq(counts.articleId, articles.id))
      .$dynamic();

    return { articles, from };
  };

  const published = (row: {
    id: string;
    title: string;
    publishedAt: Date | null;
    authorId: string;
    authorName: string;
    commentCount: number;
  }): ArticleListRow => {
    if (row.publishedAt === null)
      throw new Error(`article ${row.id} is listed but has no publishedAt`);

    return {
      id: row.id,
      title: row.title,
      author: { id: row.authorId, displayName: row.authorName },
      publishedAt: row.publishedAt,
      commentCount: row.commentCount,
    };
  };

  /** The published articles (optionally one author's), newest published first */
  const listPublished = async (actor: Account | null, query: PageQuery, authorId?: string) => {
    const { articles, from } = joined(actor);
    const rows = await from
      .where(
        and(
          eq(articles.status, "published"),
          authorId === undefined ? undefined : eq(articles.authorId, authorId),
          olderThan(articles.publishedAt, articles.id, query.after),
        ),
      )
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(query.limit + 1);

    return toPage(rows.map(published), query.limit, (item) => ({
      at: item.publishedAt,
      id: item.id,
    }));
  };

  return {
    /** An article the actor sees: a published one, or their own draft */
    async get(actor: Account | null, id: ArticleId): Promise<ArticleRow | null> {
      const { articles, from } = joined(actor);
      const [row] = await from.where(eq(articles.id, id)).limit(1);
      if (row === undefined) return null;

      return {
        id: row.id,
        title: row.title,
        body: row.body,
        author: { id: row.authorId, displayName: row.authorName },
        status: row.status,
        publishedAt: row.publishedAt,
        commentCount: row.commentCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    /** Every published article, newest published first */
    list: (actor: Account | null, query: PageQuery) => listPublished(actor, query),

    /** One person's published articles, newest published first */
    listByAuthor: (actor: Account | null, authorId: string, query: PageQuery) =>
      listPublished(actor, query, authorId),

    /** My articles, drafts too, newest created first */
    async listOwn(actor: Account, query: PageQuery) {
      const articles = articlesWithin(db, actor);
      const rows = await db
        .select({
          id: articles.id,
          title: articles.title,
          status: articles.status,
          publishedAt: articles.publishedAt,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(
          and(
            eq(articles.authorId, actor.id),
            olderThan(articles.createdAt, articles.id, query.after),
          ),
        )
        .orderBy(desc(articles.createdAt), desc(articles.id))
        .limit(query.limit + 1);

      return toPage<MyArticleRow>(rows, query.limit, (item) => ({
        at: item.createdAt,
        id: item.id,
      }));
    },
  };
};
