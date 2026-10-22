import { z } from "zod";
import type { UserRow } from "./_queries";

export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export const userResponse = (user: UserRow): z.infer<typeof userResponseSchema> => ({
  id: user.id,
  name: user.name,
  createdAt: user.createdAt.toISOString(),
});
