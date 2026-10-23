/**
 * Storage for comments. Fulfills the CommentsRepository declared in service.ts with D1.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { articlesTable } from "#src/domains/articles/repo.d1";
import { profilesTable } from "#src/domains/profiles/repo.d1";
import type { CommentsRepository } from "./service";

export const commentsTable = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    // The comments go with their article
    articleId: text("article_id")
      .notNull()
      .references(() => articlesTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.accountId),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("comments_article_created_at").on(t.articleId, t.createdAt, t.id)],
);

/** Every comment is visible to everyone (whether its article is shown is the reader's check), so no actor */
export const commentsWithin = (db: ReadDb) => db.select().from(commentsTable).as("comments_within");

/** How many comments each article has, whoever looks, whether or not the article is published now */
export const commentCountByArticleWithin = (db: ReadDb) =>
  db
    .select({
      articleId: commentsTable.articleId,
      commentCount: sql<number>`count(*)`.as("comment_count"),
    })
    .from(commentsTable)
    .groupBy(commentsTable.articleId)
    .as("comment_count_by_article");

export function commentsRepository(scope: Scope<typeof commentsTable>): CommentsRepository {
  return {
    async insert(comment) {
      await scope.insert(comment);
    },
  };
}
