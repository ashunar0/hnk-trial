/**
 * /users/:id/articles: what one person has published. The same articles as /articles, another resource
 */
import {
  createEndpoint,
  errorResponses,
  NotFound,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { z } from "zod";
import { allowAnonymous } from "#src/middleware/auth";
import { accountIdSchema } from "#src/domains/accounts/model";
import {
  articleSummaryResponse,
  articleSummaryResponseSchema,
} from "#src/routes/articles/_response";

export const GET = createEndpoint(
  {
    auth: allowAnonymous,
    request: { param: z.object({ id: accountIdSchema }), query: pageQuerySchema() },
    responses: {
      200: pageResponseSchema(articleSummaryResponseSchema),
      ...errorResponses(NotFound),
    },
  },
  async (c, reply, { profileQueries, articlesQueries }) => {
    const { id } = c.req.valid("param");

    // Entry check: the person in the URL has a profile
    if ((await profileQueries.get(id)) === null) return reply.failure(NotFound.code);

    const page = await articlesQueries.list({ ...c.req.valid("query"), authorId: id });

    return reply(200, pageResponse(page, articleSummaryResponse));
  },
);
