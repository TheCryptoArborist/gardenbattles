import { SuiClient } from "@mysten/sui/client";
import { SUI_CONFIG } from "./sui-config";

type SuiObjectRequest = Parameters<SuiClient["getObject"]>[0];
type SuiObjectResponse = Awaited<ReturnType<SuiClient["getObject"]>>;
type SuiObjectClient = Pick<SuiClient, "getObject">;

const DEFAULT_OBJECT_READ_RETRY_DELAYS_MS = [750, 1500, 3000] as const;

export type SuiReadFailureKind =
  | "rate_limited"
  | "transport"
  | "unexpected";

export class SuiRpcReadError extends Error {
  kind: SuiReadFailureKind;
  status?: number;
  cause?: unknown;

  constructor(
    message: string,
    options: { kind: SuiReadFailureKind; status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "SuiRpcReadError";
    this.kind = options.kind;
    this.status = options.status;
    this.cause = options.cause;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStatus(error: any): number | undefined {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
    error?.cause?.statusCode,
  ];
  const found = candidates.find((status) => Number.isFinite(Number(status)));
  return found === undefined ? undefined : Number(found);
}

export function classifySuiRpcReadError(error: unknown): {
  kind: SuiReadFailureKind;
  retryable: boolean;
  status?: number;
} {
  const status = readStatus(error);
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return { kind: "rate_limited", retryable: true, status };
  }

  if (/\b(429|503|502|504)\b|Too Many Requests/i.test(message)) {
    return { kind: "rate_limited", retryable: true, status };
  }

  if (
    /Failed to fetch|fetch failed|network|timeout|ECONNRESET|ETIMEDOUT/i.test(
      message,
    )
  ) {
    return { kind: "transport", retryable: true, status };
  }

  return { kind: "unexpected", retryable: false, status };
}

function endpointLabel(index: number) {
  return index === 0 ? "primary" : "fallback";
}

async function readWithRetries(
  client: SuiObjectClient,
  request: SuiObjectRequest,
  options: {
    endpointIndex: number;
    operation: string;
    queueId?: string;
    retryDelaysMs: readonly number[];
  },
): Promise<SuiObjectResponse> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let lastError: unknown;
  let lastKind: SuiReadFailureKind = "unexpected";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt += 1) {
    try {
      return await client.getObject(request);
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;

      console.warn("[sui-rpc] object read failed", {
        operation: options.operation,
        endpointCategory,
        status: classification.status,
        retry: attempt,
        queueId: options.queueId,
      });

      const shouldRetry =
        classification.retryable && attempt < options.retryDelaysMs.length;
      if (!shouldRetry) break;
      await sleep(options.retryDelaysMs[attempt]);
    }
  }

  throw new SuiRpcReadError(
    lastKind === "rate_limited"
      ? "Sui RPC object read was rate-limited after retries."
      : "Sui RPC object read failed after retries.",
    {
      kind: lastKind,
      status: lastStatus,
      cause: lastError,
    },
  );
}

export function getConfiguredSuiFallbackClient(): SuiClient | null {
  const fallbackUrl = SUI_CONFIG.RPC_FALLBACK_URL.trim();
  if (!fallbackUrl || fallbackUrl === SUI_CONFIG.RPC_URL) return null;
  return new SuiClient({ url: fallbackUrl });
}

export async function readSuiObjectWithRetry(
  primaryClient: SuiObjectClient,
  request: SuiObjectRequest,
  options: {
    operation: string;
    queueId?: string;
    fallbackClient?: SuiObjectClient | null;
    retryDelaysMs?: readonly number[];
  },
): Promise<SuiObjectResponse> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_OBJECT_READ_RETRY_DELAYS_MS;
  const clients = [
    primaryClient,
    options.fallbackClient ?? getConfiguredSuiFallbackClient(),
  ].filter((client): client is SuiObjectClient => !!client);

  let lastError: unknown;
  for (let index = 0; index < clients.length; index += 1) {
    try {
      return await readWithRetries(clients[index], request, {
        endpointIndex: index,
        operation: options.operation,
        queueId: options.queueId,
        retryDelaysMs,
      });
    } catch (error) {
      lastError = error;
      if (index < clients.length - 1) {
        const rpcError = error as Partial<SuiRpcReadError>;
        console.warn("[sui-rpc] switching endpoint after read failure", {
          operation: options.operation,
          endpointCategory: endpointLabel(index),
          nextEndpointCategory: endpointLabel(index + 1),
          status: rpcError.status,
          queueId: options.queueId,
        });
      }
    }
  }

  throw lastError;
}
