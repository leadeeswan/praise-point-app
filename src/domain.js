export function childEmail(username) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{4,20}$/.test(normalized))
    throw new Error("아이디는 영문 소문자, 숫자, 밑줄로 4~20자 입력해주세요.");
  return `${normalized}@children.praise.invalid`;
}
export function positiveInteger(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000)
    throw new Error("포인트는 1~100,000 사이의 정수로 입력해주세요.");
  return n;
}
export function purchase(balance, price) {
  positiveInteger(price);
  if (balance < price)
    throw new Error("포인트가 조금 부족해요. 착한 일을 더 모아볼까요?");
  return balance - price;
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
