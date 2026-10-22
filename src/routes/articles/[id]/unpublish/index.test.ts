import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../../../test/fixtures";

it("takes a published article back to a draft and hides it from others", async () => {
  const author = await signUp();
  const id = await writePublished(author);

  const res = await request(author, "POST", `/articles/${id}/unpublish`);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ id, status: "draft", publishedAt: null });
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(author, "GET", `/articles/${id}`)).status).toBe(200);
});

it("keeps the comments while it is a draft, and shows them again once published again", async () => {
  const author = await signUp();
  const id = await writePublished(author);
  await request(author, "POST", `/articles/${id}/comments`, { body: "kept" });

  await request(author, "POST", `/articles/${id}/unpublish`);
  expect((await request(null, "GET", `/articles/${id}/comments`)).status).toBe(404);

  await request(author, "POST", `/articles/${id}/publish`);
  const res = await request(null, "GET", `/articles/${id}/comments`);
  expect(res.status).toBe(200);
  const page = (await res.json()) as { items: { body: string }[] };
  expect(page.items.map((item) => item.body)).toEqual(["kept"]);
});

it("returns 409 NOT_PUBLISHED for a draft", async () => {
  const author = await signUp();
  const id = await writeDraft(author);

  const res = await request(author, "POST", `/articles/${id}/unpublish`);

  expect(res.status).toBe(409);
  expect(await codeOf(res)).toBe("NOT_PUBLISHED");
});

it("returns 401, 404 and 403", async () => {
  const author = await signUp();
  const other = await signUp();
  const draft = await writeDraft(author);
  const published = await writePublished(author);

  expect((await request(null, "POST", `/articles/${published}/unpublish`)).status).toBe(401);
  expect(await codeOf(await request(other, "POST", `/articles/${draft}/unpublish`))).toBe(
    "NOT_FOUND",
  );
  expect((await request(author, "POST", `/articles/${crypto.randomUUID()}/unpublish`)).status).toBe(
    404,
  );
  expect(await codeOf(await request(other, "POST", `/articles/${published}/unpublish`))).toBe(
    "FORBIDDEN",
  );
  // it is still published
  expect((await request(null, "GET", `/articles/${published}`)).status).toBe(200);
});
