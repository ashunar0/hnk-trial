import { expect, it } from "vitest";
import { codeOf, request, signUp, writeDraft, writePublished } from "../../../../test/fixtures";

const unknown = () => crypto.randomUUID();

it("shows a published article to anyone, signed out too", async () => {
  const author = await signUp("Asahi");
  const id = await writePublished(author);

  const res = await request(null, "GET", `/articles/${id}`);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id,
    status: "published",
    author: { id: author.id, name: "Asahi" },
    commentCount: 0,
  });
});

it("shows a draft to its author only; to others it is 404", async () => {
  const author = await signUp();
  const other = await signUp();
  const id = await writeDraft(author);

  expect((await request(author, "GET", `/articles/${id}`)).status).toBe(200);
  const asOther = await request(other, "GET", `/articles/${id}`);
  expect(asOther.status).toBe(404);
  expect(await codeOf(asOther)).toBe("NOT_FOUND");
  expect((await request(null, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(author, "GET", `/articles/${unknown()}`)).status).toBe(404);
});

it("replaces title and body of a draft and of a published article, as the author", async () => {
  const author = await signUp();
  const draft = await writeDraft(author);
  const published = await writePublished(author);

  for (const id of [draft, published]) {
    const res = await request(author, "PUT", `/articles/${id}`, { title: " New ", body: "Newer" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, title: "New", body: "Newer" });
  }
});

it("returns 401, 400, 404 and 403 for PUT in that order of checks", async () => {
  const author = await signUp();
  const other = await signUp();
  const draft = await writeDraft(author);
  const published = await writePublished(author);
  const body = { title: "t", body: "b" };

  expect((await request(null, "PUT", `/articles/${draft}`, body)).status).toBe(401);
  expect(
    (await request(author, "PUT", `/articles/${draft}`, { title: "", body: "b" })).status,
  ).toBe(400);
  // someone else's draft looks absent
  expect(await codeOf(await request(other, "PUT", `/articles/${draft}`, body))).toBe("NOT_FOUND");
  expect(await codeOf(await request(author, "PUT", `/articles/${unknown()}`, body))).toBe(
    "NOT_FOUND",
  );
  // someone else's published article is seen but not theirs
  const forbidden = await request(other, "PUT", `/articles/${published}`, body);
  expect(forbidden.status).toBe(403);
  expect(await codeOf(forbidden)).toBe("FORBIDDEN");
});

it("deletes as the author, with its comments", async () => {
  const author = await signUp();
  const id = await writePublished(author);
  await request(author, "POST", `/articles/${id}/comments`, { body: "bye" });

  const res = await request(author, "DELETE", `/articles/${id}`);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect((await request(author, "GET", `/articles/${id}`)).status).toBe(404);
  expect((await request(author, "GET", `/articles/${id}/comments`)).status).toBe(404);
  expect((await request(author, "DELETE", `/articles/${id}`)).status).toBe(404);
});

it("returns 401, 404 and 403 for DELETE", async () => {
  const author = await signUp();
  const other = await signUp();
  const draft = await writeDraft(author);
  const published = await writePublished(author);

  expect((await request(null, "DELETE", `/articles/${draft}`)).status).toBe(401);
  expect((await request(other, "DELETE", `/articles/${draft}`)).status).toBe(404);
  expect((await request(other, "DELETE", `/articles/${published}`)).status).toBe(403);
  // nothing was deleted
  expect((await request(author, "GET", `/articles/${draft}`)).status).toBe(200);
  expect((await request(author, "GET", `/articles/${published}`)).status).toBe(200);
});
