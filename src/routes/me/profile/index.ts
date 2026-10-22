/**
 * /me/profile: the signed-in person's own profile
 */
import { createEndpoint, errorResponses, NotFound } from "hono-kit";
import { requireAuth } from "#src/middleware/auth";
import { profileInputSchema } from "#src/domains/profiles/model";
import { profileResponse, profileResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    responses: { 200: profileResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply, { profileQueries }) => {
    const profile = await profileQueries.get(c.get("actor").id);
    if (profile === null) return reply.failure(NotFound.code);

    return reply(200, profileResponse(profile));
  },
);

/** Creates it, or changes the name */
export const PUT = createEndpoint(
  {
    auth: requireAuth,
    request: { json: profileInputSchema },
    responses: { 200: profileResponseSchema },
  },
  async (c, reply, { profiles, profileQueries }) => {
    const actor = c.get("actor");

    await profiles.save(actor, c.req.valid("json"), c.get("now"));

    const profile = await profileQueries.get(actor.id);
    if (profile === null) throw new Error(`profile ${actor.id} is gone right after the write`);

    return reply(200, profileResponse(profile));
  },
);
