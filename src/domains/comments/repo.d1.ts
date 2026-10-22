/**
 * Storage for comments. Fulfills the CommentsRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Comment
 */
import { eq, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { articlesTable } from "#src/domains/articles/repo.d1";
import { usersTable } from "#src/domains/users/repo.d1";
import { commentId, type Comment } from "./model";
import type { CommentsRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const commentsTable = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    // Deleting an article deletes its comments (the database does it in the same statement)
    articleId: text("article_id")
      .notNull()
      .references(() => articlesTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.id),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  },
  (table) => [
    // The comments of an article, oldest first
    index("comments_article_created_at_idx").on(table.articleId, table.createdAt, table.id),
  ],
);

type CommentRow = typeof commentsTable.$inferSelect;

/** Row → thing. This is the gate that keeps new columns out of domain */
const toComment = (row: CommentRow): Comment => ({
  id: commentId(row.id),
  articleId: row.articleId,
  authorId: row.authorId,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * The window every outside read of comments goes through: the GET queries in src/routes, and other domains.
 * Nobody reads commentsTable directly (no-foreign-table-reads). Every comment is seen by everyone,
 * so it takes no actor. Whether the article is visible is the reader's entry check
 */
export const commentsWithin = (db: ReadDb) => db.select().from(commentsTable).as("comments_within");

/** How many comments each article has. Articles with none have no row, so join it with leftJoin */
export const commentCountByArticleWithin = (db: ReadDb) =>
  db
    .select({
      articleId: commentsTable.articleId,
      count: sql<number>`count(*)`.as("comment_count"),
    })
    .from(commentsTable)
    .groupBy(commentsTable.articleId)
    .as("comment_count_by_article_within");

export function commentsRepository(scope: Scope<typeof commentsTable>): CommentsRepository {
  return {
    async find(id) {
      const [row] = await scope.reads
        .select()
        .from(commentsTable)
        .where(eq(commentsTable.id, id))
        .limit(1);

      return row ? toComment(row) : null;
    },

    async insert(comment) {
      const [row] = await scope.insert(comment).returning();
      if (!row) throw new Error(`comment ${comment.id} was not returned after insert`);

      return toComment(row);
    },
  };
}
