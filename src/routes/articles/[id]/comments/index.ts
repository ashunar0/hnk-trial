import { z } from "zod";
import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
  NotFound,
} from "hono-kit";
import { articleIdSchema } from "#src/domains/articles/model";
import { commentInputSchema } from "#src/domains/comments/model";
import { allowAnonymous, requireAuth } from "#src/middleware/auth";
import { commentResponse, commentResponseSchema } from "./_response";

/** GET /articles/:id/comments: the comments of a published article, oldest first */
export const GET = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { param: z.object({ id: articleIdSchema }), query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(commentResponseSchema), ...errorResponses(NotFound) },
  },
  async (c, reply, { articlesQueries, commentsQueries }) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    // Entry check: the article is published (a draft looks absent, even to its author)
    const article = await articlesQueries.getPublished(id);
    if (article === null) return reply.failure(NotFound.code);

    const page = await commentsQueries.listOf(id, query);

    return reply(200, pageResponse(page, commentResponse));
  },
);

/** POST /articles/:id/comments: comments on a published article */
export const POST = createEndpoint(
  {
    middleware: [requireAuth],
    request: { param: z.object({ id: articleIdSchema }), json: commentInputSchema },
    responses: { 200: commentResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply, { articles, comments, commentsQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const now = c.get("now");

    // Entry check: the article in the URL is one the actor sees
    const article = await articles.get(actor, id);
    if (!article.ok) return reply.failure(article.error);

    // Whether it may be commented on (published) is the comments service's rule
    const result = await comments.create(actor, article.value, input, now);
    if (!result.ok) return reply.failure(result.error);

    const comment = await commentsQueries.get(result.value);
    if (comment === null) throw new Error(`comment ${result.value} is gone right after the write`);

    return reply(200, commentResponse(comment));
  },
);
