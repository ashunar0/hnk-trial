/**
 * /articles/:id: one article. Anyone reads a published one; the author also reads their draft
 */
import { createEndpoint, errorResponses, Forbidden, NotFound } from "hono-kit";
import { z } from "zod";
import { allowAnyone, requireAuth } from "#src/middleware/auth";
import { articleIdSchema, articleInputSchema } from "#src/domains/articles/model";
import { articleResponse, articleResponseSchema } from "../_response";

const param = z.object({ id: articleIdSchema });

export const GET = createEndpoint(
  {
    auth: allowAnyone,
    request: { param },
    responses: { 200: articleResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply, { articlesQueries }) => {
    const article = await articlesQueries.get(c.get("actor"), c.req.valid("param").id);
    if (article === null) return reply.failure(NotFound.code);

    return reply(200, articleResponse(article));
  },
);

/** Replaces the title and body, draft or published */
export const PUT = createEndpoint(
  {
    auth: requireAuth,
    request: { param, json: articleInputSchema },
    responses: { 200: articleResponseSchema, ...errorResponses(NotFound, Forbidden) },
  },
  async (c, reply, { articles, articlesQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");

    const updated = await articles.update(actor, id, c.req.valid("json"), c.get("now"));
    if (!updated.ok) return reply.failure(updated.error);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);

/** Its comments go with it */
export const DELETE = createEndpoint(
  {
    auth: requireAuth,
    request: { param },
    responses: { 200: z.object({ ok: z.literal(true) }), ...errorResponses(NotFound, Forbidden) },
  },
  async (c, reply, { articles }) => {
    const removed = await articles.remove(c.get("actor"), c.req.valid("param").id);
    if (!removed.ok) return reply.failure(removed.error);

    return reply(200, { ok: true });
  },
);
