// Run with: pnpm test:unit  (node's built-in runner + type stripping — no extra dependency)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeShareholderLoanDelta,
  deriveCashDirection,
  describeTransactionType,
  scrubTaxFields,
  shapeFromFields,
  toStorageFields,
  type Side,
} from "./transactionFields.ts";

const SIDES: Side[] = ["personal", "business"];

// Pins every realm × account case for both tax kinds against the equivalent income/expense
// shape. tax_payment must equal expense(realm, account); tax_refund must equal income —
// the old binary `kind === "expense" ? … : …` ternary silently gave payments the income sign.
test("tax_payment loan delta matches expense, tax_refund matches income", () => {
  for (const realm of SIDES) {
    for (const account of SIDES) {
      assert.equal(
        computeShareholderLoanDelta({ kind: "tax_payment", realm, account }, 100),
        computeShareholderLoanDelta({ kind: "expense", realm, account }, 100),
        `tax_payment ${realm}/${account}`
      );
      assert.equal(
        computeShareholderLoanDelta({ kind: "tax_refund", realm, account }, 100),
        computeShareholderLoanDelta({ kind: "income", realm, account }, 100),
        `tax_refund ${realm}/${account}`
      );
    }
  }
});

test("tax delta signs (explicit)", () => {
  const d = (kind: "tax_payment" | "tax_refund", realm: Side, account: Side) =>
    computeShareholderLoanDelta({ kind, realm, account }, 100);
  assert.equal(d("tax_payment", "business", "business"), 0);
  assert.equal(d("tax_payment", "personal", "personal"), 0);
  // Corporate tax paid from the owner's pocket: the corp owes the owner.
  assert.equal(d("tax_payment", "business", "personal"), 100);
  // Personal tax paid from the corp's account: the owner owes the corp.
  assert.equal(d("tax_payment", "personal", "business"), -100);
  // Refunds reverse that.
  assert.equal(d("tax_refund", "business", "personal"), -100);
  assert.equal(d("tax_refund", "personal", "business"), 100);
});

test("account defaults to realm (no loan effect)", () => {
  assert.equal(computeShareholderLoanDelta({ kind: "tax_payment", realm: "business" }, 50), 0);
});

test("cash direction follows where the cash originates", () => {
  assert.equal(deriveCashDirection({ kind: "tax_payment", realm: "business", account: "personal" }), "you-to-corp");
  assert.equal(deriveCashDirection({ kind: "tax_payment", realm: "personal", account: "business" }), "corp-to-you");
  assert.equal(deriveCashDirection({ kind: "tax_refund", realm: "business", account: "personal" }), "corp-to-you");
  assert.equal(deriveCashDirection({ kind: "tax_refund", realm: "personal", account: "business" }), "you-to-corp");
});

test("rental realm is rejected for tax", () => {
  assert.throws(() => shapeFromFields({ kind: "tax_payment", realm: "rental" }), /rental/);
  assert.throws(() => shapeFromFields({ kind: "tax_refund", realm: "rental" }), /rental/);
});

test("shapeFromFields / toStorageFields round-trip a tax shape", () => {
  const shape = shapeFromFields({ kind: "tax_refund", realm: "personal", account: "business" });
  assert.deepEqual(toStorageFields(shape), {
    kind: "tax_refund",
    realm: "personal",
    account: "business",
    from: undefined,
    to: undefined,
    purpose: undefined,
  });
});

test("labels", () => {
  assert.equal(describeTransactionType({ kind: "tax_payment", realm: "business", account: "personal" }), "Business Tax Payment (Personal Pay)");
  assert.equal(describeTransactionType({ kind: "tax_refund", realm: "personal", account: "business" }), "Personal Tax Refund (via Business)");
  assert.equal(describeTransactionType({ kind: "tax_payment", realm: "personal" }), "Personal Tax Payment");
});

test("scrubTaxFields clears category/property and defaults taxYear for tax", () => {
  const shape = shapeFromFields({ kind: "tax_payment", realm: "business" });
  assert.deepEqual(scrubTaxFields(shape, { categoryId: "c", propertyId: "p", date: "2026-04-15" }), {
    categoryId: undefined,
    propertyId: undefined,
    taxYear: 2026,
  });
  assert.equal(scrubTaxFields(shape, { categoryId: "c", propertyId: "p", date: "2026-04-15", taxYear: 2025 }).taxYear, 2025);
  assert.throws(() => scrubTaxFields(shape, { categoryId: "c", propertyId: "p", date: "2026-04-15", taxYear: 25 }));
});

test("scrubTaxFields leaves non-tax rows alone and drops taxYear", () => {
  const shape = shapeFromFields({ kind: "expense", realm: "business" });
  assert.deepEqual(scrubTaxFields(shape, { categoryId: "c", propertyId: "p", date: "2026-04-15", taxYear: 2025 }), {
    categoryId: "c",
    propertyId: "p",
    taxYear: undefined,
  });
});
