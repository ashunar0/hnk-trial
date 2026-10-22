/**
 * The reads of a profile. /me/profile shows one's own; /users/:id/articles asks whether that person has one
 */
import { eq } from "drizzle-orm";
import type { ReadDb } from "#src/db/index";
import { profilesWithin } from "#src/domains/profiles/repo.d1";

const seen = (db: ReadDb) => {
  const profiles = profilesWithin(db);
  const query = db.select({ id: profiles.userId, name: profiles.name }).from(profiles);

  return { profiles, query };
};

/** A profile as shown. Its shape is the select above */
export type ProfileRow = Awaited<ReturnType<typeof seen>["query"]>[number];

export function profileQueries(db: ReadDb) {
  return {
    /** null if that person has saved none */
    async get(userId: string): Promise<ProfileRow | null> {
      const { profiles, query } = seen(db);
      const [row] = await query.where(eq(profiles.userId, userId)).limit(1);

      return row ?? null;
    },
  };
}
