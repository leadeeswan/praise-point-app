import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
test("database enforces family boundaries and atomic point accounting", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}'::jsonb,raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const authUser = async (n, email, app = {}, meta = { name: "테스트" }) =>
    db.query(
      "insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values($1,$2,$3,$4)",
      [id(n), email, JSON.stringify(app), JSON.stringify(meta)],
    );
  await authUser(1, "parent1@example.com");
  await authUser(2, "parent2@example.com");
  await t.test(
    "original trigger reproduces the production admin creation failure",
    async () => {
      await db.exec("begin");
      await assert.rejects(
        authUser(
          3,
          "kidone@children.praise.invalid",
          { provider: "email" },
          { name: "아이1", age: 8 },
        ),
        /Reserved child login address/,
      );
      await db.exec("rollback");
    },
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200002_defer_child_profile.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await t.test(
    "GoTrue insert then app metadata update creates the child at commit",
    async () => {
      await db.exec("begin");
      await authUser(
        3,
        "kidone@children.praise.invalid",
        { provider: "email" },
        { name: "아이1", age: 8 },
      );
      assert.equal(
        (await db.query("select * from public.profiles where id=$1", [id(3)]))
          .rows.length,
        0,
      );
      await db.query("update auth.users set raw_app_meta_data=$1 where id=$2", [
        JSON.stringify({
          provider: "email",
          praise_role: "child",
          praise_parent_id: id(1),
          praise_username: "kidone",
        }),
        id(3),
      ]);
      await db.exec("commit");
      const profile = (
        await db.query("select * from public.profiles where id=$1", [id(3)])
      ).rows[0];
      assert.equal(profile.role, "child");
      assert.equal(profile.parent_id, id(1));
      assert.equal(profile.username, "kidone");
      assert.equal(profile.balance, 0);
    },
  );
  await t.test(
    "forged child metadata without admin metadata rolls back the auth user",
    async () => {
      await db.exec("begin");
      await authUser(
        7,
        "forged@children.praise.invalid",
        {},
        { name: "위조", age: 8, praise_role: "child", praise_parent_id: id(1) },
      );
      await assert.rejects(db.exec("commit"), /Reserved child login address/);
      assert.equal(
        (await db.query("select * from auth.users where id=$1", [id(7)])).rows
          .length,
        0,
      );
    },
  );
  await authUser(
    4,
    "kidtwo@children.praise.invalid",
    {
      praise_role: "child",
      praise_parent_id: id(2),
      praise_username: "kidtwo",
    },
    { name: "아이2", age: 6 },
  );
  await t.test(
    "signup cannot claim child privileges using user metadata",
    async () => {
      await authUser(
        5,
        "fake@example.com",
        {},
        { name: "부모", role: "child", parent_id: id(1) },
      );
      assert.equal(
        (
          await db.query("select role from public.profiles where id=$1", [
            id(5),
          ])
        ).rows[0].role,
        "parent",
      );
      await assert.rejects(
        authUser(6, "fake@children.praise.invalid"),
        /Reserved/,
      );
    },
  );
  const as = async (n, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      n ? id(n) : "",
    ]);
    await db.exec(`set role ${role}`);
  };
  await as(1);
  await t.test(
    "parent only sees own family and cannot directly set balances",
    async () => {
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        2,
      );
      await assert.rejects(
        db.query("update public.profiles set balance=999"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.award_points($1,20,$2)", [id(4), "다른 가족"]),
        /등록한 아이/,
      );
      await assert.rejects(
        db.query("select public.award_points($1,-20,$2)", [id(3), "음수"]),
        /포인트/,
      );
      await assert.rejects(
        db.query("select public.award_points($1,20,$2)", [id(3), "   "]),
        /이유/,
      );
    },
  );
  let product;
  await t.test(
    "awards create matching ledger entries and owned products",
    async () => {
      await db.query("select public.award_points($1,100,$2)", [
        id(3),
        "정리했어요",
      ]);
      assert.equal(
        (
          await db.query("select balance from public.profiles where id=$1", [
            id(3),
          ])
        ).rows[0].balance,
        100,
      );
      assert.equal(
        (
          await db.query(
            "select sum(amount)::int as total from public.transactions",
          )
        ).rows[0].total,
        100,
      );
      product = (
        await db.query(
          "insert into public.products(parent_id,name,price) values($1,$2,60) returning id",
          [id(1), "아이스크림"],
        )
      ).rows[0].id;
      await assert.rejects(
        db.query(
          "insert into public.products(parent_id,name,price) values($1,$2,1)",
          [id(2), "위조"],
        ),
        /row-level security/,
      );
    },
  );
  await as(4);
  await t.test("other family cannot see or buy the product", async () => {
    assert.equal(
      (await db.query("select * from public.products")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.transactions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.buy_product($1)", [product]),
      /구매할 수 없는/,
    );
  });
  await as(3);
  let order;
  await t.test(
    "child cannot issue points; purchase debits balance and logs order",
    async () => {
      await assert.rejects(
        db.query("select public.award_points($1,100,$2)", [id(3), "위조"]),
        /등록한 아이/,
      );
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        1,
      );
      order = (await db.query("select public.buy_product($1) as id", [product]))
        .rows[0].id;
      assert.equal(
        (await db.query("select balance from public.profiles")).rows[0].balance,
        40,
      );
      assert.equal(
        (
          await db.query(
            "select sum(amount)::int as total from public.transactions",
          )
        ).rows[0].total,
        40,
      );
      await assert.rejects(
        db.query("select public.buy_product($1)", [product]),
        /부족/,
      );
      assert.equal(
        (await db.query("select * from public.orders")).rows.length,
        1,
      );
      await assert.rejects(
        db.query("select public.fulfill_order($1)", [order]),
        /전달 대기/,
      );
      await assert.rejects(
        db.query(
          "insert into public.transactions(child_id,parent_id,amount,reason) values($1,$2,999,$3)",
          [id(3), id(1), "위조"],
        ),
        /permission denied/,
      );
    },
  );
  await as(1);
  await t.test("only owning parent can fulfill a purchase", async () => {
    await db.query("select public.fulfill_order($1)", [order]);
    assert.equal(
      (await db.query("select status from public.orders")).rows[0].status,
      "fulfilled",
    );
    await assert.rejects(
      db.query("select public.fulfill_order($1)", [order]),
      /전달 대기/,
    );
    await assert.rejects(
      db.query("select public.buy_product($1)", [product]),
      /아이 계정/,
    );
  });
  await as(null, "anon");
  await t.test(
    "public visitors cannot read child data or call purchase functions",
    async () => {
      await assert.rejects(
        db.query("select * from public.profiles"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.buy_product($1)", [product]),
        /permission denied/,
      );
    },
  );
  await db.close();
});
