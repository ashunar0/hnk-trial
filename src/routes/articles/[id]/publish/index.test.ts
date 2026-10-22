import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../../../test/fixtures";

it("publishes a draft and shows it to everyone", async () => {
  const author = await signUp();
  const id = await writeDraft(author);
  const at = new Date("2033-01-01T00:00:00Z");

  const res = await request(author, "POST", `/articles/${id}/publish`, undefined, at);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id,
    status: "published",
    publishedAt: at.toISOString(),
  });
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(200);
});

it("returns 409 ALREADY_PUBLISHED for a published article", async () => {
  const author = await signUp();
  const id = await writePublished(author);

  const res = await request(author, "POST", `/articles/${id}/publish`);

  expect(res.status).toBe(409);
  expect(await codeOf(res)).toBe("ALREADY_PUBLISHED");
});

it("returns 401, 404 and 403", async () => {
  const author = await signUp();
  const other = await signUp();
  const draft = await writeDraft(author);
  const published = await writePublished(author);

  expect((await request(null, "POST", `/articles/${draft}/publish`)).status).toBe(401);
  // someone else's draft looks absent
  expect(await codeOf(await request(other, "POST", `/articles/${draft}/publish`))).toBe(
    "NOT_FOUND",
  );
  expect((await request(author, "POST", `/articles/${crypto.randomUUID()}/publish`)).status).toBe(
    404,
  );
  // someone else's published article: not theirs, before it is "already published"
  expect(await codeOf(await request(other, "POST", `/articles/${published}/publish`))).toBe(
    "FORBIDDEN",
  );
  // the draft is still a draft
  expect((await request(null, "GET", `/articles/${draft}`)).status).toBe(404);
});
