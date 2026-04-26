import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CONFIG } from "@/lib/sui-config";

function toBytes(input: string): number[] {
  return Array.from(new TextEncoder().encode(input));
}

export default function Mint() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [number, setNumber] = useState<number>(1);
  const [name, setName] = useState<string>(`${SUI_CONFIG.COLLECTION_NAME_PREFIX}1`);
  const [description, setDescription] = useState<string>(SUI_CONFIG.COLLECTION_DESCRIPTION);
  const [imageUrl, setImageUrl] = useState<string>(`${SUI_CONFIG.COLLECTION_IMAGE_BASE_URI}/1.jpg`);
  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState<string>("");

  const mintPriceSui = useMemo(
    () => (SUI_CONFIG.COLLECTION_MINT_PRICE_MIST / 1_000_000_000).toFixed(2),
    [],
  );

  const onNumberChange = (value: number) => {
    setNumber(value);
    setName(`${SUI_CONFIG.COLLECTION_NAME_PREFIX}${value}`);
    setImageUrl(`${SUI_CONFIG.COLLECTION_IMAGE_BASE_URI}/${value}.jpg`);
  };

  const mintNow = async () => {
    if (!account?.address) {
      setStatus("Connect wallet to mint.");
      return;
    }

    if (SUI_CONFIG.COLLECTION_MINT_CONFIG_ID.includes("REPLACE_WITH")) {
      setStatus("Set COLLECTION_MINT_CONFIG_ID in sui-config.ts before minting.");
      return;
    }

    setIsMinting(true);
    setStatus("Checking wallet balance...");

    try {
      const balance = await suiClient.getBalance({ owner: account.address });
      const total = Number(balance.totalBalance);
      if (total < SUI_CONFIG.COLLECTION_MINT_PRICE_MIST) {
        setStatus(
          `Insufficient SUI. Need ${mintPriceSui} SUI plus gas, have ${(total / 1e9).toFixed(4)} SUI.`,
        );
        setIsMinting(false);
        return;
      }

      const tx = new Transaction();
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_CONFIG.COLLECTION_MINT_PRICE_MIST)]);

      tx.moveCall({
        target: `${SUI_CONFIG.COLLECTION_PACKAGE_ID}::${SUI_CONFIG.COLLECTION_MODULE}::mint_public`,
        arguments: [
          tx.pure.u64(number),
          tx.pure.vector("u8", toBytes(name)),
          tx.pure.vector("u8", toBytes(description)),
          tx.pure.vector("u8", toBytes(imageUrl)),
          payment,
          tx.object(SUI_CONFIG.COLLECTION_MINT_CONFIG_ID),
        ],
      });

      setStatus("Submitting mint transaction...");

      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
            chain: SUI_CONFIG.CHAIN,
          },
          {
            onSuccess: ({ digest }) => {
              setStatus(`Mint success. Digest: ${digest}`);
              resolve();
            },
            onError: (error) => {
              setStatus(`Mint failed: ${error.message || "transaction rejected"}`);
              reject(error);
            },
          },
        );
      });
    } catch (error: any) {
      setStatus(`Mint error: ${error?.message || "unknown error"}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url(/assets/background1.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        color: "#f7fafc",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", background: "rgba(26, 71, 49, 0.88)", border: "2px solid rgba(52,211,153,0.4)", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>Mint Tree NFT</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/" style={{ color: "#d4a017", textDecoration: "none", fontWeight: 700 }}>
              Back Home
            </Link>
            <ConnectButton />
          </div>
        </div>

        <p style={{ marginTop: 10, marginBottom: 20, opacity: 0.95 }}>
          Standard public mint flow: pay {mintPriceSui} SUI, receive NFT instantly in your connected wallet.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <label>
            <div style={{ marginBottom: 6 }}>NFT Number</div>
            <input
              type="number"
              min={1}
              value={number}
              onChange={(e) => onNumberChange(Number(e.target.value || 1))}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #34d399", background: "#0d2a1d", color: "#f7fafc" }}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #34d399", background: "#0d2a1d", color: "#f7fafc" }}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Description</div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #34d399", background: "#0d2a1d", color: "#f7fafc" }}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Image URL (IPFS/Gateway)</div>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #34d399", background: "#0d2a1d", color: "#f7fafc" }}
            />
          </label>
        </div>

        <button
          onClick={mintNow}
          disabled={isMinting || !account?.address}
          style={{
            marginTop: 18,
            background: isMinting ? "#2f4f3f" : "linear-gradient(45deg, #34d399, #d4a017)",
            color: "#1a4731",
            fontWeight: 800,
            border: "none",
            borderRadius: 9999,
            padding: "12px 22px",
            cursor: isMinting ? "not-allowed" : "pointer",
          }}
        >
          {isMinting ? "Minting..." : `Mint for ${mintPriceSui} SUI`}
        </button>

        {!!status && (
          <p style={{ marginTop: 14, whiteSpace: "pre-wrap", color: status.startsWith("Mint success") ? "#9efcc2" : "#f7fafc" }}>
            {status}
          </p>
        )}

        <div style={{ marginTop: 20, fontSize: 13, opacity: 0.85 }}>
          <div>Collection package: {SUI_CONFIG.COLLECTION_PACKAGE_ID}</div>
          <div>Mint config: {SUI_CONFIG.COLLECTION_MINT_CONFIG_ID}</div>
          <div>Network: {SUI_CONFIG.NETWORK}</div>
        </div>
      </div>
    </div>
  );
}
