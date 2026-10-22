/**
 * Storage for profiles. Fulfills the ProfilesRepository declared in service.ts with D1.
 * Row shapes never leave this file; rows are mapped to the domain Profile
 */
import { eq, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ReadDb, Scope } from "#src/db/index";
import type { Profile } from "./model";
import type { ProfilesRepository } from "./service";

/** Column default: the current time (ms). A SQL expression, not a JS Date */
const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const profilesTable = sqliteTable("profiles", {
  /** The signed-in person's ID. One profile each, so it is the key */
  userId: text("user_id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(nowMs).notNull(),
});

type ProfileRow = typeof profilesTable.$inferSelect;

/** Row → thing. Same shape today, but this is the gate that keeps new columns out of domain */
const toProfile = (row: ProfileRow): Profile => ({
  userId: row.userId,
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * The window every outside read of profiles goes through. Names are public, so it takes no actor
 */
export const profilesWithin = (db: ReadDb) => db.select().from(profilesTable).as("profiles_within");

export function profilesRepository(scope: Scope<typeof profilesTable>): ProfilesRepository {
  return {
    async find(userId) {
      const [row] = await scope.reads
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      return row ? toProfile(row) : null;
    },

    async save(userId, name, now) {
      await scope
        .insert({ userId, name, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: profilesTable.userId, set: { name, updatedAt: now } });
    },
  };
}
