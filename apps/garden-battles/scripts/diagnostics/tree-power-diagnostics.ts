import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

type CliOptions = {
  wallet?: string;
  digest?: string;
  objectId?: string;
  objectIds: string[];
  rpcUrl: string;
};

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    objectIds: [],
    rpcUrl: process.env.SUI_RPC_URL || getFullnodeUrl("mainnet"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--wallet") {
      options.wallet = next;
      index += 1;
    } else if (arg === "--digest") {
      options.digest = next;
      index += 1;
    } else if (arg === "--object-id" || arg === "--receipt-object-id" || arg === "--stake-object-id") {
      options.objectId = next;
      options.objectIds.push(next);
      index += 1;
    } else if (arg === "--object-ids") {
      options.objectIds.push(...next.split(",").map((value) => value.trim()).filter(Boolean));
      index += 1;
    } else if (arg === "--rpc-url") {
      options.rpcUrl = next;
      index += 1;
    }
  }

  return options;
}

function sanitizeObjectResponse(object: Awaited<ReturnType<SuiClient["getObject"]>>) {
  const content = object.data?.content;
  return {
    objectId: object.data?.objectId,
    version: object.data?.version,
    digest: object.data?.digest,
    type: object.data?.type,
    owner: object.data?.owner,
    fields: content && "fields" in content ? (content as any).fields : undefined,
  };
}

function sanitizeTransactionResponse(transaction: Awaited<ReturnType<SuiClient["getTransactionBlock"]>>) {
  return {
    digest: transaction.digest,
    timestampMs: transaction.timestampMs,
    status: transaction.effects?.status,
    objectChanges: transaction.objectChanges?.map((change) => ({
      type: change.type,
      objectType: "objectType" in change ? change.objectType : undefined,
      objectId: "objectId" in change ? change.objectId : undefined,
      owner: "owner" in change ? change.owner : undefined,
    })),
    events: transaction.events?.map((event) => ({
      type: event.type,
      sender: event.sender,
      parsedJson: event.parsedJson,
    })),
  };
}

export async function runTreePowerDiagnostic(label: string, argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  const client = new SuiClient({ url: options.rpcUrl });
  const report: Record<string, unknown> = {
    diagnostic: label,
    wallet: options.wallet,
    rpc: options.rpcUrl === getFullnodeUrl("mainnet") ? "default-mainnet" : "custom",
    objectIds: options.objectIds,
  };

  if (options.digest) {
    report.transaction = sanitizeTransactionResponse(
      await client.getTransactionBlock({
        digest: options.digest,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      }),
    );
  }

  if (options.objectIds.length > 0) {
    const objects = await Promise.all(
      options.objectIds.map((id) =>
        client.getObject({
          id,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
          },
        }),
      ),
    );
    report.objects = objects.map(sanitizeObjectResponse);
  }

  console.log(JSON.stringify(report, null, 2));
}
