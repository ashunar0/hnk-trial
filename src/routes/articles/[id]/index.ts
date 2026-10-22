import { z } from "zod";
import { createEndpoint, errorResponses, Forbidden, NotFound } from "hono-kit";
import { articleIdSchema, articleInputSchema } from "#src/domains/articles/model";
import { allowAnonymous, requireAuth } from "#src/middleware/auth";
import { articleResponse, articleResponseSchema } from "../_response";

/** GET /articles/:id: a published article, or the viewer's own draft */
export const GET = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { param: z.object({ id: articleIdSchema }) },
    responses: { 200: articleResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply, { articlesQueries }) => {
    const viewer = c.get("user");
    const { id } = c.req.valid("param");

    const article = await articlesQueries.get(viewer, id);
    if (article === null) return reply.failure(NotFound.code);

    return reply(200, articleResponse(article));
  },
);

/** PUT /articles/:id: replaces the title and the body. Only the author */
export const PUT = createEndpoint(
  {
    middleware: [requireAuth],
    request: { param: z.object({ id: articleIdSchema }), json: articleInputSchema },
    responses: { 200: articleResponseSchema, ...errorResponses(NotFound, Forbidden) },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const now = c.get("now");

    const result = await articles.update(actor, id, input, now);
    if (!result.ok) return reply.failure(result.error);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);

/** DELETE /articles/:id: deletes the article and its comments. Only the author */
export const DELETE = createEndpoint(
  {
    middleware: [requireAuth],
    request: { param: z.object({ id: articleIdSchema }) },
    responses: { 200: z.object({ ok: z.literal(true) }), ...errorResponses(NotFound, Forbidden) },
  },
  async (c, reply, { articles }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");

    const result = await articles.remove(actor, id);
    if (!result.ok) return reply.failure(result.error);

    return reply(200, { ok: true });
  },
);
