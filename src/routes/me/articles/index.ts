import { createEndpoint, pageQuerySchema, pageResponse, pageResponseSchema } from "hono-kit";
import { requireAuth } from "#src/middleware/auth";
import { articleResponse, articleResponseSchema } from "#src/routes/articles/_response";

/** GET /me/articles: one's own articles, drafts included, newest created first */
export const GET = createEndpoint(
  {
    middleware: [requireAuth],
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(articleResponseSchema) },
  },
  async (c, reply, { articlesQueries }) => {
    const actor = c.get("actor");
    const query = c.req.valid("query");

    const page = await articlesQueries.listOwn(actor, query);

    return reply(200, pageResponse(page, articleResponse));
  },
);
