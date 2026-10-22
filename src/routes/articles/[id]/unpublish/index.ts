/**
 * /articles/:id/unpublish. A published article goes back to a draft. Its comments stay, hidden until it is published again
 */
import { createEndpoint, errorResponses, Forbidden, NotFound } from "hono-kit";
import { z } from "zod";
import { requireAuth } from "#src/middleware/auth";
import { articleIdSchema, NotPublished } from "#src/domains/articles/model";
import { articleResponse, articleResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    middleware: [requireAuth],
    request: { param: z.object({ id: articleIdSchema }) },
    responses: { 200: articleResponseSchema, ...errorResponses(NotFound, Forbidden, NotPublished) },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");

    const moved = await articles.unpublish(actor, id, c.get("now"));
    if (!moved.ok) return reply.failure(moved.error);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);
