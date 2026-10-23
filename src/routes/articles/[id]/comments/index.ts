import { z } from "zod";
import {
  createEndpoint,
  NotFound,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { articleIdSchema, isPublished } from "#src/domains/articles/model";
import { commentInputSchema } from "#src/domains/comments/model";
import { ProfileRequired } from "#src/domains/profiles/model";
import { allowAnyone, requireAuth } from "#src/middleware/auth";
import { commentResponse, commentResponseSchema } from "./_response";

export const GET = createEndpoint(
  {
    auth: allowAnyone,
    request: { param: z.object({ id: articleIdSchema }), query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(commentResponseSchema), ...errorResponses(NotFound) },
  },
  async (c, reply, { articlesQueries, commentsQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");

    // Entry check: the article is seen and published (a draft has no comments to show, even to its author)
    const article = await articlesQueries.get(actor, id);
    if (article === null || !isPublished(article)) return reply.failure(NotFound.code);

    const page = await commentsQueries.list(id, query);

    return reply(200, pageResponse(page, commentResponse));
  },
);

export const POST = createEndpoint(
  {
    auth: requireAuth,
    request: { param: z.object({ id: articleIdSchema }), json: commentInputSchema },
    responses: { 200: commentResponseSchema, ...errorResponses(NotFound, ProfileRequired) },
  },
  async (c, reply, { articles, profiles, comments, commentsQueries }) => {
    const actor = c.get("actor");
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const now = c.get("now");

    // Entry checks, in order: the article is seen and published, then the actor has a profile
    const article = await articles.get(actor, id);
    if (!article.ok || !isPublished(article.value)) return reply.failure(NotFound.code);

    const profile = await profiles.get(actor);
    if (!profile.ok) return reply.failure(ProfileRequired.code);

    const created = await comments.create(actor, article.value, input, now);
    if (!created.ok) return reply.failure(created.error);

    const comment = await commentsQueries.get(created.value);
    if (comment === null) throw new Error(`comment ${created.value} is gone right after the write`);

    return reply(200, commentResponse(comment));
  },
);
