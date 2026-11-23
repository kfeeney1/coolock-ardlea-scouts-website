import assert from "node:assert/strict";
import test from "node:test";
import { handleFinancialSummary, summarizeFinances } from "../src/financialSummary.js";

test("summary counts family revisions once and keeps credits separate from outstanding debt", () => {
  const period = "2026/27";
  const accounts = [
    { id: "old", period, amountDueCents: 10000 },
    { id: "new", period, amountDueCents: 14000, supersedesAccountId: "old" }
  ];
  const assignments = [
    { id: "family", memberId: "a", period, accountId: "new", amountDueCents: 10000 },
    { id: "individual", memberId: "b", period, amountDueCents: 1000 }
  ];
  const payments = [
    { accountId: "old", period, amountCents: 10000 },
    { accountId: "new", period, amountCents: -1000 },
    { memberId: "b", period, amountCents: 2000 }
  ];
  const transactions = [
    { section: "Cubs", type: "opening-float", amountCents: 5000 },
    { section: "Cubs", type: "expense", amountCents: 1000 },
    { section: "Scouts", type: "transfer-in", amountCents: 2000 }
  ];
  assert.deepEqual(summarizeFinances(period, assignments, accounts, payments, transactions), {
    period, collectedCents: 11000, outstandingCents: 5000,
    floats: [{ section: "Cubs", balanceCents: 4000 }, { section: "Scouts", balanceCents: 2000 }]
  });
});

test("an active Group Chairperson sees totals and an ordinary leader cannot run ledger queries", async () => {
  const string = stringValue => ({ stringValue });
  const token = `Bearer header.${btoa(JSON.stringify({ sub: "leader" })).replaceAll("=", "")}.signature`;
  let appointment = "Group Chairperson";
  let queries = 0;
  const load = () => handleFinancialSummary(new Request("https://worker.example/financial-summary", {
    method: "POST", headers: { Authorization: token }
  }), {
    base: "https://firestore.example/documents", origin: "https://site.example",
    serviceToken: async () => "service",
    fetcher: async (url, init) => {
      if (url.endsWith("/adminUsers/leader")) return Response.json({ fields: {
        active: { booleanValue: true }, role: string("leader"), sections: { arrayValue: { values: [string("Cubs")] } }
      } });
      if (url.endsWith("/organisationLeadership/leader")) return Response.json({ fields: {
        active: { booleanValue: true }, scoutingRole: string(appointment), organisationSection: string("Group")
      } });
      queries++;
      assert.equal(init.headers.Authorization, "Bearer service");
      const { structuredQuery } = JSON.parse(init.body);
      assert.ok(!structuredQuery.select.fields.some(({ fieldPath }) => ["memberName", "note"].includes(fieldPath)));
      return Response.json([]);
    }
  });
  const granted = await load();
  assert.equal(granted.status, 200);
  assert.deepEqual(Object.keys(await granted.json()), ["period", "collectedCents", "outstandingCents", "floats"]);
  appointment = "Scouter";
  assert.equal((await load()).status, 403);
  assert.equal(queries, 4);
});
