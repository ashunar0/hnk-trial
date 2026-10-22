/**
 * /articles/:id/publish. A draft becomes published, with publishedAt set to now
 */
import { createEndpoint, errorResponses, Forbidden, NotFound } from "hono-kit";
import { z } from "zod";
import { requireAuth } from "#src/middleware/auth";
import { articleIdSchema, AlreadyPublished } from "#src/domains/articles/model";
import { articleResponse, articleResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    middleware: [requireAuth],
    request: { param: z.object({ id: articleIdSchema }) },
    responses: {
      200: articleResponseSchema,
      ...errorResponses(NotFound, Forbidden, AlreadyPublished),
    },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");

    const moved = await articles.publish(actor, id, c.get("now"));
    if (!moved.ok) return reply.failure(moved.error);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);
