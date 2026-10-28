import {
  createEndpoint,
  errorResponses,
  pageQuerySchema,
  pageResponse,
  pageResponseSchema,
} from "hono-kit";
import { articleInputSchema } from "#src/domains/articles/model";
import { ProfileRequired } from "#src/domains/profiles/model";
import { allowAnyone, requireAuth } from "#src/middleware/auth";
import {
  articleListItem,
  articleListItemSchema,
  articleResponse,
  articleResponseSchema,
} from "./_response";

export const GET = createEndpoint(
  {
    auth: allowAnyone,
    request: { query: pageQuerySchema() },
    responses: { 200: pageResponseSchema(articleListItemSchema) },
  },
  async (c, reply, { articlesQueries }) => {
    const actor = c.get("actor");
    const query = c.req.valid("query");

    const page = await articlesQueries.list(actor, query);

    return reply.success(pageResponse(page, articleListItem));
  },
);

export const POST = createEndpoint(
  {
    auth: requireAuth,
    request: { json: articleInputSchema },
    responses: { 200: articleResponseSchema, ...errorResponses(ProfileRequired) },
  },
  async (c, reply, { profiles, articles, articlesQueries }) => {
    const actor = c.get("actor");
    const input = c.req.valid("json");
    const now = c.get("now");

    // Entry check: only a person with a profile writes
    const profile = await profiles.get(actor);
    if (!profile.ok) return reply.failure(ProfileRequired.code);

    const id = await articles.create(actor, input, now);

    const article = await articlesQueries.get(actor, id);
    if (article === null) throw new Error(`article ${id} is gone right after the write`);

    return reply.success(articleResponse(article));
  },
);
