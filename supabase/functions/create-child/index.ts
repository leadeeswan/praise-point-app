import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "로그인이 필요해요." }, 401);
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user)
      return reply({ error: "다시 로그인해주세요." }, 401);
    const { data: parent, error: parentError } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .single();
    if (parentError || parent?.role !== "parent")
      return reply({ error: "부모님만 아이를 등록할 수 있어요." }, 403);
    const body = await req.json();
    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const name = String(body.name ?? "").trim();
    const age = Number(body.age);
    const password = String(body.password ?? "");
    if (
      !/^[a-z0-9_]{4,20}$/.test(username) ||
      !name ||
      name.length > 30 ||
      !Number.isInteger(age) ||
      age < 1 ||
      age > 19 ||
      !/^\d{6,12}$/.test(password)
    ) {
      return reply(
        {
          error:
            "이름, 아이디(영문·숫자·밑줄 4~20자), 나이(1~19), 인증번호(숫자 6~12자리)를 확인해주세요.",
        },
        400,
      );
    }
    // The auth trigger creates the profile in the same database transaction.
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@children.praise.invalid`,
      password,
      email_confirm: true,
      app_metadata: {
        praise_role: "child",
        praise_parent_id: user.id,
        praise_username: username,
      },
      user_metadata: { name, age },
    });
    if (error)
      return reply(
        {
          error:
            error.code === "email_exists" || error.message.includes("already")
              ? "이미 사용 중인 아이디예요."
              : "아이 등록에 실패했어요. DB 설정과 인증번호 정책을 확인해주세요.",
        },
        400,
      );
    return reply({ id: data.user.id });
  } catch {
    return reply(
      { error: "요청을 처리할 수 없어요. 입력값과 서버 설정을 확인해주세요." },
      400,
    );
  }
});
