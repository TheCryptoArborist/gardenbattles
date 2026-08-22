import {
  SuiHTTPTransport,
  type SuiTransport,
  type SuiTransportRequestOptions,
  type SuiTransportSubscribeOptions,
} from "@mysten/sui/client";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function shouldFailoverSuiRpcError(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    cause?: { code?: unknown; status?: unknown };
  };
  const code = Number(candidate?.code ?? candidate?.cause?.code);
  const status = Number(candidate?.status ?? candidate?.cause?.status);
  const message = errorMessage(error);

  if (code === -32601) return true;
  if (status === 408 || status === 429 || status >= 500) return true;

  return /method not found|json-rpc.*deprecated|legacy json-rpc|failed to fetch|fetch failed|network|timeout|timed out|econnreset|etimedout|\b429\b|too many requests|\b50[0234]\b/i.test(
    message,
  );
}

export class SuiFailoverTransport implements SuiTransport {
  readonly transports: readonly SuiTransport[];

  constructor(transports: readonly SuiTransport[]) {
    if (transports.length === 0) {
      throw new Error("At least one Sui transport is required.");
    }
    this.transports = transports;
  }

  async request<T>(input: SuiTransportRequestOptions): Promise<T> {
    let lastError: unknown;

    for (let index = 0; index < this.transports.length; index += 1) {
      try {
        return await this.transports[index].request<T>(input);
      } catch (error) {
        lastError = error;
        const canTryNext =
          index < this.transports.length - 1 &&
          shouldFailoverSuiRpcError(error);
        if (!canTryNext) throw error;
        console.warn("[sui-rpc] switching compatibility provider", {
          method: input.method,
          nextProvider: index + 2,
        });
      }
    }

    throw lastError;
  }

  async subscribe<T>(
    input: SuiTransportSubscribeOptions<T>,
  ): Promise<() => Promise<boolean>> {
    let lastError: unknown;

    for (let index = 0; index < this.transports.length; index += 1) {
      try {
        return await this.transports[index].subscribe(input);
      } catch (error) {
        lastError = error;
        const canTryNext =
          index < this.transports.length - 1 &&
          shouldFailoverSuiRpcError(error);
        if (!canTryNext) throw error;
      }
    }

    throw lastError;
  }
}

export function createSuiFailoverTransport(
  urls: readonly string[],
): SuiFailoverTransport {
  const uniqueUrls = Array.from(
    new Set(urls.map((url) => url.trim()).filter(Boolean)),
  );
  return new SuiFailoverTransport(
    uniqueUrls.map((url) => new SuiHTTPTransport({ url })),
  );
}
