/**
 * How a profile is shown over HTTP
 */
import { z } from "zod";
import type { ProfileRow } from "./_queries";

export const profileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const profileResponse = (profile: ProfileRow): z.infer<typeof profileResponseSchema> => ({
  id: profile.id,
  name: profile.name,
});
