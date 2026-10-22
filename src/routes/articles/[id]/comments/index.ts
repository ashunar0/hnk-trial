/**
 * /articles/:id/comments: the comments of a published article. A draft's are as absent as the draft,
 * even to its author
 */
import {
  createEndpoint,
  errorResponses,
  NotFound,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { z } from "zod";
import { allowAnonymous, requireAuth } from "#src/middleware/auth";
import { articleIdSchema } from "#src/domains/articles/model";
import { commentInputSchema, ProfileRequired } from "#src/domains/comments/model";
import { commentResponse, commentResponseSchema } from "./_response";

const param = z.object({ id: articleIdSchema });

export const GET = createEndpoint(
  {
    auth: allowAnonymous,
    request: { param, query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(commentResponseSchema), ...errorResponses(NotFound) },
  },
  async (c, reply, { articlesQueries, articleCommentsQueries }) => {
    const { id } = c.req.valid("param");

    // The parent is visible: published, as someone signed out sees it
    const article = await articlesQueries.get(null, id);
    if (article === null) return reply.failure(NotFound.code);

    const page = await articleCommentsQueries.list(id, c.req.valid("query"));

    return reply(200, pageResponse(page, commentResponse));
  },
);

export const POST = createEndpoint(
  {
    auth: requireAuth,
    request: { param, json: commentInputSchema },
    responses: { 200: commentResponseSchema, ...errorResponses(NotFound, ProfileRequired) },
  },
  async (c, reply, { articles, profiles, comments, articleCommentsQueries }) => {
    const actor = c.get("actor");

    // Entry check: the article in the URL is published (404 here, before the write)
    const article = await articles.getPublished(c.req.valid("param").id);
    if (!article.ok) return reply.failure(article.error);

    const profile = await profiles.get(actor);
    const created = await comments.create(
      actor,
      { article: article.value, profile: profile.ok ? profile.value : null },
      c.req.valid("json"),
      c.get("now"),
    );
    if (!created.ok) return reply.failure(created.error);

    const comment = await articleCommentsQueries.get(created.value);
    if (comment === null) throw new Error(`comment ${created.value} is gone right after the write`);

    return reply(200, commentResponse(comment));
  },
);
