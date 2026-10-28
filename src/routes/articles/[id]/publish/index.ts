import { z } from "zod";
import { createEndpoint, errorResponses, Forbidden, NotFound } from "hono-kit";
import { AlreadyPublished, articleIdSchema } from "#src/domains/articles/model";
import { requireAuth } from "#src/middleware/auth";
import { articleResponse, articleResponseSchema } from "../../_response";

export const POST = createEndpoint(
  {
    auth: requireAuth,
    request: { param: z.object({ id: articleIdSchema }) },
    responses: {
      200: articleResponseSchema,
      ...errorResponses(NotFound, Forbidden, AlreadyPublished),
    },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const now = c.get("now");

    const result = await articles.publish(actor, id, now);
    if (!result.ok) return reply.failure(result.error);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply.success(articleResponse(article));
  },
);
