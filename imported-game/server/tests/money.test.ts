import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPayment, assertAmount, assertRoom, MAX_BALANCE } from "../src/util/money";
import { Bucket } from "../src/util/rateLimit";
import { GameError } from "../src/util/errors";

test("assertAmount rejects negative, fractional, NaN, huge and non-number values", () => {
  for (const bad of [0, -5, 1.5, NaN, Infinity, 1e12, "5", null, undefined]) {
    assert.throws(() => assertAmount(bad), GameError, String(bad));
  }
  assert.doesNotThrow(() => assertAmount(1));
  assert.doesNotThrow(() => assertAmount(100_000));
});

test("splitPayment pays cash first, then bank", () => {
  assert.deepEqual(splitPayment(500, 1000, 300), { money: 200, bankBalance: 1000 });
  assert.deepEqual(splitPayment(500, 1000, 800), { money: 0, bankBalance: 700 });
  assert.deepEqual(splitPayment(0, 50, 50), { money: 0, bankBalance: 0 });
});

test("splitPayment refuses when cash + bank is not enough", () => {
  assert.throws(() => splitPayment(10, 10, 21), GameError);
});

test("assertRoom blocks balances that would overflow the INTEGER column", () => {
  assert.doesNotThrow(() => assertRoom(MAX_BALANCE - 10, 10));
  assert.throws(() => assertRoom(MAX_BALANCE - 10, 11), GameError);
});

test("Bucket allows a burst then throttles", () => {
  const b = new Bucket(3, 0); // no refill
  assert.equal(b.take(), true);
  assert.equal(b.take(), true);
  assert.equal(b.take(), true);
  assert.equal(b.take(), false);
});
