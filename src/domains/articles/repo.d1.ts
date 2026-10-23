/**
 * Storage for articles. Fulfills the ArticlesRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Article
 */
import { and, eq, or, type SQL } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { profilesTable } from "#src/domains/profiles/repo.d1";
import type { Account } from "#src/domains/accounts/model";
import { articleId, articleStatuses, reachOf, type Article, type ArticleReach } from "./model";
import type { ArticlesRepository } from "./service";

export const articlesTable = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.accountId),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: articleStatuses }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    // The list orders: published newest first (all, and one author's), and one author's by creation
    index("articles_published_at").on(t.status, t.publishedAt, t.id),
    index("articles_author_published_at").on(t.authorId, t.status, t.publishedAt, t.id),
    index("articles_author_created_at").on(t.authorId, t.createdAt, t.id),
  ],
);

type ArticleRow = typeof articlesTable.$inferSelect;

const toArticle = (row: ArticleRow): Article => ({
  id: articleId(row.id),
  authorId: row.authorId,
  title: row.title,
  body: row.body,
  status: row.status,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Reach → WHERE: published, or my own */
const within = (reach: ArticleReach): SQL | undefined =>
  reach.viewerId === null
    ? eq(articlesTable.status, "published")
    : or(eq(articlesTable.status, "published"), eq(articlesTable.authorId, reach.viewerId));

/**
 * The window every outside read of articles goes through: the GET queries in src/routes, and other domains.
 * Who looks decides what is seen: published ones, and the actor's own drafts
 */
export const articlesWithin = (db: ReadDb, actor: Account | null) =>
  db
    .select()
    .from(articlesTable)
    .where(within(reachOf(actor)))
    .as("articles_within");

export function articlesRepository(scope: Scope<typeof articlesTable>): ArticlesRepository {
  return {
    async find(reach, id) {
      const [row] = await scope.reads
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.id, id), within(reach)))
        .limit(1);

      return row ? toArticle(row) : null;
    },

    async insert(article) {
      await scope.insert(article);
    },

    async update(reach, id, changes) {
      const [row] = await scope
        .update(changes)
        .where(and(eq(articlesTable.id, id), within(reach)))
        .returning();

      return row ? toArticle(row) : null;
    },

    async delete(reach, id) {
      await scope.delete().where(and(eq(articlesTable.id, id), within(reach)));
    },

    async transition(reach, id, from, changes) {
      const [row] = await scope
        .update(changes)
        .where(and(eq(articlesTable.id, id), eq(articlesTable.status, from), within(reach)))
        .returning();

      return row ? toArticle(row) : null;
    },
  };
}
