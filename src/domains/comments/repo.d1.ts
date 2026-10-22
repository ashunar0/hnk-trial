/**
 * Storage for comments. Fulfills the CommentsRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Comment
 */
import { count, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { articlesTable } from "#src/domains/articles/repo.d1";
import { profilesTable } from "#src/domains/profiles/repo.d1";
import { commentId, type Comment } from "./model";
import type { CommentsRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const commentsTable = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    // A comment does not outlive its article: deleting the article deletes its comments
    articleId: text("article_id")
      .notNull()
      .references(() => articlesTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.userId),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  },
  // GET /articles/:id/comments: an article's, oldest first
  (t) => [index("comments_article").on(t.articleId, t.createdAt, t.id)],
);

type CommentRow = typeof commentsTable.$inferSelect;

/** Row → thing */
const toComment = (row: CommentRow): Comment => ({
  id: commentId(row.id),
  articleId: row.articleId,
  authorId: row.authorId,
  body: row.body,
  createdAt: row.createdAt,
});

/**
 * The window every outside read of comments goes through. Whether the article is visible is decided
 * by the entry point before it reads, so this takes no actor
 */
export const commentsWithin = (db: ReadDb) => db.select().from(commentsTable).as("comments_within");

/** How many comments each article has, whoever looks (articles with none have no row) */
export const commentCountByArticleWithin = (db: ReadDb) =>
  db
    .select({ articleId: commentsTable.articleId, commentCount: count().as("comment_count") })
    .from(commentsTable)
    .groupBy(commentsTable.articleId)
    .as("comment_count_by_article");

export function commentsRepository(scope: Scope<typeof commentsTable>): CommentsRepository {
  return {
    async insert(comment) {
      const [row] = await scope.insert(comment).returning();
      if (!row) throw new Error(`comment ${comment.id} was not returned after insert`);

      return toComment(row);
    },
  };
}
