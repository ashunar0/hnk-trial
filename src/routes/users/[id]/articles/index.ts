import { z } from "zod";
import {
  createEndpoint,
  NotFound,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { accountIdSchema } from "#src/domains/accounts/model";
import { allowAnyone } from "#src/middleware/auth";
import { articleListItem, articleListItemSchema } from "../../../articles/_response";

export const GET = createEndpoint(
  {
    auth: allowAnyone,
    request: {
      param: z.object({ id: accountIdSchema }),
      query: pageQuerySchema(),
    },
    responses: { 200: pageResponseSchema(articleListItemSchema), ...errorResponses(NotFound) },
  },
  async (c, reply, { profileQueries, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    // Entry check: the person in the URL has a profile
    const profile = await profileQueries.get(id);
    if (profile === null) return reply.failure(NotFound.code);

    const page = await articlesQueries.listByAuthor(actor, id, query);

    return reply.success(pageResponse(page, articleListItem));
  },
);
