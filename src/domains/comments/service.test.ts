import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { accountId, authenticatedAccount } from "#src/domains/accounts/model";
import { articlesRepository, articlesTable } from "#src/domains/articles/repo.d1";
import { articlesService } from "#src/domains/articles/service";
import { profilesRepository, profilesTable } from "#src/domains/profiles/repo.d1";
import { profilesService } from "#src/domains/profiles/service";
import { db } from "../../../test/fixtures";
import { commentsRepository, commentsTable } from "./repo.d1";
import { commentsService } from "./service";

const comments = () => commentsService(commentsRepository(scopeTo(db(), commentsTable)));

it("a comment goes on a published article only; a draft is NOT_FOUND", async () => {
  const account = authenticatedAccount(accountId(`svc-${crypto.randomUUID()}`));
  await profilesService(profilesRepository(scopeTo(db(), profilesTable))).save(
    account,
    { displayName: "w" },
    new Date(),
  );
  const articles = articlesService(articlesRepository(scopeTo(db(), articlesTable)));
  const id = await articles.create(account, { title: "t", body: "b" }, new Date());

  const onDraft = await comments().create(
    account,
    { id, status: "draft" },
    { body: "c" },
    new Date(),
  );
  expect(onDraft).toEqual({ ok: false, error: "NOT_FOUND" });

  const onPublished = await comments().create(
    account,
    { id, status: "published" },
    { body: "c" },
    new Date(),
  );
  expect(onPublished.ok).toBe(true);
});
