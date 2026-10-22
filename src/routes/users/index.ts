import { createEndpoint } from "hono-kit";
import { userInputSchema } from "#src/domains/users/model";
import { allowAnonymous } from "#src/middleware/auth";
import { userResponse, userResponseSchema } from "./_response";

/** POST /users: registers a user. Anyone may */
export const POST = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { json: userInputSchema },
    responses: { 200: userResponseSchema },
  },
  async (c, reply, { users, usersQueries }) => {
    const input = c.req.valid("json");
    const now = c.get("now");

    const id = await users.create(input, now);

    const user = await usersQueries.get(id);
    if (user === null) throw new Error(`user ${id} is gone right after the write`);

    return reply(200, userResponse(user));
  },
);
