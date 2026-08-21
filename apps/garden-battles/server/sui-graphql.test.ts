import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readBattleTransactionViaGraphQL } from "./sui-graphql";

describe("readBattleTransactionViaGraphQL", () => {
  it("maps GraphQL effects and events to the leaderboard verifier shape", async () => {
    let requestBody: any;
    const transaction = await readBattleTransactionViaGraphQL("digest-1", {
      endpoint: "https://graphql.example/graphql",
      fetchFn: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          data: {
            transaction: {
              digest: "digest-1",
              effects: {
                status: "SUCCESS",
                executionError: null,
                events: {
                  nodes: [
                    {
                      contents: {
                        type: { repr: "0xpackage::battle::PvpBattleV3Update" },
                        json: {
                          battle_id: "0xbattle",
                          winner: "0xwinner",
                          target_growth: "75",
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        });
      },
    });

    assert.equal(requestBody.variables.digest, "digest-1");
    assert.ok(requestBody.query.includes("query BattleTransaction"));
    assert.equal(transaction.effects?.status?.status, "success");
    assert.deepEqual(transaction.events, [
      {
        type: "0xpackage::battle::PvpBattleV3Update",
        parsedJson: {
          battle_id: "0xbattle",
          winner: "0xwinner",
          target_growth: "75",
        },
      },
    ]);
  });

  it("rejects GraphQL transaction read failures", async () => {
    await assert.rejects(
      readBattleTransactionViaGraphQL("missing", {
        fetchFn: async () =>
          Response.json(
            { errors: [{ message: "transaction unavailable" }] },
            { status: 200 },
          ),
      }),
      /transaction unavailable/,
    );
  });
});
