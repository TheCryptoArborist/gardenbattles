import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import UtilityDrawer from "@/components/UtilityDrawer";
import { SUI_CONFIG } from "@/lib/sui-config";

type SalePool = { poolId: string; label: string; count?: number };
type SalePoolResponse = {
  latestPackageId: string;
  mintConfigId: string;
  mintPriceMist: string;
  totalAvailable?: number;
  activePoolId: string;
  activePoolLabel: string;
  pools: SalePool[];
  error?: string;
};
type Listing = {
  nftObjectId: string;
  name: string;
  imageUrl: string;
  rarity: string;
  priceLabel: string;
  tradeportUrl: string;
};
type ListingResponse = { listings?: Listing[]; count?: number; floorPrice?: string; collectionUrl?: string; error?: string };
const NFTREE_MINT_GAS_BUDGET_MIST = BigInt(120_000_000);

function formatMist(mist: string | number) {
  return `${(Number(mist) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 })} SUI`;
}

export default function NftreeAcquisitionDrawer({ onClose }: { onClose: () => void }) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [tab, setTab] = useState<"mint" | "shop">("mint");
  const [salePools, setSalePools] = useState<SalePoolResponse | null>(null);
  const [listings, setListings] = useState<ListingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [status, setStatus] = useState("");
  const [shopUrl, setShopUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/nftree-sale-pools?t=${Date.now()}`).then((response) => response.json()),
      fetch(`/api/nftree-listings?t=${Date.now()}`).then((response) => response.json()),
    ])
      .then(([poolData, listingData]) => {
        if (cancelled) return;
        setSalePools(poolData);
        setListings(listingData);
        if (poolData?.error) {
          setStatus("NFTree sales-pool inventory is temporarily unavailable. Please try again shortly.");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("NFTree inventory could not be loaded. Please try again shortly.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePool = useMemo(
    () => salePools?.pools?.find((pool) => pool.poolId === salePools.activePoolId && Number(pool.count || 0) > 0),
    [salePools],
  );

  const mintNow = async () => {
    if (!account?.address || !salePools || !activePool) return;
    setMinting(true);
    setStatus("Checking wallet balance...");
    try {
      const price = BigInt(salePools.mintPriceMist || SUI_CONFIG.COLLECTION_MINT_PRICE_MIST);
      const balance = await suiClient.getBalance({ owner: account.address });
      const requiredBalance = price + NFTREE_MINT_GAS_BUDGET_MIST;
      if (BigInt(balance.totalBalance) < requiredBalance) {
        setStatus(`This purchase needs ${formatMist(price.toString())} plus up to ${formatMist(NFTREE_MINT_GAS_BUDGET_MIST.toString())} for gas.`);
        return;
      }
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.setGasBudget(Number(NFTREE_MINT_GAS_BUDGET_MIST));
      const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(price)]);
      tx.moveCall({
        target: `${salePools.latestPackageId}::collection::purchase`,
        arguments: [tx.object(activePool.poolId), payment, tx.object(salePools.mintConfigId)],
      });
      setStatus("Confirm the NFTree purchase in your wallet.");
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: (result) => {
              setStatus(`NFTree purchase submitted successfully. Transaction: ${result.digest}`);
              resolve();
            },
            onError: reject,
          },
        );
      });
    } catch (error: any) {
      setStatus(error?.message || "The NFTree purchase was not completed.");
    } finally {
      setMinting(false);
    }
  };

  return (
    <UtilityDrawer
      eyebrow="NFTree Collection"
      title="Get an NFTree"
      description="Mint from the live sales pool, or preview listed NFTrees before deciding."
      onClose={onClose}
    >
      <nav className="gb-utility-tabs" aria-label="NFTree acquisition choices">
        <button type="button" className={tab === "mint" ? "gb-utility-tab gb-utility-tab-active" : "gb-utility-tab"} onClick={() => { setTab("mint"); setShopUrl(null); }}>
          Mint from Sales Pool
        </button>
        <button type="button" className={tab === "shop" ? "gb-utility-tab gb-utility-tab-active" : "gb-utility-tab"} onClick={() => setTab("shop")}>
          Shop Visible NFTrees
        </button>
      </nav>

      {loading ? (
        <div className="gb-acquisition-loading">Checking live NFTree inventory...</div>
      ) : tab === "mint" ? (
        <section className="gb-mint-panel">
          <div className="gb-mint-summary">
            <span>Sales pool inventory</span>
            <strong>{salePools?.totalAvailable ?? 0} NFTrees available</strong>
            <small>{salePools?.activePoolLabel || "No active pool"}</small>
          </div>
          <div className="gb-mint-summary">
            <span>Purchase price</span>
            <strong>{formatMist(salePools?.mintPriceMist || SUI_CONFIG.COLLECTION_MINT_PRICE_MIST)}</strong>
            <small>The exact NFTree is revealed after the pool transaction completes.</small>
          </div>
          {!account?.address ? <ConnectButton connectText="Connect Wallet to Mint" /> : (
            <button type="button" className="gb-primary-utility-action" disabled={minting || !activePool} onClick={mintNow}>
              {minting ? "Processing..." : "Mint NFTree from Sales Pool"}
            </button>
          )}
          {status && <p className="gb-acquisition-status" aria-live="polite">{status}</p>}
        </section>
      ) : shopUrl ? (
        <div className="gb-embedded-utility">
          <button type="button" className="gb-inline-back" onClick={() => setShopUrl(null)}>Back to NFTree previews</button>
          <iframe src={shopUrl} title="NFTree marketplace checkout" allow="clipboard-write" />
        </div>
      ) : (
        <section className="gb-nftree-shop">
          <div className="gb-nftree-shop-summary">
            <strong>{listings?.count ?? listings?.listings?.length ?? 0} listed NFTrees</strong>
            {listings?.floorPrice && <span>Floor: {listings.floorPrice}</span>}
          </div>
          <div className="gb-nftree-listing-grid">
            {(listings?.listings ?? []).slice(0, 24).map((listing) => (
              <article key={listing.nftObjectId} className="gb-nftree-listing-card">
                {listing.imageUrl && <img src={listing.imageUrl} alt={listing.name} />}
                <div>
                  <strong>{listing.name}</strong>
                  <span>{listing.rarity}</span>
                  <b>{listing.priceLabel}</b>
                </div>
                <button type="button" onClick={() => setShopUrl(listing.tradeportUrl || listings?.collectionUrl || "https://www.tradeport.xyz")}>Continue in Shop</button>
              </article>
            ))}
          </div>
          {listings?.error && <p className="gb-acquisition-status">Listed NFTrees are temporarily unavailable.</p>}
        </section>
      )}
    </UtilityDrawer>
  );
}
