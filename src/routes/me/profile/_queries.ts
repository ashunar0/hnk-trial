import { eq } from "drizzle-orm";
import type { ReadDb } from "#src/db/index";
import { profilesWithin } from "#src/domains/profiles/repo.d1";

export type ProfileRow = { id: string; displayName: string };

/** The profile reads: mine, and anyone's by account ID */
export const profileQueries = (db: ReadDb) => ({
  async get(accountId: string): Promise<ProfileRow | null> {
    const profiles = profilesWithin(db);
    const [row] = await db
      .select({ id: profiles.accountId, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.accountId, accountId))
      .limit(1);

    return row ?? null;
  },
});
