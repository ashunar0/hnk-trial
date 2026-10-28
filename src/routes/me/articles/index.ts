import { createEndpoint, pageQuerySchema, pageResponse, pageResponseSchema } from "hono-kit";
import { requireAuth } from "#src/middleware/auth";
import { myArticleItem, myArticleItemSchema } from "../../articles/_response";

export const GET = createEndpoint(
  {
    auth: requireAuth,
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(myArticleItemSchema) },
  },
  async (c, reply, { articlesQueries }) => {
    const actor = c.get("actor");
    const query = c.req.valid("query");

    const page = await articlesQueries.listOwn(actor, query);

    return reply.success(pageResponse(page, myArticleItem));
  },
);
