import { createEndpoint, pageQuerySchema, pageResponse, pageResponseSchema } from "hono-kit";
import { articleInputSchema } from "#src/domains/articles/model";
import { allowAnonymous, requireAuth } from "#src/middleware/auth";
import { articleResponse, articleResponseSchema } from "./_response";

/** GET /articles: published articles, newest published first */
export const GET = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(articleResponseSchema) },
  },
  async (c, reply, { articlesQueries }) => {
    const query = c.req.valid("query");

    const page = await articlesQueries.listPublished(query);

    return reply(200, pageResponse(page, articleResponse));
  },
);

/** POST /articles: writes a new article as a draft */
export const POST = createEndpoint(
  {
    middleware: [requireAuth],
    request: { json: articleInputSchema },
    responses: { 200: articleResponseSchema },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const input = c.req.valid("json");
    const now = c.get("now");

    const id = await articles.create(actor, input, now);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);
