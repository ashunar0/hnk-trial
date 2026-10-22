import { expect, it } from "vitest";
import { scopeTo } from "#src/db/index";
import { db, signUp, writeDraft, writePublished } from "../../../test/fixtures";
import { commentId, commentInputSchema } from "./model";
import { commentsRepository, commentsTable } from "./repo.d1";
import { commentsService } from "./service";

const comments = () => commentsService(commentsRepository(scopeTo(db(), commentsTable)));

it("writes a comment on a published article and reads it back; NOT_FOUND for an unknown id", async () => {
  const author = await signUp();
  const articleId = await writePublished(author);

  const created = await comments().create(
    author,
    { id: articleId, status: "published" },
    { body: "Nice" },
    new Date(),
  );
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  const found = await comments().get(created.value);
  expect(found.ok && found.value).toMatchObject({ articleId, authorId: author.id, body: "Nice" });
  const missing = await comments().get(commentId(crypto.randomUUID()));
  expect(missing).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("treats a draft as absent: NOT_FOUND", async () => {
  const author = await signUp();
  const articleId = await writeDraft(author);

  const created = await comments().create(
    author,
    { id: articleId, status: "draft" },
    { body: "Nice" },
    new Date(),
  );

  expect(created).toEqual({ ok: false, error: "NOT_FOUND" });
});

it("trims the body and keeps it between 1 and 1000 characters", () => {
  expect(commentInputSchema.parse({ body: "  hi  " }).body).toBe("hi");
  expect(commentInputSchema.safeParse({ body: "  " }).success).toBe(false);
  expect(commentInputSchema.safeParse({ body: "a".repeat(1000) }).success).toBe(true);
  expect(commentInputSchema.safeParse({ body: "a".repeat(1001) }).success).toBe(false);
});
