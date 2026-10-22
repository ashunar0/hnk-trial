# friction

hono-kit の決まりで書いていて、引っかかったところの記録。書いた人が、作業の途中で足していく。

書き方: 1 項目ずつ、どのファイルのどこで、何に迷ったか、どうしたかを書く。「こうすべきだった」ではなく、起きたことを書く。

2 回目（2026-10-22、Claude が実装。api.md を hono-kit の考えに合わせて直した後）。1 回目（Sonnet、直す前の api.md）はブランチ `sonnet-1` に残っている。ここには、設計書のせいではなく hono-kit の側にあると判断したものだけを書く。

## ぶつかった

（docs を読んでも答えが無かった、docs と実物が食い違った、lint や型に止められて直し方が分からなかった）

- **`route-lists-are-paged` が `GET /me/profile` を一覧と見なす。** lint は「パスが `[id]` で終わるなら 1 件」で見分けるので、1 人に 1 つしか無いリソース（`/me/profile`）が一覧に入る。返すのは 1 件で、ページにする意味が無い。AGENTS.md が唯一許している理由つきの `oxlint-disable-next-line` で避けた（`src/routes/me/profile/index.ts`）。→ 上限を付けるかは運用の判断（ナレッジ）で hono-kit のルールではない、として hono-kit の main でこの lint を外した。disable の行も消した
- **誰でも読めるが、ログイン中なら少し多く見せる読みの guard が無い。** `GET /articles/:id` は、公開中なら誰でも、下書きは著者だけが読める。`allowAnonymous` の後では `actor` が無く、env.ts は `user` を「handler は読まない」としている。アプリに `allowAnyone`（`c.get("viewer")` が `User | null`）を足した（`src/middleware/auth.ts`）。窓も `articlesWithin(db, viewer: User | null)` で、docs の「窓は actor を取る」の actor ではない値を取っている。→ guard の中身はアプリのもの、hono-kit が決めるのは「auth に 1 つ書く」と「それが actor を入れる」だけ、と整理した。allowAnyone は actor に User | null を入れ、viewer は消した（hono-kit fb79642、auth 欄が必須に）
- **404 と 403 を分けると、読みの範囲と書きの範囲が一致しない。** cross-domain.md は「範囲は読みと書きで同じ」、rules.md は「見えるが触れないものは FORBIDDEN」。403 が出るアプリでは、見える範囲（公開中＋自分の下書き）が触れる範囲（自分の記事）より必ず広いので、2 つが食い違って読める。rules.md・state.md・cross-domain.md を読み合わせて、「`find(reach)` → `mayChange` で FORBIDDEN → 同じ `reach` で `update` / `delete` / `transition`」と書いた（`src/domains/articles/service.ts`）。許可は `may…` が決め、`authorId` は変わらないので、確認と書き込みの間に割り込まれても他人の記事は書けない。答えは docs から組み立てられたが、3 ページにまたがっていて、1 文あれば迷わない。→ cross-domain.md に「範囲は見えるもの、変えてよいかは may… が決め、FORBIDDEN はそこから出す」を足した（hono-kit 0747cc4）
- **親を消したら子も消える、の書き方が無い。** 記事を消すとコメントも消える。cross-domain.md の「親の下にぶら下がるもの」は子の作り方だけで、親を消すときを書いていない。記事の repo はコメントの表に書けないので、コメントの表の外部キーに `onDelete: "cascade"` を付けた（`src/domains/comments/repo.d1.ts`）。子の domain が自分の表で「親と一緒に消える」と宣言するので、「他の domain の表に書かない」とはぶつからないと判断した。D1 が外部キーを守ることは `test/article-delete.test.ts` で確かめた。→ 旧 README の表にあって docs に無かった。cross-domain.md に同じやり方を足した（hono-kit 23b779e）
- **同じファイルのテストは D1 を共有するのに、fixtures の人は決め打ち。** 前のテストで保存した alice と bob のプロフィールが残り、「プロフィールが無い人」のテストが 200 で落ちた。rules.md の「本物の D1 を使う」にも、テストの間で DB が消えないことは書いていない。fixtures に毎回別の人を作る `someone()` を足した。→ hono-kit の決まりではなく DB テストの知恵なので、stack-knowledge の testing.md に足した

## 自分で決めた

（docs に書いていないので、自分で選んだ。選ばなかった案も書く）

- **`PROFILE_REQUIRED` の種類は `conflict`（409）。** プロフィールが無いのは、書き手という別のモノの「今の状態」で、作れば通る。`unprocessable`（422、要求そのものがルールに合わない）にする案もあった。rules.md の 2 つの定義は「自分のモノの状態」を前提にしていて、別のモノの状態に頼るルールがどちらかは書いていない
- **状態は列挙（`status`）と、公開した日時（`publishedAt`）の両方を持つ。** state.md に従って列挙にしたが、「公開が新しい順」と「もう一度公開すると日時が変わる」には時刻が要る。状態に付いて回る時刻の持ち方は state.md に無い。`publishedAt` だけ（null なら下書き）にする案は、state.md の「列挙にする」から外れるので採らなかった
- **公開中なら `publishedAt` はあるが、列の型はそれを知らない。** 一覧のカーソルと応答で `Date | null` を `Date` にする必要があり、記事のルールとして `publishedAtOf`（無ければ throw）を model に置いた（`_response.ts` は `_queries.ts` から値を import できないので、最初に `_queries.ts` に置いたら lint に止められた）
- **プロフィールは `userId` を主キーにした。** 生成器が出した `ProfileId` の印は消した。1 人に 1 つなので、別の ID を持つ意味が無い

## そのほか

- 雛形の `users/model.ts` は組織（`orgId`）と役割（`role`・`requireRole`）を持つ。組織も役割も無いアプリでは、model・auth・fixtures の 3 ファイルから手で消す。迷いはしなかった
- cross-domain.md の例は親の param を `[issueId]`（`issues/[issueId]/comments/`）にしているが、子は親のディレクトリの中に置くので、親が `issues/[id]/index.ts` を持つなら子も `[id]` の下になる（`articles/[id]/comments/`）。Hono 自体は兄弟で param の名前が違っても動く（確かめた）。docs の例の名前がずれているだけ
- 1 回目に Sonnet が当たった「import 元の表が docs に無い」には、今回は当たらなかった（先に lint の層の表を読んだため）。docs に表が無いこと自体は残っている
- `pnpm exec prettier --write .` は `docs/` の Markdown も整形する（1 回目で api.md の表が書き換わった）。今回は書いた直後に整形してからコミットしたので出なかった
