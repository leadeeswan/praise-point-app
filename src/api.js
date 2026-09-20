import { createClient } from "@supabase/supabase-js";
import { childEmail, positiveInteger, purchase } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = configured ? createClient(url, key) : null;
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const demoKey = "praise-garden-demo-v1";
export function freshDemo() {
  return {
    profile: { id: "parent", name: "우리 가족", role: "parent" },
    children: [
      { id: "child1", name: "지우", username: "jiwoo", age: 8, balance: 120 },
      { id: "child2", name: "하준", username: "hajun", age: 6, balance: 65 },
    ],
    products: [
      {
        id: "p1",
        name: "아이스크림 먹기",
        description: "좋아하는 맛으로 달콤한 시간",
        price: 50,
        emoji: "🍦",
        active: true,
      },
      {
        id: "p2",
        name: "주말 영화관 데이트",
        description: "팝콘과 함께 즐기는 가족 영화",
        price: 150,
        emoji: "🍿",
        active: true,
      },
      {
        id: "p3",
        name: "갖고 싶은 장난감",
        description: "차곡차곡 모아서 만나는 선물",
        price: 300,
        emoji: "🧸",
        active: true,
      },
      {
        id: "p4",
        name: "게임 시간 30분",
        description: "오늘은 조금 더 신나게 놀아요",
        price: 80,
        emoji: "🎮",
        active: true,
      },
    ],
    transactions: [
      {
        id: "t1",
        child_id: "child1",
        amount: 20,
        reason: "스스로 책상을 정리했어요",
        created_at: new Date().toISOString(),
      },
      {
        id: "t2",
        child_id: "child2",
        amount: 15,
        reason: "동생과 장난감을 나눴어요",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    orders: [],
  };
}
export function loadDemo() {
  try {
    return JSON.parse(localStorage.getItem(demoKey)) || freshDemo();
  } catch {
    return freshDemo();
  }
}
export function saveDemo(data) {
  localStorage.setItem(
    demoKey,
    JSON.stringify({
      ...data,
      profile: { id: "parent", name: "우리 가족", role: "parent" },
    }),
  );
}
export async function fetchFamily() {
  const user = check(await supabase.auth.getUser()).user;
  const profile = check(
    await supabase.from("profiles").select("*").eq("id", user.id).single(),
  );
  const [children, products, transactions, orders] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "child")
      .order("created_at"),
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return {
    profile,
    children: check(children),
    products: check(products),
    transactions: check(transactions),
    orders: check(orders),
  };
}
export async function authenticate(mode, fields) {
  if (mode === "signup") {
    if (fields.email.toLowerCase().endsWith("@children.praise.invalid"))
      throw new Error("부모님의 실제 이메일을 입력해주세요.");
    const data = check(
      await supabase.auth.signUp({
        email: fields.email,
        password: fields.password,
        options: {
          data: { name: fields.name },
          emailRedirectTo: location.origin + location.pathname,
        },
      }),
    );
    return Boolean(data.session);
  }
  check(
    await supabase.auth.signInWithPassword({
      email: mode === "child" ? childEmail(fields.username) : fields.email,
      password: fields.password,
    }),
  );
  return true;
}
export async function mutate(action, fields, data, demo) {
  if (action === "child") {
    childEmail(fields.username);
    if (!/^\d{6,12}$/.test(fields.password))
      throw new Error("인증번호는 숫자 6~12자리로 입력해주세요.");
    if (demo) {
      if (
        data.children.some(
          (c) => c.username === fields.username.trim().toLowerCase(),
        )
      )
        throw new Error("이미 사용 중인 아이디예요.");
      data.children.push({
        id: crypto.randomUUID(),
        name: fields.name,
        username: fields.username.trim().toLowerCase(),
        age: Number(fields.age),
        balance: 0,
      });
    } else {
      const { data: result, error } = await supabase.functions.invoke(
        "create-child",
        { body: fields },
      );
      if (error) {
        let message =
          "아이 등록에 실패했어요. 함수 배포와 아이디 중복 여부를 확인해주세요.";
        try {
          message = (await error.context.json()).error || message;
        } catch {}
        throw new Error(message);
      }
      if (result.error) throw new Error(result.error);
    }
  }
  if (action === "award") {
    const amount = positiveInteger(fields.amount);
    if (demo) {
      const c = data.children.find((c) => c.id === fields.child_id);
      if (!c) throw new Error("아이를 선택해주세요.");
      c.balance += amount;
      data.transactions.unshift({
        id: crypto.randomUUID(),
        child_id: c.id,
        amount,
        reason: fields.reason,
        created_at: new Date().toISOString(),
      });
    } else
      check(
        await supabase.rpc("award_points", {
          p_child: fields.child_id,
          p_amount: amount,
          p_reason: fields.reason,
        }),
      );
  }
  if (action === "product") {
    const product = {
      name: fields.name,
      description: fields.description,
      price: positiveInteger(fields.price),
      emoji: fields.emoji,
      active: true,
    };
    if (demo) data.products.push({ ...product, id: crypto.randomUUID() });
    else
      check(
        await supabase
          .from("products")
          .insert({ ...product, parent_id: data.profile.id }),
      );
  }
  if (action === "buy") {
    if (demo) {
      const c = data.children.find((c) => c.id === data.profile.id);
      const p = data.products.find((p) => p.id === fields.product_id);
      c.balance = purchase(c.balance, p.price);
      data.orders.unshift({
        id: crypto.randomUUID(),
        child_id: c.id,
        product_name: p.name,
        price: p.price,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      data.transactions.unshift({
        id: crypto.randomUUID(),
        child_id: c.id,
        amount: -p.price,
        reason: p.name + " 구매",
        created_at: new Date().toISOString(),
      });
    } else
      check(
        await supabase.rpc("buy_product", { p_product: fields.product_id }),
      );
  }
  if (action === "fulfill") {
    if (demo) data.orders.find((o) => o.id === fields.id).status = "fulfilled";
    else check(await supabase.rpc("fulfill_order", { p_order: fields.id }));
  }
  if (demo) {
    saveDemo(data);
    return data;
  }
  return fetchFamily();
}
