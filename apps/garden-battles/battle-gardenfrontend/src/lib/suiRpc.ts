type SuiObjectOptions = {
  showType?: boolean;
  showOwner?: boolean;
  showContent?: boolean;
  showDisplay?: boolean;
  showPreviousTransaction?: boolean;
};

type SuiObjectRequest = {
  id: string;
  options?: SuiObjectOptions;
};

type SuiObjectResponse = {
  data?: any;
  error?: any;
};

export type SuiBalanceResponse = {
  coinType: string;
  coinObjectCount: number;
  totalBalance: string;
  lockedBalance: Record<string, string>;
};

export type SuiTransactionBlockResponse = any;

export type SuiPaginatedObjectResponse = {
  data: any[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

type FetchLike = typeof fetch;

const DEFAULT_OBJECT_READ_RETRY_DELAYS_MS = [750, 1500, 3000] as const;
const DEFAULT_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";

const SUI_OBJECT_QUERY = `
  query SuiObject($id: SuiAddress!) {
    object(address: $id) {
      address
      digest
      version
      previousTransaction { digest }
      asMoveObject {
        contents {
          type { repr }
          json
        }
      }
      owner {
        __typename
        ... on AddressOwner { address { address } }
        ... on ObjectOwner { address { address } }
        ... on Shared { initialSharedVersion }
      }
    }
  }
`;

const SUI_BALANCE_QUERY = `
  query SuiBalance($owner: SuiAddress!, $coinType: String!) {
    address(address: $owner) {
      balance(coinType: $coinType) {
        coinType { repr }
        totalBalance
      }
    }
  }
`;

const SUI_TRANSACTION_QUERY = `
  query SuiTransaction($digest: String!) {
    transaction(digest: $digest) {
      digest
      effects {
        status
        executionError { message }
        events(first: 50) {
          nodes {
            sequenceNumber
            contents {
              type { repr }
              json
            }
          }
        }
        objectChanges(first: 50) {
          nodes {
            address
            idCreated
            idDeleted
            inputState { asMoveObject { contents { type { repr } } } }
            outputState { asMoveObject { contents { type { repr } } } }
          }
        }
      }
    }
  }
`;

const SUI_OWNED_OBJECTS_QUERY = `
  query SuiOwnedObjects(
    $owner: SuiAddress!
    $filter: ObjectFilter
    $first: Int
    $cursor: String
  ) {
    address(address: $owner) {
      objects(first: $first, after: $cursor, filter: $filter) {
        pageInfo { hasNextPage endCursor }
        nodes {
          address
          digest
          version
          previousTransaction { digest }
          owner {
            __typename
            ... on AddressOwner { address { address } }
            ... on ObjectOwner { address { address } }
            ... on Shared { initialSharedVersion }
          }
          contents {
            type { repr }
            json
            display { output errors }
          }
        }
      }
    }
  }
`;

const SUI_DYNAMIC_FIELDS_QUERY = `
  query SuiDynamicFields(
    $parentId: SuiAddress!
    $first: Int
    $cursor: String
  ) {
    address(address: $parentId) {
      dynamicFields(first: $first, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          address
          name { type { repr } json }
          value {
            __typename
            ... on MoveValue { type { repr } json }
            ... on MoveObject {
              address
              contents { type { repr } json }
            }
          }
        }
      }
    }
  }
`;

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
  return [DEFAULT_SUI_GRAPHQL_URL];
}

export function buildSuiObjectGraphQLBody(request: SuiObjectRequest) {
  return {
    query: SUI_OBJECT_QUERY,
    variables: { id: request.id },
  };
}

export function buildSuiBalanceGraphQLBody(owner: string, coinType?: string) {
  return {
    query: SUI_BALANCE_QUERY,
    variables: { owner, coinType: coinType ?? "0x2::sui::SUI" },
  };
}

export function buildSuiTransactionGraphQLBody(digest: string) {
  return {
    query: SUI_TRANSACTION_QUERY,
    variables: { digest },
  };
}

export function buildSuiOwnedObjectsGraphQLBody(
  owner: string,
  options: { structType?: string; cursor?: string | null; limit?: number } = {},
) {
  return {
    query: SUI_OWNED_OBJECTS_QUERY,
    variables: {
      owner,
      filter: options.structType ? { type: options.structType } : null,
      first: options.limit ?? 50,
      cursor: options.cursor ?? null,
    },
  };
}

export function buildSuiDynamicFieldsGraphQLBody(
  parentId: string,
  options: { cursor?: string | null; limit?: number } = {},
) {
  return {
    query: SUI_DYNAMIC_FIELDS_QUERY,
    variables: {
      parentId,
      first: options.limit ?? 50,
      cursor: options.cursor ?? null,
    },
  };
}

function mapGraphQLObjectOwner(owner: any) {
  if (!owner) return undefined;
  if (owner.__typename === "AddressOwner") {
    return { AddressOwner: owner.address?.address };
  }
  if (owner.__typename === "ObjectOwner") {
    return { ObjectOwner: owner.address?.address };
  }
  if (owner.__typename === "Shared") {
    return {
      Shared: {
        initial_shared_version: String(owner.initialSharedVersion),
      },
    };
  }
  if (owner.__typename === "Immutable") return "Immutable";
  return undefined;
}

async function readGraphQLViaPost(
  endpoint: string,
  body: Record<string, unknown>,
  options: {
    endpointIndex: number;
    operation: string;
    objectId?: string;
    transactionDigest?: string;
    queueId?: string;
    fetchFn: FetchLike;
  },
): Promise<any> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let response: Response;
  try {
    response = await options.fetchFn(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new SuiRpcReadError("Sui GraphQL transport failed.", {
      kind: "transport",
      cause,
    });
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // Status handling below reports non-JSON responses without exposing bodies.
  }

  if (!response.ok) {
    console.warn("[sui-graphql] http failure", {
      operation: options.operation,
      endpointCategory,
      objectId: options.objectId,
      transactionDigest: options.transactionDigest,
      queueId: options.queueId,
      status: response.status,
    });
    throw new SuiRpcReadError("Sui GraphQL HTTP request failed.", {
      kind:
        response.status === 429 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504
          ? "rate_limited"
          : "transport",
      status: response.status,
    });
  }

  if (Array.isArray(json?.errors) && json.errors.length > 0) {
    const message = String(json.errors[0]?.message ?? "GraphQL request failed");
    console.warn("[sui-graphql] query failure", {
      operation: options.operation,
      endpointCategory,
      objectId: options.objectId,
      transactionDigest: options.transactionDigest,
      queueId: options.queueId,
      graphQLMessage: message,
    });
    throw new SuiRpcReadError("Sui GraphQL request failed.", {
      kind: "unexpected",
      status: response.status,
      rpcMessage: message,
    });
  }

  return json;
}

async function readObjectViaGraphQL(
  endpoint: string,
  request: SuiObjectRequest,
  options: {
    endpointIndex: number;
    operation: string;
    queueId?: string;
    fetchFn: FetchLike;
  },
): Promise<SuiObjectResponse> {
  const response = await readGraphQLViaPost(
    endpoint,
    buildSuiObjectGraphQLBody(request),
    {
      endpointIndex: options.endpointIndex,
      operation: options.operation,
      objectId: request.id,
      queueId: options.queueId,
      fetchFn: options.fetchFn,
    },
  );
  const object = response?.data?.object;
  if (!object) {
    return {
      error: {
        code: "notExists",
        objectId: request.id,
      },
    };
  }

  const moveObject = object.asMoveObject;
  const objectType = moveObject?.contents?.type?.repr;
  return {
    data: {
      objectId: object.address,
      version: String(object.version),
      digest: object.digest,
      type: objectType,
      owner: mapGraphQLObjectOwner(object.owner),
      previousTransaction: object.previousTransaction?.digest ?? null,
      content: moveObject
        ? {
            dataType: "moveObject",
            type: objectType,
            fields: moveObject.contents?.json ?? {},
          }
        : undefined,
    },
  };
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
      return await readObjectViaGraphQL(endpoint, request, options);
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;
      lastRpcCode = error instanceof SuiRpcReadError ? error.rpcCode : undefined;
      lastRpcMessage =
        error instanceof SuiRpcReadError ? error.rpcMessage : undefined;

      console.warn("[sui-graphql] object read failed", {
        operation: options.operation,
        endpointCategory,
        httpMethod: "POST",
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
        console.warn("[sui-graphql] switching endpoint after read failure", {
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

function mapGraphQLOwnedObject(object: any) {
  const contents = object?.contents;
  const objectType = contents?.type?.repr;
  return {
    data: {
      objectId: object?.address,
      version: String(object?.version),
      digest: object?.digest,
      type: objectType,
      owner: mapGraphQLObjectOwner(object?.owner),
      previousTransaction: object?.previousTransaction?.digest ?? null,
      content: {
        dataType: "moveObject",
        type: objectType,
        fields: contents?.json ?? {},
      },
      display: contents?.display
        ? {
            data: contents.display.output ?? {},
            error: contents.display.errors ?? null,
          }
        : undefined,
    },
  };
}

function mapGraphQLDynamicField(field: any) {
  const valueType =
    field?.value?.__typename === "MoveObject"
      ? field.value.contents?.type?.repr
      : field?.value?.type?.repr;
  return {
    name: {
      type: field?.name?.type?.repr,
      value: field?.name?.json,
    },
    objectId: field?.address,
    objectType: valueType,
  };
}

async function readPaginatedGraphQLWithRetries(
  endpoint: string,
  body: Record<string, unknown>,
  options: {
    endpointIndex: number;
    operation: string;
    subjectId: string;
    retryDelaysMs: readonly number[];
    fetchFn: FetchLike;
    selectPage: (response: any) => any;
    mapNode: (node: any) => any;
  },
): Promise<SuiPaginatedObjectResponse> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let lastError: unknown;
  let lastKind: SuiReadFailureKind = "unexpected";
  let lastStatus: number | undefined;
  let lastRpcMessage: string | undefined;

  for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt += 1) {
    try {
      const response = await readGraphQLViaPost(endpoint, body, {
        endpointIndex: options.endpointIndex,
        operation: options.operation,
        objectId: options.subjectId,
        fetchFn: options.fetchFn,
      });
      const page = options.selectPage(response);
      if (!page) {
        return { data: [], hasNextPage: false, nextCursor: null };
      }
      return {
        data: (page.nodes ?? []).map(options.mapNode),
        hasNextPage: Boolean(page.pageInfo?.hasNextPage),
        nextCursor: page.pageInfo?.endCursor ?? null,
      };
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;
      lastRpcMessage =
        error instanceof SuiRpcReadError ? error.rpcMessage : undefined;

      console.warn("[sui-graphql] paginated read failed", {
        operation: options.operation,
        endpointCategory,
        httpMethod: "POST",
        objectId: options.subjectId,
        status: classification.status,
        rpcMessage: lastRpcMessage,
        retry: attempt,
      });

      const shouldRetry =
        classification.retryable && attempt < options.retryDelaysMs.length;
      if (!shouldRetry) break;
      await sleep(options.retryDelaysMs[attempt]);
    }
  }

  throw new SuiRpcReadError(
    lastKind === "rate_limited"
      ? "Sui GraphQL paginated read was rate-limited after retries."
      : "Sui GraphQL paginated read failed after retries.",
    {
      kind: lastKind,
      status: lastStatus,
      rpcMessage: lastRpcMessage,
      cause: lastError,
    },
  );
}

async function readPaginatedGraphQLAcrossEndpoints(
  body: Record<string, unknown>,
  options: {
    operation: string;
    subjectId: string;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
    selectPage: (response: any) => any;
    mapNode: (node: any) => any;
  },
): Promise<SuiPaginatedObjectResponse> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_OBJECT_READ_RETRY_DELAYS_MS;
  const endpoints =
    options.endpoints?.filter(Boolean) ?? getConfiguredEndpoints();
  const fetchFn = resolveFetchImplementation(options.fetchImpl);
  let lastError: unknown;

  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return await readPaginatedGraphQLWithRetries(endpoints[index], body, {
        endpointIndex: index,
        operation: options.operation,
        subjectId: options.subjectId,
        retryDelaysMs,
        fetchFn,
        selectPage: options.selectPage,
        mapNode: options.mapNode,
      });
    } catch (error) {
      lastError = error;
      if (index < endpoints.length - 1) {
        const graphQLError = error as Partial<SuiRpcReadError>;
        console.warn("[sui-graphql] switching endpoint after paginated read failure", {
          operation: options.operation,
          endpointCategory: endpointLabel(index),
          nextEndpointCategory: endpointLabel(index + 1),
          status: graphQLError.status,
          rpcMessage: graphQLError.rpcMessage,
          objectId: options.subjectId,
        });
      }
    }
  }

  throw lastError;
}

export async function readSuiOwnedObjectsWithRetry(
  owner: string,
  options: {
    operation: string;
    structType?: string;
    cursor?: string | null;
    limit?: number;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
  },
): Promise<SuiPaginatedObjectResponse> {
  return readPaginatedGraphQLAcrossEndpoints(
    buildSuiOwnedObjectsGraphQLBody(owner, options),
    {
      ...options,
      subjectId: owner,
      selectPage: (response) => response?.data?.address?.objects,
      mapNode: mapGraphQLOwnedObject,
    },
  );
}

export async function readSuiDynamicFieldsWithRetry(
  parentId: string,
  options: {
    operation: string;
    cursor?: string | null;
    limit?: number;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
  },
): Promise<SuiPaginatedObjectResponse> {
  return readPaginatedGraphQLAcrossEndpoints(
    buildSuiDynamicFieldsGraphQLBody(parentId, options),
    {
      ...options,
      subjectId: parentId,
      selectPage: (response) => response?.data?.address?.dynamicFields,
      mapNode: mapGraphQLDynamicField,
    },
  );
}

async function readBalanceViaGraphQL(
  endpoint: string,
  owner: string,
  options: {
    endpointIndex: number;
    operation: string;
    coinType?: string;
    fetchFn: FetchLike;
  },
): Promise<SuiBalanceResponse> {
  const response = await readGraphQLViaPost(
    endpoint,
    buildSuiBalanceGraphQLBody(owner, options.coinType),
    {
      endpointIndex: options.endpointIndex,
      operation: options.operation,
      fetchFn: options.fetchFn,
    },
  );
  const balance = response?.data?.address?.balance;
  return {
    coinType: balance?.coinType?.repr ?? options.coinType ?? "0x2::sui::SUI",
    coinObjectCount: 0,
    totalBalance: String(balance?.totalBalance ?? "0"),
    lockedBalance: {},
  };
}

async function readBalanceWithRetries(
  endpoint: string,
  owner: string,
  options: {
    endpointIndex: number;
    operation: string;
    coinType?: string;
    retryDelaysMs: readonly number[];
    fetchFn: FetchLike;
  },
): Promise<SuiBalanceResponse> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let lastError: unknown;
  let lastKind: SuiReadFailureKind = "unexpected";
  let lastStatus: number | undefined;
  let lastRpcCode: number | undefined;
  let lastRpcMessage: string | undefined;

  for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt += 1) {
    try {
      return await readBalanceViaGraphQL(endpoint, owner, options);
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;
      lastRpcCode = error instanceof SuiRpcReadError ? error.rpcCode : undefined;
      lastRpcMessage =
        error instanceof SuiRpcReadError ? error.rpcMessage : undefined;

      console.warn("[sui-graphql] balance read failed", {
        operation: options.operation,
        endpointCategory,
        httpMethod: "POST",
        status: classification.status,
        rpcCode: lastRpcCode,
        rpcMessage: lastRpcMessage,
        retry: attempt,
      });

      const shouldRetry =
        classification.retryable && attempt < options.retryDelaysMs.length;
      if (!shouldRetry) break;
      await sleep(options.retryDelaysMs[attempt]);
    }
  }

  throw new SuiRpcReadError(
    lastKind === "rate_limited"
      ? "Sui RPC balance read was rate-limited after retries."
      : "Sui RPC balance read failed after retries.",
    {
      kind: lastKind,
      status: lastStatus,
      rpcCode: lastRpcCode,
      rpcMessage: lastRpcMessage,
      cause: lastError,
    },
  );
}

export async function readSuiBalanceWithRetry(
  owner: string,
  options: {
    operation: string;
    coinType?: string;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
  },
): Promise<SuiBalanceResponse> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_OBJECT_READ_RETRY_DELAYS_MS;
  const endpoints =
    options.endpoints?.filter(Boolean) ?? getConfiguredEndpoints();
  const fetchFn = resolveFetchImplementation(options.fetchImpl);

  let lastError: unknown;
  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return await readBalanceWithRetries(endpoints[index], owner, {
        endpointIndex: index,
        operation: options.operation,
        coinType: options.coinType,
        retryDelaysMs,
        fetchFn,
      });
    } catch (error) {
      lastError = error;
      if (index < endpoints.length - 1) {
        const rpcError = error as Partial<SuiRpcReadError>;
        console.warn("[sui-graphql] switching endpoint after balance failure", {
          operation: options.operation,
          endpointCategory: endpointLabel(index),
          nextEndpointCategory: endpointLabel(index + 1),
          status: rpcError.status,
          rpcCode: rpcError.rpcCode,
          rpcMessage: rpcError.rpcMessage,
        });
      }
    }
  }

  throw lastError;
}

async function readTransactionBlockViaGraphQL(
  endpoint: string,
  digest: string,
  requestOptions: Record<string, unknown>,
  options: {
    endpointIndex: number;
    operation: string;
    fetchFn: FetchLike;
  },
): Promise<SuiTransactionBlockResponse> {
  void requestOptions;
  const response = await readGraphQLViaPost(
    endpoint,
    buildSuiTransactionGraphQLBody(digest),
    {
      endpointIndex: options.endpointIndex,
      operation: options.operation,
      transactionDigest: digest,
      fetchFn: options.fetchFn,
    },
  );
  const transaction = response?.data?.transaction;
  if (!transaction) {
    throw new SuiRpcReadError("Sui transaction is not indexed yet.", {
      kind: "transport",
      status: 404,
    });
  }

  const effects = transaction.effects;
  const status = String(effects?.status ?? "").toLowerCase();
  const events = (effects?.events?.nodes ?? []).map((event: any) => ({
    id: {
      txDigest: transaction.digest,
      eventSeq: String(event.sequenceNumber),
    },
    type: event.contents?.type?.repr,
    parsedJson: event.contents?.json,
  }));
  const objectChanges = (effects?.objectChanges?.nodes ?? []).map(
    (change: any) => {
      const objectType =
        change.outputState?.asMoveObject?.contents?.type?.repr ??
        change.inputState?.asMoveObject?.contents?.type?.repr;
      return {
        type: change.idCreated
          ? "created"
          : change.idDeleted
            ? "deleted"
            : "mutated",
        objectId: change.address,
        objectType,
      };
    },
  );

  return {
    digest: transaction.digest,
    effects: {
      status: {
        status: status || "success",
        error: effects?.executionError?.message,
      },
    },
    events,
    objectChanges,
  };
}

async function readTransactionBlockWithRetries(
  endpoint: string,
  digest: string,
  requestOptions: Record<string, unknown>,
  options: {
    endpointIndex: number;
    operation: string;
    retryDelaysMs: readonly number[];
    fetchFn: FetchLike;
  },
): Promise<SuiTransactionBlockResponse> {
  const endpointCategory = endpointLabel(options.endpointIndex);
  let lastError: unknown;
  let lastKind: SuiReadFailureKind = "unexpected";
  let lastStatus: number | undefined;
  let lastRpcCode: number | undefined;
  let lastRpcMessage: string | undefined;

  for (let attempt = 0; attempt <= options.retryDelaysMs.length; attempt += 1) {
    try {
      return await readTransactionBlockViaGraphQL(
        endpoint,
        digest,
        requestOptions,
        options,
      );
    } catch (error) {
      lastError = error;
      const classification = classifySuiRpcReadError(error);
      lastKind = classification.kind;
      lastStatus = classification.status;
      lastRpcCode = error instanceof SuiRpcReadError ? error.rpcCode : undefined;
      lastRpcMessage =
        error instanceof SuiRpcReadError ? error.rpcMessage : undefined;

      console.warn("[sui-graphql] transaction block read failed", {
        operation: options.operation,
        endpointCategory,
        httpMethod: "POST",
        transactionDigest: digest,
        status: classification.status,
        rpcCode: lastRpcCode,
        rpcMessage: lastRpcMessage,
        retry: attempt,
      });

      const shouldRetry =
        classification.retryable && attempt < options.retryDelaysMs.length;
      if (!shouldRetry) break;
      await sleep(options.retryDelaysMs[attempt]);
    }
  }

  throw new SuiRpcReadError(
    lastKind === "rate_limited"
      ? "Sui RPC transaction block read was rate-limited after retries."
      : "Sui RPC transaction block read failed after retries.",
    {
      kind: lastKind,
      status: lastStatus,
      rpcCode: lastRpcCode,
      rpcMessage: lastRpcMessage,
      cause: lastError,
    },
  );
}

export async function readSuiTransactionBlockWithRetry(
  digest: string,
  options: {
    operation: string;
    requestOptions?: Record<string, unknown>;
    retryDelaysMs?: readonly number[];
    endpoints?: string[];
    fetchImpl?: FetchLike;
  },
): Promise<SuiTransactionBlockResponse> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_OBJECT_READ_RETRY_DELAYS_MS;
  const endpoints =
    options.endpoints?.filter(Boolean) ?? getConfiguredEndpoints();
  const fetchFn = resolveFetchImplementation(options.fetchImpl);

  let lastError: unknown;
  for (let index = 0; index < endpoints.length; index += 1) {
    try {
      return await readTransactionBlockWithRetries(
        endpoints[index],
        digest,
        options.requestOptions ?? {},
        {
          endpointIndex: index,
          operation: options.operation,
          retryDelaysMs,
          fetchFn,
        },
      );
    } catch (error) {
      lastError = error;
      if (index < endpoints.length - 1) {
        const rpcError = error as Partial<SuiRpcReadError>;
        console.warn("[sui-graphql] switching endpoint after transaction read failure", {
          operation: options.operation,
          endpointCategory: endpointLabel(index),
          nextEndpointCategory: endpointLabel(index + 1),
          status: rpcError.status,
          rpcCode: rpcError.rpcCode,
          rpcMessage: rpcError.rpcMessage,
          transactionDigest: digest,
        });
      }
    }
  }

  throw lastError;
}
