import test from "node:test";
import assert from "node:assert/strict";
import {
  childEmail,
  positiveInteger,
  purchase,
  escapeHtml,
} from "../src/domain.js";
test("child login IDs normalize to a reserved email without accepting arbitrary addresses", () => {
  assert.equal(childEmail(" JIWOO_01 "), "jiwoo_01@children.praise.invalid");
  for (const id of [
    "a",
    "parent@example.com",
    "아이디",
    "abc.def",
    "a".repeat(21),
  ])
    assert.throws(() => childEmail(id));
});
test("points reject negative, decimal, zero and unbounded input", () => {
  assert.equal(positiveInteger("30"), 30);
  for (const value of [0, -10, 1.5, NaN, Infinity, "", 100001])
    assert.throws(() => positiveInteger(value));
});
test("purchase allows exact balance and never overspends", () => {
  assert.equal(purchase(50, 50), 0);
  assert.equal(purchase(120, 50), 70);
  assert.throws(() => purchase(49, 50));
  assert.throws(() => purchase(100, -50));
});
test("user-provided display values cannot inject HTML", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});
