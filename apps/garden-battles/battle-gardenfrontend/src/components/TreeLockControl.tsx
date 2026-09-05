import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import type { FifthMoveEligibilityResponse } from "@/lib/api";
import { fetchFifthMoveEligibility } from "@/lib/api";
import { SUI_CONFIG } from "@/lib/sui-config";
import {
  assertTreeLockPreview,
  buildTreeLockTransaction,
  buildTreeUnlockTransaction,
  selectTreeLockCoins,
  TREE_LOCK_MINIMUM_RAW,
} from "@/lib/treeLock";
import { TREE_COIN_TYPE } from "@/lib/treeBalance";

type Props = {
  address?: string | null;
  eligibility?: FifthMoveEligibilityResponse | null;
  onEligibilityChange?: (eligibility: FifthMoveEligibilityResponse) => void;
};

export default function TreeLockControl({ address, eligibility, onEligibilityChange }: Props) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lockSource = eligibility?.sources.find((source) => source.source === "tree-lock");
  const locks = lockSource?.evidence?.locks ?? [];
  const wallet = account?.address ?? address ?? null;

  const refresh = async () => {
    if (wallet) {
      const normalizedWallet = wallet.toLowerCase();
      const freshEligibility = await fetchFifthMoveEligibility(normalizedWallet, { refresh: true });
      queryClient.setQueryData(["fifth-move-eligibility", normalizedWallet], freshEligibility);
      onEligibilityChange?.(freshEligibility);
    }
    await queryClient.invalidateQueries({ queryKey: ["tree-balance", wallet?.toLowerCase()] });
  };

  const execute = (transaction: ReturnType<typeof buildTreeLockTransaction>, success: string) =>
    new Promise<void>((resolve, reject) => {
      signAndExecute({ transaction, chain: SUI_CONFIG.CHAIN }, {
        onSuccess: async (result) => {
          await client.waitForTransaction({ digest: result.digest });
          await refresh();
          setMessage(success);
          resolve();
        },
        onError: reject,
      });
    });

  const lockTree = async () => {
    if (!wallet || !account?.address || wallet.toLowerCase() !== account.address.toLowerCase()) {
      setMessage("Connect the wallet that will own the TREE Lock.");
      return;
    }
    if (!confirmed) {
      setMessage("Confirm the 30-day, no-rewards terms first.");
      return;
    }
    setBusy(true);
    setMessage("Verifying the lock before opening your wallet…");
    try {
      const coins: Array<{ coinObjectId: string; balance: string }> = [];
      let cursor: string | null | undefined = null;
      do {
        const page = await client.getCoins({ owner: wallet, coinType: TREE_COIN_TYPE, cursor, limit: 50 });
        coins.push(...page.data.map((coin) => ({ coinObjectId: coin.coinObjectId, balance: coin.balance })));
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);
      const selected = selectTreeLockCoins(coins);
      if (!selected) throw new Error("This wallet needs at least 1,000,000 liquid TREE.");
      const tx = buildTreeLockTransaction(wallet, selected.coinObjectIds);
      const bytes = await tx.build({ client });
      const preview = await client.dryRunTransactionBlock({ transactionBlock: bytes });
      assertTreeLockPreview(preview, wallet);
      setMessage("Approve the TREE Lock in your wallet. No TREE is paid to another wallet.");
      await execute(tx, "TREE locked. Your fifth-card eligibility is refreshing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TREE Lock was not completed.");
    } finally {
      setBusy(false);
    }
  };

  const unlockTree = async (lockObjectId: string) => {
    if (!wallet) return;
    setBusy(true);
    setMessage("Approve the withdrawal in your wallet…");
    try {
      await execute(buildTreeUnlockTransaction(wallet, lockObjectId), "Your locked TREE has returned to your wallet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TREE withdrawal was not completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gb-tree-lock-control">
      <div className="gb-tree-lock-copy">
        <strong>Lock 1,000,000 TREE for 30 days</strong>
        <span>Your fifth card unlocks immediately. This is not staking: there is no APY, reward, or treasury payment.</span>
      </div>
      {locks.map((lock) => {
        const unlockAt = Number(lock.unlockAtMs);
        const matured = Number.isFinite(unlockAt) && Date.now() >= unlockAt;
        return (
          <div className="gb-tree-lock-position" key={lock.objectId}>
            <span>{matured ? "30 days complete — withdrawal available" : `Locked until ${new Date(unlockAt).toLocaleDateString()}`}</span>
            <button type="button" disabled={!matured || busy} onClick={() => unlockTree(lock.objectId)}>Withdraw TREE</button>
          </div>
        );
      })}
      <label className="gb-tree-lock-confirm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        I understand the TREE cannot be withdrawn for 30 days and earns no rewards.
      </label>
      <button className="gb-tree-lock-button" type="button" disabled={busy || !wallet || !confirmed} onClick={lockTree}>
        {busy ? "Working…" : `Lock ${(Number(TREE_LOCK_MINIMUM_RAW) / 1_000_000).toLocaleString()} TREE`}
      </button>
      {message && <p role="status" className="gb-tree-lock-message">{message}</p>}
    </div>
  );
}
