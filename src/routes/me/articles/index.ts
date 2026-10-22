/**
 * /me/articles: the signed-in person's own articles, drafts too
 */
import { createEndpoint, pageQuerySchema, pageResponse, pageResponseSchema } from "hono-kit";
import { requireAuth } from "#src/middleware/auth";
import { myArticleResponse, myArticleResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(myArticleResponseSchema) },
  },
  async (c, reply, { myArticlesQueries }) => {
    const page = await myArticlesQueries.list(c.get("actor"), c.req.valid("query"));

    return reply(200, pageResponse(page, myArticleResponse));
  },
);
