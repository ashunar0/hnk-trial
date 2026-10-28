import { scopeTo, wireDb } from "./db";
import type { AppEnv } from "./env";
import { articlesQueries } from "./routes/articles/_queries";
import { commentsQueries } from "./routes/articles/[id]/comments/_queries";
import { profileQueries } from "./routes/me/profile/_queries";
import { profilesRepository, profilesTable } from "./domains/profiles/repo.d1";
import { profilesService } from "./domains/profiles/service";
import { articlesRepository, articlesTable } from "./domains/articles/repo.d1";
import { articlesService } from "./domains/articles/service";
import { commentsRepository, commentsTable } from "./domains/comments/repo.d1";
import { commentsService } from "./domains/comments/service";
// hnk:imports

/**
 * The one place that gathers how domains are built (the composition root).
 *
 * buildApp receives how to build, not what was built. hono-kit's provideDeps
 * calls it per request (once, when a handler first receives it). For entry points that are not HTTP, createWorker calls it.
 * db is created per request: created at module scope, a connection-holding DB would be shared across requests.
 *
 * Build top to bottom with const. If a dependency is not written first, tsc stops with "used before its declaration".
 * So a dependency cycle between domains does not compile.
 * db itself is not returned, because entry points could then choose where to write.
 * `pnpm hnk g domain <name>` adds lines above the // hnk: lines
 */
export const makeDeps = (env: AppEnv["Bindings"]) => {
  const db = wireDb(env.DB);
  const profiles = profilesService(profilesRepository(scopeTo(db, profilesTable)));
  const articles = articlesService(articlesRepository(scopeTo(db, articlesTable)));
  const comments = commentsService(commentsRepository(scopeTo(db, commentsTable)));
  // hnk:deps

  return {
    profiles,
    articles,
    comments,
    // hnk:returns
    // The reads of the GET endpoints (each _queries.ts). They take db as ReadDb, so they cannot write
    articlesQueries: articlesQueries(db),
    commentsQueries: commentsQueries(db),
    profileQueries: profileQueries(db),
  };
};

export type Deps = ReturnType<typeof makeDeps>;

declare module "hono-kit" {
  interface Register {
    deps: Deps;
  }
}
