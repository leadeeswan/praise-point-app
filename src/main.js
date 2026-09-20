import {
  createIcons,
  Sprout,
  Heart,
  Smile,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Users,
  Gift,
  History,
  ShoppingBag,
  Flower2,
  LogOut,
  Repeat2,
  Plus,
  ArrowUpRight,
  Coins,
  X,
} from "lucide";
const icons = {
  Sprout,
  Heart,
  Smile,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Users,
  Gift,
  History,
  ShoppingBag,
  Flower2,
  LogOut,
  Repeat2,
  Plus,
  ArrowUpRight,
  Coins,
  X,
};
import {
  configured,
  supabase,
  loadDemo,
  fetchFamily,
  authenticate,
  mutate,
} from "./api";
import { escapeHtml as e } from "./domain";
import "./style.css";
const app = document.querySelector("#app");
let state = {
  data: null,
  demo: false,
  page: "home",
  auth: "parent",
  modal: null,
  busy: false,
};
const icon = (name, size = 20) =>
  `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
const fmt = (n) => Number(n).toLocaleString("ko-KR");
const date = (s) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
const isParent = () => state.data?.profile.role === "parent";
const visibleRecords = (list) =>
  isParent()
    ? list
    : list.filter((row) => row.child_id === state.data.profile.id);
const childName = (id) =>
  state.data.children.find((c) => c.id === id)?.name || "아이";
function toast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast" + (error ? " error" : "");
  node.setAttribute("role", error ? "alert" : "status");
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 5000);
}
function paint() {
  app.innerHTML = state.data ? dashboard() : login();
  if (state.modal) app.insertAdjacentHTML("beforeend", modal());
  createIcons({ icons });
  document.querySelector("dialog")?.showModal();
  document.querySelector("dialog input")?.focus();
}
function login() {
  return `<main class="login-layout"><section class="login-story"><a class="brand" href="#">${icon("sprout", 28)} 칭찬정원<span>GROW WITH LOVE</span></a><div class="story-body"><span class="eyebrow">우리 가족의 작은 성장 기록</span><h1>작은 착한 일이<br>커다란 기쁨으로.</h1><p>따뜻한 칭찬을 모으고, 기다리던 선물을 만나요.<br>아이의 좋은 습관이 자라는 우리 가족만의 정원.</p><div class="garden-art" aria-hidden="true"><div class="sun">✳</div><div class="plant p-one">🌷</div><div class="plant p-two">🌻</div><div class="plant p-three">🌱</div><span class="art-tag">✨ 오늘도 한 뼘 자랐어요</span></div><div class="story-steps"><span>01 <b>착한 일 하기</b></span><span>02 <b>칭찬 모으기</b></span><span>03 <b>선물 만나기</b></span></div></div><small>매일의 칭찬이, 아이의 내일을 바꿔요.</small></section><section class="login-panel"><div class="login-box"><span class="eyebrow">WELCOME TO OUR GARDEN</span><h2>${state.auth === "signup" ? "우리 가족 정원 만들기" : "칭찬정원에 오신 걸 환영해요"}</h2><p class="muted">${state.auth === "signup" ? "부모님 계정으로 시작해보세요." : "오늘은 어떤 멋진 일이 기다리고 있을까요?"}</p><div class="segmented"><button data-auth="parent" class="${state.auth !== "child" ? "selected" : ""}">${icon("heart")} 부모님</button><button data-auth="child" class="${state.auth === "child" ? "selected" : ""}">${icon("smile")} 어린이</button></div><form data-form="auth">${state.auth === "signup" ? field("name", "부모님 이름", "text", "예: 지우 엄마", 'required maxlength="30"') : ""}${state.auth === "child" ? field("username", "내 아이디", "text", "부모님이 만들어주신 아이디", 'required minlength="4" maxlength="20" autocapitalize="none" autocomplete="username"') : field("email", "이메일", "email", "hello@example.com", 'required autocomplete="email"')}${field("password", state.auth === "child" ? "인증번호" : "비밀번호", "password", state.auth === "child" ? "숫자 6~12자리" : "비밀번호를 입력해주세요", `required minlength="${state.auth === "child" ? 6 : 8}" autocomplete="${state.auth === "signup" ? "new-password" : "current-password"}" ${state.auth === "child" ? 'inputmode="numeric" pattern="[0-9]{6,12}"' : ""}`)}<button class="primary full" ${!configured ? "disabled" : ""}>${state.auth === "signup" ? "가입하기" : "로그인"} ${icon("arrow-right", 18)}</button></form>${state.auth !== "child" ? `<p class="switch-auth">${state.auth === "signup" ? "이미 계정이 있나요?" : "처음 오셨나요?"} <button class="text-btn" data-auth="${state.auth === "signup" ? "parent" : "signup"}">${state.auth === "signup" ? "로그인" : "부모님 회원가입"}</button></p>` : '<p class="switch-auth">아이디와 인증번호는 부모님께 물어보세요.</p>'}<div class="demo-section"><span>먼저 둘러보고 싶다면</span><button class="secondary full" data-action="demo">${icon("sparkles")} 체험 정원 둘러보기</button><small>${configured ? "체험 데이터는 실제 계정과 별도로 저장됩니다." : "Supabase 연결 전입니다. 체험 모드로 모든 흐름을 살펴보세요."}</small></div></div></section></main>`;
}
function field(name, label, type, placeholder, attrs = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" placeholder="${placeholder}" ${attrs}></label>`;
}
function dashboard() {
  const d = state.data,
    parent = isParent();
  const items = [
    ["home", "layout-dashboard", "우리 집 정원"],
    ["children", "users", "아이들 관리"],
    ["shop", "gift", "선물 가게"],
    ["history", "history", "칭찬 기록"],
    ["orders", "shopping-bag", "구매 내역"],
  ].filter((x) => parent || x[0] !== "children");
  return `<div class="shell"><aside class="sidebar"><a class="brand" href="#">${icon("sprout", 28)} 칭찬정원<span>GROW WITH LOVE</span></a><div class="family-label">OUR FAMILY SPACE</div><nav>${items.map(([id, ic, label]) => `<button data-page="${id}" class="nav-item ${state.page === id ? "active" : ""}">${icon(ic)} ${label}${id === "shop" ? '<span class="nav-dot"></span>' : ""}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="gentle-note">${icon("flower-2", 28)}<b>칭찬 한마디의 힘</b><p>작은 노력도 발견해주세요.<br>아이의 마음이 쑥쑥 자라요.</p></div><button class="logout" data-action="logout">${icon("log-out", 18)} 로그아웃</button></div></aside><div class="main-wrap"><header class="topbar"><span>우리 가족 <span class="slash">/</span> ${items.find((x) => x[0] === state.page)?.[2] || "우리 집 정원"}</span><div class="top-right">${state.demo ? `<span class="demo-badge">체험 모드</span><button class="role-switch" data-action="switch">${icon("repeat-2", 16)} ${parent ? "아이로 보기" : "부모로 보기"}</button>` : ""}<span class="avatar mini">${parent ? "🌿" : "🌼"}</span><b>${e(d.profile.name)}</b><span class="role-label">${parent ? "부모님" : "어린이"}</span></div></header><main class="content">${state.demo ? '<div class="demo-notice">체험용 정원이에요. 변경 내용은 이 브라우저에만 저장되며 실제 아이 계정은 생성되지 않습니다.</div>' : ""}${state.page === "home" ? home() : state.page === "children" ? childrenPage() : state.page === "shop" ? shopPage() : state.page === "history" ? historyPage() : ordersPage()}<footer>칭찬으로 자라는 우리 가족의 하루 <span>🌱 칭찬정원</span></footer></main></div></div>`;
}
function heading(kicker, title, subtitle, button = "") {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p class="muted">${subtitle}</p></div>${button}</div>`;
}
function home() {
  const d = {
      ...state.data,
      transactions: visibleRecords(state.data.transactions),
      orders: visibleRecords(state.data.orders),
    },
    parent = isParent(),
    children = d.children;
  const total = children.reduce((s, c) => s + c.balance, 0);
  return `${heading("A LITTLE GOOD, EVERY DAY", parent ? "오늘도, 칭찬으로 시작해요 👋" : `${e(d.profile.name)}의 착한 일이 자라고 있어요 🌱`, parent ? "아이들의 작은 실천에 따뜻한 마음을 더해주세요." : "차곡차곡 포인트를 모아 좋아하는 선물을 만나보세요.", parent ? '<button class="primary" data-modal="award">' + icon("plus", 18) + " 칭찬포인트 주기</button>" : "")}<section class="hero"><div><span class="hero-pill">${icon("sparkles", 15)} ${parent ? "함께 자라는 우리 가족" : "내가 키우는 칭찬정원"}</span><h2>칭찬을 심으면,<br>좋은 습관이 자라나요.</h2><p>오늘의 작은 착한 일, 잊지 말고 칭찬해주세요.</p><button class="hero-link" data-page="${parent ? "history" : "shop"}">${parent ? "우리 가족의 칭찬 이야기" : "내가 만날 수 있는 선물"} ${icon("arrow-up-right", 17)}</button></div><div class="hero-garden" aria-hidden="true"><span class="float-label">+ 칭찬 한 스푼</span><span class="flower">🌻</span><span class="tulip">🌷</span><span class="sprout">🌱</span><div class="ground"></div><span class="star one">✧</span><span class="star two">✳</span></div></section><section class="stats"><article><div class="stat-icon peach">${icon("coins", 23)}</div><div><span>${parent ? "우리 가족이 모은 포인트" : "내가 모은 포인트"}</span><strong>${fmt(total)} <small>P</small></strong></div></article><article><div class="stat-icon green">${icon("heart", 23)}</div><div><span>최근 칭찬 횟수</span><strong>${d.transactions.filter((t) => t.amount > 0).length} <small>번</small></strong></div></article><article><div class="stat-icon lavender">${icon("gift", 23)}</div><div><span>기다리는 선물</span><strong>${d.orders.filter((o) => o.status === "pending").length} <small>개</small></strong></div></article></section><section class="section"><div class="section-title"><h2>${parent ? "우리 집 작은 새싹들" : "나의 포인트 통장"} <span>${children.length}</span></h2>${parent ? '<button class="text-btn" data-modal="child">' + icon("plus", 15) + " 아이 등록하기</button>" : ""}</div><div class="children-grid">${children.length ? children.map(childCard).join("") : empty("아직 등록된 아이가 없어요", "아이를 등록하고 첫 칭찬을 건네보세요.", "child", "첫 아이 등록하기")}</div></section><section class="section"><div class="section-title"><h2>두근두근, 선물 가게 <span>🎁</span></h2><button class="text-btn muted" data-page="shop">모두 보기 ${icon("arrow-right", 15)}</button></div><div class="product-grid">${d.products.length ? d.products.slice(0, 4).map(productCard).join("") : empty("첫 선물을 준비해주세요", "아이가 좋아하는 간식이나 함께하는 시간도 좋아요.", parent ? "product" : null, "선물 등록하기")}</div></section><section class="section record-section"><div class="section-title"><h2>차곡차곡 칭찬 기록</h2><button class="text-btn muted" data-page="history">모두 보기 ${icon("arrow-right", 15)}</button></div>${historyList(d.transactions.slice(0, 4))}</section>`;
}
function childCard(c, i) {
  return `<article class="child-card"><div class="child-top"><span class="avatar ${i % 2 ? "pink" : ""}">${i % 2 ? "🐰" : "🐻"}</span><div><h3>${e(c.name)} <span>${c.age}살</span></h3><small>@${e(c.username)}</small></div><span class="seed-badge">${c.balance >= 100 ? "🌳 무럭무럭" : "🌱 새싹"}</span></div><div class="child-balance"><span>모은 칭찬포인트</span><strong>${fmt(c.balance)} <small>P</small></strong></div>${isParent() ? `<button class="award-btn" data-modal="award" data-child="${c.id}">${icon("plus", 16)} 칭찬해주기</button>` : '<button class="award-btn" data-page="shop">' + icon("gift", 16) + " 선물 고르기</button>"}</article>`;
}
function productCard(p, i) {
  const c = state.data.children.find((c) => c.id === state.data.profile.id);
  return `<article class="product-card"><div class="product-art color-${i % 4}"><span>${e(p.emoji)}</span><span class="product-sticker">작은 행복</span></div><div class="product-info"><h3>${e(p.name)}</h3><p>${e(p.description)}</p><div class="product-bottom"><strong>${fmt(p.price)} <small>P</small></strong>${!isParent() ? `<button class="small-buy" data-buy="${p.id}" ${c?.balance < p.price ? "disabled" : ""}>${c?.balance < p.price ? "모으는 중" : "구매하기"}</button>` : '<span class="muted">칭찬으로 만나요</span>'}</div></div></article>`;
}
function childrenPage() {
  return (
    heading(
      "LITTLE GROWERS",
      "우리 집 아이들",
      "아이의 계정을 만들고 성장을 함께 지켜봐요.",
      '<button class="primary" data-modal="child">' +
        icon("plus", 18) +
        " 아이 등록하기</button>",
    ) +
    `<div class="children-grid">${state.data.children.length ? state.data.children.map(childCard).join("") : empty("첫 번째 새싹을 심어볼까요?", "아이디, 이름, 나이, 인증번호로 아이를 등록해주세요.", "child", "아이 등록하기")}</div>`
  );
}
function shopPage() {
  return (
    heading(
      "THE GIFT OF GOOD HABITS",
      "두근두근, 선물 가게",
      "착한 일을 모아서 만나는 특별한 선물들.",
      isParent()
        ? '<button class="primary" data-modal="product">' +
            icon("plus", 18) +
            " 선물 등록하기</button>"
        : "",
    ) +
    `<div class="product-grid">${state.data.products.length ? state.data.products.map(productCard).join("") : empty("선물을 준비하고 있어요", "부모님이 우리 가족만의 선물을 등록할 수 있어요.", isParent() ? "product" : null, "선물 등록하기")}</div>`
  );
}
function historyPage() {
  return (
    heading(
      "MOMENTS THAT MATTER",
      "차곡차곡 칭찬 기록",
      "포인트를 받은 순간부터 선물을 만난 순간까지. 최근 100건을 보여드려요.",
    ) + historyList(visibleRecords(state.data.transactions))
  );
}
function historyList(list) {
  return `<div class="history-list">${list.length ? list.map((t) => `<article class="history-row"><span class="history-icon ${t.amount < 0 ? "spent" : ""}">${icon(t.amount > 0 ? "heart" : "gift", 18)}</span><div><h3>${e(t.reason)}</h3><small>${e(childName(t.child_id))} <span>·</span> ${date(t.created_at)}</small></div><strong class="${t.amount < 0 ? "negative" : ""}">${t.amount > 0 ? "+" : ""}${fmt(t.amount)} P</strong></article>`).join("") : empty("아직 기록이 없어요", "첫 번째 칭찬의 순간을 기다리고 있어요.")}</div>`;
}
function ordersPage() {
  return (
    heading(
      "HAPPINESS ON ITS WAY",
      "우리 가족 구매 내역",
      "구매하면 포인트가 바로 차감돼요. 선물을 전달한 뒤 완료로 표시해주세요.",
    ) +
    `<div class="history-list">${
      visibleRecords(state.data.orders).length
        ? visibleRecords(state.data.orders)
            .map(
              (o) =>
                `<article class="history-row"><span class="history-icon spent">${icon("gift")}</span><div><h3>${e(o.product_name)}</h3><small>${e(childName(o.child_id))} · ${fmt(o.price)} P · ${date(o.created_at)}</small></div>${o.status === "pending" && isParent() ? `<button class="secondary" data-fulfill="${o.id}">전달 완료</button>` : `<span class="order-status">${o.status === "pending" ? "선물 기다리는 중" : "전달 완료 ✓"}</span>`}</article>`,
            )
            .join("")
        : empty(
            "아직 구매한 선물이 없어요",
            "선물 가게에서 마음에 드는 선물을 찾아보세요.",
          )
    }</div>`
  );
}
function empty(title, description, action, label) {
  return `<div class="empty">${icon("sprout", 34)}<h3>${title}</h3><p>${description}</p>${action ? `<button class="secondary" data-modal="${action}">${label}</button>` : ""}</div>`;
}
function modal() {
  const { type, child, product } = state.modal;
  const titles = {
    child: [
      "새로운 새싹 등록하기",
      "아이만의 아이디와 인증번호를 만들어주세요.",
    ],
    award: ["참 잘했어요!", "어떤 착한 일을 했나요? 마음을 담아 칭찬해주세요."],
    product: [
      "기대되는 선물 등록하기",
      "아이와 함께 목표로 삼을 선물을 정해보세요.",
    ],
    buy: ["이 선물을 구매할까요?", "구매하면 포인트가 즉시 차감됩니다."],
  };
  let body = "";
  if (type === "child")
    body =
      field("name", "이름", "text", "아이의 이름", 'required maxlength="30"') +
      field(
        "username",
        "아이디",
        "text",
        "영문 소문자, 숫자, 밑줄 4~20자",
        'required pattern="[a-z0-9_]{4,20}" autocomplete="off"',
      ) +
      field("age", "나이", "number", "예: 8", 'required min="1" max="19"') +
      field(
        "password",
        "인증번호",
        "password",
        "숫자 6~12자리",
        'required inputmode="numeric" pattern="[0-9]{6,12}" autocomplete="new-password"',
      ) +
      '<p class="form-hint">아이디는 전체 서비스에서 중복될 수 없어요. 인증번호는 안전하게 암호화되며 다시 확인할 수 없으니 아이에게 알려주세요.</p>';
  if (type === "award")
    body =
      `<label class="field">칭찬할 아이<select name="child_id" required><option value="">아이를 선택해주세요</option>${state.data.children.map((c) => `<option value="${c.id}" ${child === c.id ? "selected" : ""}>${e(c.name)}</option>`).join("")}</select></label>` +
      field(
        "reason",
        "칭찬 한마디",
        "text",
        "예: 스스로 장난감을 정리했어요",
        'required maxlength="200"',
      ) +
      field(
        "amount",
        "칭찬포인트",
        "number",
        "예: 10",
        'required min="1" max="100000" step="1"',
      ) +
      '<div class="point-presets">' +
      [10, 20, 30, 50]
        .map((n) => `<button type="button" data-preset="${n}">+${n} P</button>`)
        .join("") +
      "</div>";
  if (type === "product")
    body =
      field(
        "name",
        "선물 이름",
        "text",
        "예: 아이스크림 먹기",
        'required maxlength="60"',
      ) +
      field(
        "description",
        "선물 설명",
        "text",
        "아이에게 전하는 짧은 설명",
        'maxlength="150"',
      ) +
      `<label class="field">선물 아이콘<select name="emoji">${["🎁", "🍦", "🍿", "🧸", "🎮", "📚", "🎨", "🚲", "🍕", "🎡"].map((x) => `<option>${x}</option>`).join("")}</select></label>` +
      field(
        "price",
        "필요한 포인트",
        "number",
        "예: 50",
        'required min="1" max="100000" step="1"',
      );
  if (type === "buy")
    body = `<div class="purchase-preview"><span>${e(product.emoji)}</span><h3>${e(product.name)}</h3><strong>${fmt(product.price)} P</strong></div><input type="hidden" name="product_id" value="${product.id}">`;
  return `<dialog aria-labelledby="modal-title"><div class="dialog-head"><div><h2 id="modal-title">${titles[type][0]}</h2><p>${titles[type][1]}</p></div><button class="icon-btn" data-action="close" aria-label="닫기">${icon("x")}</button></div><form data-form="${type}">${body}<div class="dialog-actions"><button type="button" class="secondary" data-action="close">취소</button><button class="primary">${type === "buy" ? "구매하기" : type === "award" ? "칭찬 보내기" : "등록하기"}</button></div></form></dialog>`;
}
async function enter(demo) {
  state.demo = demo;
  state.data = demo ? loadDemo() : await fetchFamily();
  state.page = "home";
  paint();
}
app.addEventListener("click", async (event) => {
  const el = event.target.closest("button");
  if (!el || state.busy) return;
  try {
    if (el.dataset.auth) {
      state.auth = el.dataset.auth;
      paint();
    }
    if (el.dataset.page) {
      state.page = el.dataset.page;
      paint();
    }
    if (el.dataset.modal) {
      state.modal = { type: el.dataset.modal, child: el.dataset.child };
      paint();
    }
    if (el.dataset.preset)
      document.querySelector('[name="amount"]').value = el.dataset.preset;
    if (el.dataset.buy) {
      state.modal = {
        type: "buy",
        product: state.data.products.find((p) => p.id === el.dataset.buy),
      };
      paint();
    }
    if (el.dataset.fulfill) {
      state.busy = true;
      el.disabled = true;
      state.data = await mutate(
        "fulfill",
        { id: el.dataset.fulfill },
        state.data,
        state.demo,
      );
      paint();
      toast("선물을 전달했어요!");
    }
    if (el.dataset.action === "demo") await enter(true);
    if (el.dataset.action === "close") {
      state.modal = null;
      paint();
    }
    if (el.dataset.action === "logout") {
      if (!state.demo) await supabase.auth.signOut();
      state.data = null;
      state.modal = null;
      paint();
    }
    if (el.dataset.action === "switch") {
      if (isParent()) {
        const c = state.data.children[0];
        if (!c) throw new Error("아이를 먼저 등록해주세요.");
        state.data.profile = { ...c, role: "child" };
        state.demoAllChildren = state.data.children;
        state.data.children = [c];
      } else {
        state.data = loadDemo();
      }
      state.page = "home";
      paint();
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    state.busy = false;
    el.disabled = false;
  }
});
app.addEventListener(
  "cancel",
  () => {
    state.modal = null;
  },
  true,
);
app.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  const form = event.target,
    kind = form.dataset.form;
  const fields = Object.fromEntries(new FormData(form));
  const button = form.querySelector("button.primary");
  state.busy = true;
  button.disabled = true;
  button.textContent = "잠시만 기다려주세요…";
  try {
    if (kind === "auth") {
      const loggedIn = await authenticate(state.auth, fields);
      if (loggedIn) await enter(false);
      else {
        state.auth = "parent";
        paint();
        toast("이메일로 보내드린 가입 확인 링크를 눌러주세요.");
      }
    } else {
      if (state.demo && !isParent() && state.demoAllChildren) {
        const c = state.data.children[0];
        state.data.children = state.demoAllChildren.map((x) =>
          x.id === c.id ? c : x,
        );
      }
      state.data = await mutate(kind, fields, state.data, state.demo);
      if (state.demo && !isParent()) {
        state.demoAllChildren = state.data.children;
        state.data.children = state.data.children.filter(
          (c) => c.id === state.data.profile.id,
        );
      }
      state.modal = null;
      paint();
      toast(
        {
          child: "아이를 등록했어요. 🌱",
          award: "따뜻한 칭찬을 보냈어요! ✨",
          product: "새로운 선물이 준비됐어요! 🎁",
          buy: "구매했어요! 부모님께 선물을 요청해주세요. 🎉",
        }[kind],
      );
    }
  } catch (err) {
    if (state.demo && !isParent()) {
      state.demoAllChildren = state.data.children;
      state.data.children = state.data.children.filter(
        (c) => c.id === state.data.profile.id,
      );
    }
    toast(
      err.message === "Invalid login credentials"
        ? "로그인 정보가 맞지 않아요. 다시 확인해주세요."
        : err.message,
      true,
    );
    button.disabled = false;
    button.textContent = kind === "auth" ? "다시 시도" : "다시 시도";
  } finally {
    state.busy = false;
  }
});
paint();
if (supabase) {
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session)
      try {
        await enter(false);
      } catch (err) {
        toast(
          "계정 정보를 불러오지 못했어요. DB 설정을 확인해주세요: " +
            err.message,
          true,
        );
      }
  });
}
