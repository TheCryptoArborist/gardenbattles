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

  const [isMinting, setIsMinting] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [mintedNft, setMintedNft] = useState<{ name: string; imageUrl: string } | null>(null);

  const mintPriceSui = useMemo(
    () => (SUI_CONFIG.COLLECTION_MINT_PRICE_MIST / 1_000_000_000).toFixed(2),
    [],
  );

  const mintNow = async () => {
    if (!account?.address) {
      setStatus("Connect wallet to mint.");
      return;
    }

    if (SUI_CONFIG.COLLECTION_MINT_CONFIG_ID.includes("REPLACE_WITH")) {
      setStatus("Set COLLECTION_MINT_CONFIG_ID in sui-config.ts before minting.");
      return;
    }

    if ((SUI_CONFIG as any).COLLECTION_POOL_ID?.includes("REPLACE_WITH")) {
      setStatus("Set COLLECTION_POOL_ID in sui-config.ts before minting.");
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
        target: `${SUI_CONFIG.COLLECTION_PACKAGE_ID}::${SUI_CONFIG.COLLECTION_MODULE}::purchase`,
        arguments: [
          tx.object((SUI_CONFIG as any).COLLECTION_POOL_ID),
          payment,
          tx.object(SUI_CONFIG.COLLECTION_MINT_CONFIG_ID),
        ],
      });

      setStatus("Submitting purchase transaction...");

      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
            chain: SUI_CONFIG.CHAIN,
          },
          {
            onSuccess: async (result) => {
              const { digest } = result;
              setStatus(`Success! NFT sent to your wallet. Tx: ${digest}`);
              
              // Try to find the minted NFT in object changes
              try {
                const nftChange = (result as any).objectChanges?.find(
                  (c: any) => c.type === "created" && c.objectType?.includes("::collection::NFT")
                );
                
                if (nftChange && "objectId" in nftChange) {
                  const obj = await suiClient.getObject({
                    id: nftChange.objectId,
                    options: { showContent: true, showDisplay: true }
                  });
                  
                  // @ts-ignore
                  const name = obj.data?.display?.data?.name || obj.data?.content?.fields?.name || "Tree NFT";
                  // @ts-ignore
                  const displayUrl = obj.data?.display?.data?.image_url;
                  // @ts-ignore
                  const contentUrlField = obj.data?.content?.fields?.image_url;
                  const imageUrl = displayUrl || (typeof contentUrlField === 'string' ? contentUrlField : contentUrlField?.fields?.url || contentUrlField?.url) || "";
                  
                  setMintedNft({ name, imageUrl });
                }
              } catch (e) {
                console.error("Failed to fetch minted NFT details", e);
              }
              
              resolve();
            },
            onError: (error) => {
              setStatus(`Purchase failed: ${error.message || "transaction rejected"}`);
              reject(error);
            },
          },
        );
      });
    } catch (error: any) {
      setStatus(`Error: ${error?.message || "unknown error"}`);
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

        <p style={{ marginTop: 10, marginBottom: 20, opacity: 0.95, fontSize: "1.1rem", fontStyle: "italic", color: "#9efcc2" }}>
          Unleash the power of nature! Claim your unique Tree NFT from our mystical arboretum. Each seed holds a rare essence, ready to grow and dominate in the Garden Battles.
        </p>

        <button
          onClick={mintNow}
          disabled={isMinting || !account?.address}
          style={{
            marginTop: 8,
            background: isMinting ? "#2f4f3f" : "linear-gradient(45deg, #34d399, #d4a017)",
            color: "#1a4731",
            fontWeight: 800,
            border: "none",
            borderRadius: 9999,
            padding: "14px 32px",
            fontSize: "1.1rem",
            cursor: isMinting ? "not-allowed" : "pointer",
          }}
        >
          {isMinting ? "Processing..." : `Buy NFT for ${mintPriceSui} SUI`}
        </button>

        {!!status && (
          <p style={{ marginTop: 14, whiteSpace: "pre-wrap", color: status.startsWith("Success") ? "#9efcc2" : "#f7fafc" }}>
            {status}
          </p>
        )}

        {mintedNft && (
          <div style={{ marginTop: 24, textAlign: "center", animation: "fadeIn 1s ease" }}>
            <h3 style={{ color: "#9efcc2", marginBottom: 12 }}>You received: {mintedNft.name}</h3>
            <img 
              src={mintedNft.imageUrl} 
              alt={mintedNft.name} 
              style={{ 
                maxWidth: "300px", 
                borderRadius: 12, 
                border: "3px solid #d4a017",
                boxShadow: "0 0 20px rgba(212, 160, 23, 0.4)" 
              }} 
            />
          </div>
        )}


      </div>
    </div>
  );
}
