/**
 * /articles: published articles, and writing a new one (a draft)
 */
import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { allowAnonymous, requireAuth } from "#src/middleware/auth";
import { articleInputSchema, ProfileRequired } from "#src/domains/articles/model";
import {
  articleResponse,
  articleResponseSchema,
  articleSummaryResponse,
  articleSummaryResponseSchema,
} from "./_response";

export const GET = createEndpoint(
  {
    middleware: [allowAnonymous],
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(articleSummaryResponseSchema) },
  },
  async (c, reply, { articlesQueries }) => {
    const page = await articlesQueries.list(c.req.valid("query"));

    return reply(200, pageResponse(page, articleSummaryResponse));
  },
);

export const POST = createEndpoint(
  {
    middleware: [requireAuth],
    request: { json: articleInputSchema },
    responses: { 200: articleResponseSchema, ...errorResponses(ProfileRequired) },
  },
  async (c, reply, { profiles, articles, articlesQueries }) => {
    const actor = c.get("actor");

    // Materials for the decision: whether the actor has a profile is articles' rule to judge
    const profile = await profiles.get(actor);
    const created = await articles.create(
      actor,
      { profile: profile.ok ? profile.value : null },
      c.req.valid("json"),
      c.get("now"),
    );
    if (!created.ok) return reply.failure(created.error);

    const article = await articlesQueries.get(actor, created.value);
    if (article === null) throw new Error(`article ${created.value} is gone right after the write`);

    return reply(200, articleResponse(article));
  },
);
