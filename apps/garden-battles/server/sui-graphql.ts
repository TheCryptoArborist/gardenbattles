const DEFAULT_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";

const BATTLE_TRANSACTION_QUERY = `
  query BattleTransaction($digest: String!) {
    transaction(digest: $digest) {
      digest
      effects {
        timestamp
        status
        executionError { message }
        events(first: 50) {
          nodes {
            contents {
              type { repr }
              json
            }
          }
        }
      }
    }
  }
`;

type FetchLike = typeof fetch;

export interface VerifiedBattleTransaction {
  timestampMs?: number;
  effects?: {
    status?: { status: string; error?: string };
  };
  events?: Array<{
    type: string;
    parsedJson: unknown;
  }>;
}

export async function readBattleTransactionViaGraphQL(
  digest: string,
  options: {
    endpoint?: string;
    fetchFn?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<VerifiedBattleTransaction> {
  const response = await (options.fetchFn ?? fetch)(
    options.endpoint ?? process.env.SUI_GRAPHQL_URL ?? DEFAULT_SUI_GRAPHQL_URL,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: BATTLE_TRANSACTION_QUERY,
        variables: { digest },
      }),
      signal: options.signal,
    },
  );

  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.[0]?.message ||
        `Sui GraphQL transaction read returned ${response.status}.`,
    );
  }

  const transaction = payload.data?.transaction;
  if (!transaction) {
    throw new Error("Sui transaction was not found.");
  }

  const executionError = transaction.effects?.executionError?.message;
  const status = String(transaction.effects?.status ?? "").toLowerCase();
  const timestampMs = Date.parse(String(transaction.effects?.timestamp ?? ""));
  const events = transaction.effects?.events?.nodes ?? [];

  return {
    ...(Number.isFinite(timestampMs) ? { timestampMs } : {}),
    effects: {
      status: {
        status,
        ...(executionError ? { error: String(executionError) } : {}),
      },
    },
    events: events.flatMap((event: any) => {
      const type = event?.contents?.type?.repr;
      if (typeof type !== "string") return [];
      return [
        {
          type,
          parsedJson: event.contents?.json ?? {},
        },
      ];
    }),
  };
}
