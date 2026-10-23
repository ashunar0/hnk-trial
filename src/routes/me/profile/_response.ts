import { z } from "zod";
import type { ProfileRow } from "./_queries";

/** A person as shown: the account's ID and the display name */
export const profileResponseSchema = z.object({
  id: z.string(),
  displayName: z.string(),
});

export const profileResponse = (row: ProfileRow): z.infer<typeof profileResponseSchema> => ({
  id: row.id,
  displayName: row.displayName,
});
