import { z } from "zod";
import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
  NotFound,
} from "hono-kit";
import { userIdSchema } from "#src/domains/users/model";
import { allowAnonymous } from "#src/middleware/auth";
import { articleResponse, articleResponseSchema } from "#src/routes/articles/_response";

/** GET /users/:id/articles: the user's published articles, newest published first */
export const GET = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { param: z.object({ id: userIdSchema }), query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(articleResponseSchema), ...errorResponses(NotFound) },
  },
  async (c, reply, { users, articlesQueries }) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    // Entry check: the user in the URL exists
    const user = await users.get(id);
    if (!user.ok) return reply.failure(user.error);

    const page = await articlesQueries.listPublishedBy(id, query);

    return reply(200, pageResponse(page, articleResponse));
  },
);
