import { SUI_CONFIG } from "./sui-config";

type SuiObjectOptions = {
  showType?: boolean;
  showOwner?: boolean;
  showContent?: boolean;
  showDisplay?: boolean;
};

type SuiObjectRequest = {
  id: string;
  options?: SuiObjectOptions;
};

type SuiObjectResponse = {
  data?: any;
  error?: any;
};

type FetchLike = typeof fetch;

const DEFAULT_OBJECT_READ_RETRY_DELAYS_MS = [750, 1500, 3000] as const;
const SUI_GET_OBJECT_METHOD = "sui_getObject";

export function resolveFetchImplementation(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) {
    return (input, init) => fetchImpl(input, init);
  }

  return (input, init) => globalThis.fetch(input, init);
}

export type SuiReadFailureKind =
  | "rate_limited"
  | "transport"
  | "unexpected";

export class SuiRpcReadError extends Error {
  kind: SuiReadFailureKind;
  status?: number;
  rpcCode?: number;
  rpcMessage?: string;
  cause?: unknown;

  constructor(
    message: string,
    options: {
      kind: SuiReadFailureKind;
      status?: number;
      rpcCode?: number;
      rpcMessage?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "SuiRpcReadError";
    this.kind = options.kind;
    this.status = options.status;
    this.rpcCode = options.rpcCode;
    this.rpcMessage = options.rpcMessage;
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

  if (status === 404 || status === 408 || status === 0) {
    return { kind: "transport", retryable: true, status };
  }

  if (/\b(429|503|502|504)\b|Too Many Requests/i.test(message)) {
    return { kind: "rate_limited", retryable: true, status };
  }

  if (
    /\b(404|408)\b|Failed to fetch|fetch failed|network|timeout|ECONNRESET|ETIMEDOUT/i.test(
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

function getConfiguredEndpoints() {
  const endpoints = [SUI_CONFIG.RPC_URL, SUI_CONFIG.RPC_FALLBACK_URL]
    .map((url) => url.trim())
    .filter((url, index, all) => url.length > 0 && all.indexOf(url) === index);
  return endpoints.length > 0
    ? endpoints
    : ["https://fullnode.mainnet.sui.io:443"];
}

export function buildSuiGetObjectJsonRpcBody(request: SuiObjectRequest) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: SUI_GET_OBJECT_METHOD,
    params: [
      request.id,
      {
        showType: true,
        showOwner: true,
        showContent: true,
        ...(request.options ?? {}),
      },
    ],
  };
}

async function readObjectViaJsonRpc(
  endpoint: string,
  request: SuiObjectRequest,
  options: {
    endpointIndex: number;
    operation: string;
    queueId?: string;
    fetchFn: FetchLike;
  },
): Promise<SuiObjectResponse> {
  const body = buildSuiGetObjectJsonRpcBody(request);
  const endpointCategory = endpointLabel(options.endpointIndex);
  const response = await options.fetchFn(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON responses are handled by status classification below.
  }

  if (!response.ok) {
    console.warn("[sui-rpc] object read http failure", {
      operation: options.operation,
      endpointCategory,
      httpMethod: "POST",
      jsonRpcMethod: SUI_GET_OBJECT_METHOD,
      objectId: request.id,
      status: response.status,
      rpcCode: json?.error?.code,
      rpcMessage: json?.error?.message,
      queueId: options.queueId,
    });
    throw new SuiRpcReadError("Sui JSON-RPC HTTP object read failed.", {
      kind:
        response.status === 429 || response.status === 503
          ? "rate_limited"
          : "transport",
      status: response.status,
      rpcCode: json?.error?.code,
      rpcMessage: json?.error?.message,
    });
  }

  if (json?.error) {
    console.warn("[sui-rpc] object read json-rpc failure", {
      operation: options.operation,
      endpointCategory,
      httpMethod: "POST",
      jsonRpcMethod: SUI_GET_OBJECT_METHOD,
      objectId: request.id,
      status: response.status,
      rpcCode: json.error.code,
      rpcMessage: json.error.message,
      queueId: options.queueId,
    });
    throw new SuiRpcReadError("Sui JSON-RPC object read failed.", {
      kind: "unexpected",
      status: response.status,
      rpcCode: json.error.code,
      rpcMessage: json.error.message,
    });
  }

  return json?.result;
}

async function readWithRetries(
  endpoint: string,
  request: SuiObjectRequest,
  options: {
    endpointIndex: number;
    operation: string;
    queueId?: string;
    retryDelaysMs: readonly number[];
    fetchFn: FetchLike;
  },
): Promise<SuiObjectResponse> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let lastError: unknown;
  let lastKind: SuiReadFailureKind = "unexpected";
  let lastStatus: number | undefined;
  let lastRpcCode: number | undefined;
  let lastRpcMessage: string | undefined;

  for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt += 1) {
    try {
      return await readObjectViaJsonRpc(endpoint, request, options);
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;
      lastRpcCode = error instanceof SuiRpcReadError ? error.rpcCode : undefined;
      lastRpcMessage =
        error instanceof SuiRpcReadError ? error.rpcMessage : undefined;

      console.warn("[sui-rpc] object read failed", {
        operation: options.operation,
        endpointCategory,
        httpMethod: "POST",
        jsonRpcMethod: SUI_GET_OBJECT_METHOD,
        objectId: request.id,
        status: classification.status,
        rpcCode: lastRpcCode,
        rpcMessage: lastRpcMessage,
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
      rpcCode: lastRpcCode,
      rpcMessage: lastRpcMessage,
      cause: lastError,
    },
  );
}

export async function readSuiObjectWithRetry(
  _primaryClient: unknown,
  request: SuiObjectRequest,
  options: {
    operation: string;
    queueId?: string;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
  },
): Promise<SuiObjectResponse> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_OBJECT_READ_RETRY_DELAYS_MS;
  const endpoints =
    options.endpoints?.filter(Boolean) ?? getConfiguredEndpoints();
  const fetchFn = resolveFetchImplementation(options.fetchImpl);

  let lastError: unknown;
  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return await readWithRetries(endpoints[index], request, {
        endpointIndex: index,
        operation: options.operation,
        queueId: options.queueId,
        retryDelaysMs,
        fetchFn,
      });
    } catch (error) {
      lastError = error;
      if (index < endpoints.length - 1) {
        const rpcError = error as Partial<SuiRpcReadError>;
        console.warn("[sui-rpc] switching endpoint after read failure", {
          operation: options.operation,
          endpointCategory: endpointLabel(index),
          nextEndpointCategory: endpointLabel(index + 1),
          status: rpcError.status,
          rpcCode: rpcError.rpcCode,
          rpcMessage: rpcError.rpcMessage,
          queueId: options.queueId,
        });
      }
    }
  }

  throw lastError;
}
