/**
 * Storage for profiles. Fulfills the ProfilesRepository declared in service.ts with D1.
 */
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import { profileId, type Profile } from "./model";
import type { ProfilesRepository } from "./service";

export const profilesTable = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("profiles_account_id_unique").on(t.accountId)],
);

type ProfileRow = typeof profilesTable.$inferSelect;

const toProfile = (row: ProfileRow): Profile => ({
  id: profileId(row.id),
  accountId: row.accountId,
  displayName: row.displayName,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Every profile is visible to everyone, so the window takes no actor */
export const profilesWithin = (db: ReadDb) => db.select().from(profilesTable).as("profiles_within");

export function profilesRepository(scope: Scope<typeof profilesTable>): ProfilesRepository {
  return {
    async findByAccount(accountId) {
      const [row] = await scope.reads
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.accountId, accountId))
        .limit(1);

      return row ? toProfile(row) : null;
    },

    async upsert(profile) {
      // The unique index on account_id decides, in one statement: two requests cannot both insert
      await scope.insert(profile).onConflictDoUpdate({
        target: profilesTable.accountId,
        set: { displayName: profile.displayName, updatedAt: profile.updatedAt },
      });
    },
  };
}
