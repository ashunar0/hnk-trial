import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { profileInputSchema } from "#src/domains/profiles/model";
import { requireAuth } from "#src/middleware/auth";
import { profileResponse, profileResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    responses: { 200: profileResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply, { profileQueries }) => {
    const actor = c.get("actor");

    const profile = await profileQueries.get(actor.id);
    if (profile === null) return reply.failure(NotFound.code);

    return reply(200, profileResponse(profile));
  },
);

export const PUT = createEndpoint(
  {
    auth: requireAuth,
    request: { json: profileInputSchema },
    responses: { 200: profileResponseSchema },
  },
  async (c, reply, { profiles, profileQueries }) => {
    const actor = c.get("actor");
    const input = c.req.valid("json");
    const now = c.get("now");

    await profiles.save(actor, input, now);

    const profile = await profileQueries.get(actor.id);
    if (profile === null) throw new Error(`profile of ${actor.id} is gone right after the write`);

    return reply(200, profileResponse(profile));
  },
);
