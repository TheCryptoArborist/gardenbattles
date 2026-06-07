import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { ConnectButton } from "@mysten/dapp-kit";
import { useSuiWallet } from "@/hooks/useSuiWallet";
import { MOVE_LABELS, MOVE_META, SUI_CONFIG } from "@/lib/sui-config";
import BattleDialog from "@/components/BattleDialog";
import WaitingOverlay from "@/components/WaitingOverlay";
import AdminPanel from "@/components/AdminPanel";
import HowToPlay from "@/components/HowToPlay";
import BattleLog from "@/components/BattleLog";

function getNFTImage(growth: number, nftImageUrl?: string): string {
  // If we have a custom NFT image, use it once the "seed" phase is over (or always)
  // For now, let's use the custom image if growth > 25, otherwise show the seed
  if (growth <= 25) return "/assets/seed.jpg";
  if (nftImageUrl) return nftImageUrl;

  if (growth <= 50) return "/assets/sapling.jpg";
  if (growth <= 75) return "/assets/sapling2.jpg";
  return "/assets/full_tree.jpg";
}

export default function Battle() {
  const {
    isConnected,
    address,
    battleState,
    isWaiting,
    entryFeeMist,
    isMyTurn,
    actionLog,
    clearActionLog,
    joinBattle,
    startBotBattle,
    useAbility,
    claimTimeoutWin,
    forfeitBattle,
    adminForceClose,
    cancelQueue,
    getFirstValidSaplingNft,
  } = useSuiWallet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [hasScanned, setHasScanned] = useState(false);
  const [playerAnimation, setPlayerAnimation] = useState("");
  const [opponentAnimation, setOpponentAnimation] = useState("");
  const [prevPlayerGrowth, setPrevPlayerGrowth] = useState<number | null>(null);
  const [prevOpponentGrowth, setPrevOpponentGrowth] = useState<number | null>(
    null,
  );
  const [arboretumModalOpen, setArboretumModalOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isClaimingTimeout, setIsClaimingTimeout] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [isAdminClosing, setIsAdminClosing] = useState(false);
  const entryFeeLabel = `${(entryFeeMist / 1e9).toLocaleString(undefined, {
    maximumFractionDigits: 9,
  })} SUI`;
  const [playerNftImageUrl, setPlayerNftImageUrl] = useState<string | null>(
    null,
  );
  const [opponentNftImageUrl, setOpponentNftImageUrl] = useState<string | null>(
    null,
  );
  const [pendingMoveId, setPendingMoveId] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inlineErrorTimer = useRef<NodeJS.Timeout | null>(null);

  const playerAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const opponentAnimationTimer = useRef<NodeJS.Timeout | null>(null);

  const showInlineError = (message: string) => {
    if (inlineErrorTimer.current) clearTimeout(inlineErrorTimer.current);
    setInlineError(message);
    inlineErrorTimer.current = setTimeout(() => setInlineError(null), 8000);
  };

  const handleJoinBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsJoining(true);
    try {
      setDialogOpen(true);
      setDialogMessage("Scanning for NFTs...");

      const nftData = await getFirstValidSaplingNft(address!);

      if (nftData) {
        setDialogMessage("NFT found! Joining queue...");
        setPlayerNftImageUrl(nftData.imageUrl || null);
        await joinBattle(nftData);
        setDialogMessage("Joined queue! Waiting for opponent...");
      } else {
        setDialogMessage(
          "No whitelisted NFT found. Contact admin to whitelist your collection.",
        );
      }
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(error.message || "Failed to join battle");
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartBotBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsStartingBot(true);
    try {
      setDialogOpen(true);
      setDialogMessage("Scanning for NFTs...");

      const nftData = await getFirstValidSaplingNft(address!);

      if (nftData) {
        setDialogMessage("NFT found! Starting Garden Bot practice battle...");
        setPlayerNftImageUrl(nftData.imageUrl || null);
        await startBotBattle(nftData);
        setDialogMessage(
          "Garden Bot battle started! Waiting for chain update...",
        );
      } else {
        setDialogMessage(
          "No whitelisted NFT found. Contact admin to whitelist your collection.",
        );
      }
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(error.message || "Failed to start bot battle");
    } finally {
      setIsStartingBot(false);
    }
  };

  const handleForceRefund = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsRefunding(true);
    try {
      await cancelQueue();
      setDialogOpen(true);
      setDialogMessage(
        `Refund successful! Your ${entryFeeLabel} has been returned.`,
      );
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Refund failed: ${error.message}`);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleForfeitBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsForfeiting(true);
    try {
      await forfeitBattle();
      setDialogOpen(true);
      setDialogMessage("You have forfeited the battle.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Forfeit failed: ${error.message}`);
    } finally {
      setIsForfeiting(false);
    }
  };

  const handleClaimTimeout = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsClaimingTimeout(true);
    try {
      await claimTimeoutWin();
      setDialogOpen(true);
      setDialogMessage("Timeout claim submitted. Waiting for chain confirmation.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Timeout claim failed: ${error.message}`);
    } finally {
      setIsClaimingTimeout(false);
    }
  };

  const handleAdminForceClose = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    const winnerAddress = window.prompt(
      "Enter the winner address to assign a winner, or leave blank to simply force-close the battle:",
      "",
    );

    setIsAdminClosing(true);
    try {
      await adminForceClose(
        winnerAddress?.trim() ? winnerAddress.trim().toLowerCase() : undefined,
      );
      setDialogOpen(true);
      setDialogMessage("Admin force-close submitted. Waiting for chain confirmation.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Admin force-close failed: ${error.message}`);
    } finally {
      setIsAdminClosing(false);
    }
  };

  // AUTO-JOIN DISABLED - User must manually join to prevent accidental charges
  // useEffect(() => {
  //   async function autoJoinBattle() {
  //     if (isConnected && address && !battleState) {
  //       if (!hasScanned) {
  //         setHasScanned(true);
  //         try {
  //           setDialogOpen(true);
  //           setDialogMessage('Scanning for NFTs in your wallet and kiosks...');
  //
  //           const nftData = await getFirstValidSaplingNft(address);
  //
  //           if (nftData) {
  //             const locationText = nftData.location === 'kiosk' ? 'in your kiosk' : 'in your wallet';
  //             setDialogMessage(`NFT found ${locationText}! Joining battle queue...`);
  //             await joinBattle(nftData);
  //             setDialogMessage('Successfully joined battle queue! Waiting for opponent...');
  //           } else {
  //             setDialogMessage('No whitelisted NFT found. Contact admin to whitelist your NFT collection.');
  //           }
  //         } catch (error: any) {
  //           setDialogOpen(true);
  //           setDialogMessage(error.message || 'Failed to join battle');
  //         }
  //       }
  //     } else if (!isConnected) {
  //       setHasScanned(false);
  //     }
  //   }
  //   autoJoinBattle();
  // }, [isConnected, address, battleState, hasScanned, joinBattle, getFirstValidSaplingNft]);

  const handleUseAbility = async (abilityId: number) => {
    if (pendingMoveId !== null) return; // prevent double-click
    if (!battleState || battleState.finished || battleState.winner) {
      showInlineError("Battle not active.");
      return;
    }
    if (!isMyTurn) {
      showInlineError("Not your turn yet — wait for your opponent to move.");
      return;
    }

    setPendingMoveId(abilityId);
    setInlineError(null);
    if (inlineErrorTimer.current) clearTimeout(inlineErrorTimer.current);
    try {
      await useAbility(abilityId);
    } catch (error: any) {
      const msg: string = error.message || "Failed to use ability";
      // Friendly messages for common contract errors
      const lowerMsg = msg.toLowerCase();
      const friendly =
        lowerMsg.includes("e_unauthorized_player") ||
        lowerMsg.includes("unauthorized") ||
        /\b102\b/.test(msg)
          ? "Not your turn yet — wait for your opponent to move."
          : lowerMsg.includes("battle not active") ||
              lowerMsg.includes("e_battle_finished") ||
              lowerMsg.includes("finished") ||
              /\b103\b/.test(msg)
            ? "This battle has already ended."
            : lowerMsg.includes("e_invalid_move") ||
                lowerMsg.includes("invalid_move") ||
                lowerMsg.includes("not available") ||
                /\b109\b/.test(msg)
              ? "That move isn't in your assigned move set."
              : msg;
      showInlineError(friendly);
    } finally {
      setPendingMoveId(null);
    }
  };

  // Clear action log when a new battle starts
  useEffect(() => {
    if (battleState?.battleId) clearActionLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState?.battleId]);

  const isPlayer1 =
    battleState &&
    address &&
    battleState.player1?.toLowerCase() === address.toLowerCase();
  const playerGrowth = battleState
    ? isPlayer1
      ? battleState.player1Growth
      : battleState.player2Growth
    : 0;
  const opponentGrowth = battleState
    ? isPlayer1
      ? battleState.player2Growth
      : battleState.player1Growth
    : 0;
  const growthTarget = battleState?.isBotBattle ? 50 : 100;
  const playerMoves = battleState
    ? isPlayer1
      ? battleState.player1Moves
      : battleState.player2Moves
    : [];

  const winner = battleState?.winner
    ? battleState.winner.toLowerCase() === address?.toLowerCase()
      ? "player"
      : "opponent"
    : null;
  const battleFinished = !!winner || !!battleState?.finished;
  const PLAYER_BATTLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
  const BOT_BATTLE_TIMEOUT_MS = 10 * 60 * 1000;
  const battleTimeoutMs = battleState?.isBotBattle
    ? BOT_BATTLE_TIMEOUT_MS
    : PLAYER_BATTLE_TIMEOUT_MS;
  const timeoutElapsedMs = battleState?.lastMoveMs
    ? Date.now() - battleState.lastMoveMs
    : 0;
  const canClaimTimeout =
    !!battleState &&
    !battleFinished &&
    !isMyTurn &&
    timeoutElapsedMs >= battleTimeoutMs;
  const hasOpponent =
    !!battleState?.player1 &&
    !!battleState.player2 &&
    battleState.player1 !== "0x0" &&
    battleState.player2 !== "0x0";
  const isQueueWaitingMessage =
    /waiting for (opponent|chain update)|joined queue/i.test(dialogMessage);
  const isQueueWaitingDialog = isWaiting && isQueueWaitingMessage;

  useEffect(() => {
    if (hasOpponent && dialogOpen && isQueueWaitingMessage) {
      setDialogOpen(false);
    }
  }, [hasOpponent, dialogOpen, isQueueWaitingMessage]);

  // Trigger animations when growth changes with proper cleanup
  useEffect(() => {
    if (playerGrowth !== prevPlayerGrowth && prevPlayerGrowth !== null) {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }

      setPlayerAnimation("");

      requestAnimationFrame(() => {
        const newAnimation =
          playerGrowth > prevPlayerGrowth ? "grow-green" : "shake";
        setPlayerAnimation(newAnimation);

        playerAnimationTimer.current = setTimeout(() => {
          setPlayerAnimation("");
          playerAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevPlayerGrowth(playerGrowth);
  }, [playerGrowth, prevPlayerGrowth]);

  useEffect(() => {
    if (opponentGrowth !== prevOpponentGrowth && prevOpponentGrowth !== null) {
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }

      setOpponentAnimation("");

      requestAnimationFrame(() => {
        const newAnimation =
          opponentGrowth > prevOpponentGrowth ? "grow-green" : "shake";
        setOpponentAnimation(newAnimation);

        opponentAnimationTimer.current = setTimeout(() => {
          setOpponentAnimation("");
          opponentAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevOpponentGrowth(opponentGrowth);
  }, [opponentGrowth, prevOpponentGrowth]);

  // Fetch opponent's NFT image when battle starts
  useEffect(() => {
    if (battleState && isConnected && address) {
      if (!playerNftImageUrl) {
        getFirstValidSaplingNft(address).then((nft) => {
          if (nft?.imageUrl) {
            setPlayerNftImageUrl(nft.imageUrl);
          }
        });
      }

      const opponentAddress = isPlayer1
        ? battleState.player2
        : battleState.player1;
      if (
        opponentAddress &&
        opponentAddress !== "0x0" &&
        !opponentNftImageUrl
      ) {
        getFirstValidSaplingNft(opponentAddress).then((nft) => {
          if (nft?.imageUrl) {
            setOpponentNftImageUrl(nft.imageUrl);
          }
        });
      }
    }
  }, [
    battleState,
    isConnected,
    address,
    isPlayer1,
    playerNftImageUrl,
    opponentNftImageUrl,
    getFirstValidSaplingNft,
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }
      if (inlineErrorTimer.current) {
        clearTimeout(inlineErrorTimer.current);
      }
    };
  }, []);

  let battleStatus = "Connect wallet to start!";
  if (isWaiting) {
    battleStatus = "Waiting for 2nd player... (Need 2 players total!)";
  } else if (isConnected && !battleState) {
    battleStatus = "Ready to join! Click the button below.";
  } else if (battleState && !battleFinished) {
    battleStatus = canClaimTimeout
      ? "Opponent has been idle for too long — you may claim timeout victory."
      : isMyTurn
        ? "Your turn! Choose a move."
        : battleState.isBotBattle
          ? "Garden Bot is thinking..."
          : "Waiting for your opponent to move.";
  } else if (winner) {
    battleStatus =
      winner === "player"
        ? "You Win!"
        : battleState?.isBotBattle
          ? "Garden Bot Wins!"
          : "Opponent Wins!";
  } else if (battleState?.finished) {
    battleStatus = "Battle ended.";
  }

  // Check if user is admin to show admin panel
  const isAdmin =
    address &&
    SUI_CONFIG.ADMIN_ADDRESSES.some(
      (adminAddr) => adminAddr.toLowerCase() === address.toLowerCase(),
    );

  return (
    <>
      <style>{`
  @keyframes pulseGlow {
    from { box-shadow: 0 0 20px #00ff00; }
    to { box-shadow: 0 0 40px #00ff00, 0 0 60px #00ff00; }
  }
  @keyframes explodeAndShrink {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideInLog {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .battle-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: clamp(8px, 2vw, 20px);
    max-width: 100%;
    margin: 20px auto;
    padding: 0 clamp(8px, 2vw, 15px);
    align-items: start;
    justify-items: center;
  }

  @media (max-width: 640px) {
    .battle-grid {
      gap: clamp(4px, 1.5vw, 12px);
      padding: 0 clamp(4px, 1.5vw, 8px);
    }

    .player-card,
    .opponent-card {
      max-width: 140px;
    }

    .nft-wrapper {
      max-width: 120px;
      aspect-ratio: 5 / 7;
    }

    .nft-wrapper img {
      max-width: 90%;
      max-height: 90%;
    }

    .vs-element {
      font-size: clamp(24px, 7vw, 36px);
    }

    .health-bar,
    .growth-text {
      max-width: 120px;
      font-size: clamp(10px, 2.5vw, 13px);
    }
  }

  @media (max-width: 360px) {
    .player-card,
    .opponent-card { max-width: 115px; }
    .nft-wrapper { max-width: 100px; }
    .vs-element { font-size: clamp(20px, 6vw, 30px); }
  }
`}</style>
      <div
        style={{
          backgroundImage: "url(/assets/background4.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#000",
          color: "white",
          textAlign: "center",
          fontFamily: "Orbitron, sans-serif",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "clamp(10px, 2vw, 15px) clamp(15px, 3vw, 30px)",
            background: "rgba(0, 50, 0, 0.8)",
            borderBottom: "2px solid #00ff00",
            boxShadow: "0 0 15px #00ff00",
            position: "relative",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <Link href="/">
            <img
              src="/assets/thick.png"
              alt="Thickquidity Logo"
              style={{
                width: "clamp(60px, 10vw, 80px)",
                cursor: "pointer",
                filter: "drop-shadow(0 0 15px #00ff00)",
                transition: "transform 0.3s ease, filter 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.filter = "drop-shadow(0 0 25px #00cc00)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "drop-shadow(0 0 15px #00ff00)";
              }}
              data-testid="logo-home"
            />
          </Link>

          <nav
            style={{
              display: "flex",
              gap: "clamp(8px, 2vw, 10px)",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/"
              style={{
                color: "#00ff00",
                margin: "0",
                textDecoration: "none",
                fontSize: "clamp(14px, 2.5vw, 16px)",
                transition: "color 0.3s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#00cc00")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#00ff00")}
              data-testid="link-home"
            >
              Home
            </Link>
            <Link
              href="/mint"
              style={{
                color: "#00ff00",
                margin: "0",
                textDecoration: "none",
                fontSize: "clamp(14px, 2.5vw, 16px)",
                transition: "color 0.3s ease",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#00cc00")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#00ff00")}
              data-testid="link-arboretum"
            >
              Arboretum
            </Link>
          </nav>

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleForceRefund}
              disabled={!isConnected || isRefunding}
              style={{
                padding: "clamp(8px, 2vw, 10px) clamp(12px, 3vw, 20px)",
                background: isRefunding
                  ? "rgba(100, 100, 100, 0.5)"
                  : "linear-gradient(45deg, #cc0000, #ff3333)",
                color: "#fff",
                border: "2px solid #ff0000",
                borderRadius: "8px",
                fontSize: "clamp(12px, 2.5vw, 14px)",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: "bold",
                cursor: !isConnected || isRefunding ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                boxShadow: isRefunding
                  ? "none"
                  : "0 0 10px rgba(255, 0, 0, 0.6)",
                opacity: !isConnected || isRefunding ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
              data-testid="button-emergency-refund"
            >
              {isRefunding ? "Processing..." : "Get Refund"}
            </button>
            <ConnectButton connectText="Connect Wallet" />
          </div>
        </header>

        {/* 2-Player Warning Banner */}
        {!battleState && isWaiting && (
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 165, 0, 0.9), rgba(255, 69, 0, 0.9))",
              color: "#fff",
              padding: "clamp(12px, 3vw, 20px)",
              margin: "0 auto",
              maxWidth: "95%",
              width: "800px",
              borderRadius: "12px",
              border: "3px solid #ff6600",
              boxShadow: "0 0 30px rgba(255, 102, 0, 0.8)",
              marginTop: "20px",
              marginBottom: "10px",
              textAlign: "center",
            }}
            data-testid="warning-need-2-players"
          >
            <h2
              style={{
                fontSize: "clamp(14px, 3.5vw, 24px)",
                margin: "0 0 10px 0",
                fontFamily: "Orbitron, sans-serif",
                textShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
              }}
            >
              WAITING FOR 2ND PLAYER
            </h2>
            <p
              style={{
                fontSize: "clamp(11px, 2.5vw, 18px)",
                margin: "8px 0",
                lineHeight: "1.5",
              }}
            >
              <strong>Battles require 2 players total!</strong>
              <br />
              You have paid {entryFeeLabel} and are in the queue.
              <br />A 2nd player must join to start the battle.
            </p>
            <p
              style={{
                fontSize: "clamp(10px, 2.2vw, 16px)",
                margin: "12px 0 0 0",
                opacity: 0.9,
              }}
            >
              Tip: Get a friend to join with a different wallet, OR click "Get
              Refund" above to get your 3 SUI back.
            </p>
          </div>
        )}

        {/* Title Image with animation */}
        <img
          src="/assets/garden.png"
          alt="The Garden Battles"
          className="title-image"
          style={{
            width: "100%",
            maxWidth: "680px",
            height: "auto",
            maxHeight: "300px",
            margin: "25px auto 10px",
            display: "block",
            animation: "explodeAndShrink 2s ease-out forwards",
          }}
          data-testid="img-battle-title"
        />
        {/* How to Play */}
        <HowToPlay />

        {/* Battle Area */}
        <div className="battle-grid">
          {/* Player 1 NFT */}
          <div
            className="player-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "280px",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                padding: "5px 12px",
                border: "1px solid #00ffcc",
                borderRadius: "6px",
                background: "rgba(0, 45, 40, 0.9)",
                color: "#baffee",
                fontWeight: "bold",
                fontSize: "13px",
                textTransform: "uppercase",
              }}
            >
              You
            </div>
            <div
              className={playerAnimation}
              style={{
                width: "100%",
                aspectRatio: "5/7",
                maxWidth: "240px",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow:
                  winner === "player"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #ff0000",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                marginBottom: "10px",
                zIndex: 1,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 0 30px #00ff00";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  winner === "player"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #ff0000";
              }}
              data-testid="nft-card-player"
            >
              <img
                src={getNFTImage(playerGrowth, playerNftImageUrl || undefined)}
                alt="Player 1 Sapling"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  borderRadius: "10px",
                }}
                data-testid="nft-image-player"
              />
              {winner === "player" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  <Trophy
                    style={{
                      width: "96px",
                      height: "96px",
                      color: "#00ff00",
                      filter: "drop-shadow(0 0 20px #00ff00)",
                    }}
                  />
                </div>
              )}
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(11px, 2.5vw, 13px)",
                color: "#00ffcc",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              🌱 Your Growth
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: "240px",
                height: "18px",
                background: "rgba(0, 0, 0, 0.8)",
                borderRadius: "6px",
                padding: "2px",
                display: "block",
                zIndex: 0,
                margin: "4px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (playerGrowth / growthTarget) * 100)}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-player"
              />
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(13px, 3vw, 17px)",
                fontWeight: "bold",
                color: "#00ff00",
              }}
              data-testid="text-growth-player"
            >
              {playerGrowth} / {growthTarget}
            </p>
          </div>

          {/* VS - Centered on mobile */}
          <div
            className="vs-element"
            style={{
              fontSize: "clamp(32px, 8vw, 48px)",
              color: "#00ff00",
              textShadow: "0 0 10px #00ff00",
              fontFamily: "FantasyBattles, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
            data-testid="text-vs"
          >
            VS
          </div>

          {/* Player 2 NFT */}
          <div
            className="opponent-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "280px",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                padding: "5px 12px",
                border: "1px solid #ff9944",
                borderRadius: "6px",
                background: "rgba(70, 30, 0, 0.9)",
                color: "#ffd2ad",
                fontWeight: "bold",
                fontSize: "13px",
                textTransform: "uppercase",
              }}
            >
              {battleState?.isBotBattle ? "Garden Bot" : "Opponent"}
            </div>
            <div
              className={opponentAnimation}
              style={{
                width: "100%",
                aspectRatio: "5/7",
                maxWidth: "240px",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow:
                  winner === "opponent"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #00ff00",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                marginBottom: "10px",
                zIndex: 1,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 0 30px #00ff00";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  winner === "opponent"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #00ff00";
              }}
              data-testid="nft-card-opponent"
            >
              <img
                src={getNFTImage(
                  opponentGrowth,
                  opponentNftImageUrl || undefined,
                )}
                alt="Player 2 Sapling"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  borderRadius: "10px",
                }}
                data-testid="nft-image-opponent"
              />
              {winner === "opponent" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  <Trophy
                    style={{
                      width: "96px",
                      height: "96px",
                      color: "#00ff00",
                      filter: "drop-shadow(0 0 20px #00ff00)",
                    }}
                  />
                </div>
              )}
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(11px, 2.5vw, 13px)",
                color: "#ff9944",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              🌿{" "}
              {battleState?.isBotBattle
                ? "Garden Bot Growth"
                : "Opponent Growth"}
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: "240px",
                height: "18px",
                background: "rgba(0, 0, 0, 0.8)",
                borderRadius: "6px",
                padding: "2px",
                display: "block",
                zIndex: 0,
                margin: "4px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (opponentGrowth / growthTarget) * 100)}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-opponent"
              />
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(13px, 3vw, 17px)",
                fontWeight: "bold",
                color: "#ff9944",
              }}
              data-testid="text-growth-opponent"
            >
              {opponentGrowth} / {growthTarget}
            </p>
          </div>
        </div>

        {/* Battle Options — Color-coded move cards */}
        {playerMoves.length > 0 && battleState && !battleState.finished && (
          <div
            style={{
              margin: "15px auto",
              maxWidth: "95%",
              width: "760px",
              fontFamily: "Orbitron, sans-serif",
            }}
            data-testid="battle-options"
          >
            {/* Turn indicator */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "10px",
                padding: "8px 16px",
                borderRadius: "8px",
                background:
                  pendingMoveId !== null
                    ? "rgba(80,60,0,0.7)"
                    : "rgba(0,40,80,0.7)",
                border: `1px solid ${pendingMoveId !== null ? "#ffcc00" : "#44aaff"}`,
                color: pendingMoveId !== null ? "#ffcc00" : "#88ccff",
                fontSize: "clamp(11px, 2.5vw, 14px)",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                transition: "all 0.3s ease",
              }}
            >
              {winner
                ? `🏆 Battle Over!`
                : pendingMoveId !== null
                  ? `⏳ Waiting for transaction... (${MOVE_LABELS[pendingMoveId] || "Move"})`
                  : !isMyTurn
                    ? `⏳ Waiting for your opponent...`
                    : `⏳ Choose your move — each turn = 1 wallet confirmation`}
            </div>

            {actionLog.length > 0 && (() => {
              const latest = actionLog[actionLog.length - 1];
              const playerDelta =
                latest.nextPlayerGrowth - latest.prevPlayerGrowth;
              const opponentDelta =
                latest.nextOpponentGrowth - latest.prevOpponentGrowth;
              const messages = [
                playerDelta > 0 ? `You gained +${playerDelta} growth` : null,
                playerDelta < 0
                  ? `Your tree lost ${Math.abs(playerDelta)} growth`
                  : null,
                opponentDelta < 0
                  ? `Opponent lost ${Math.abs(opponentDelta)} growth`
                  : null,
                opponentDelta > 0
                  ? `Opponent gained +${opponentDelta} growth`
                  : null,
              ].filter(Boolean);
              return (
                <div
                  role="status"
                  style={{
                    marginBottom: "10px",
                    padding: "10px 14px",
                    border: "1px solid #00cc88",
                    borderRadius: "8px",
                    background: "rgba(0, 70, 55, 0.82)",
                    color: "#d8fff2",
                    textAlign: "center",
                    fontSize: "clamp(11px, 2.5vw, 14px)",
                    fontWeight: "bold",
                  }}
                >
                  {messages.length > 0
                    ? messages.join(" · ")
                    : "The move was blocked or had no growth effect"}
                </div>
              );
            })()}

            {/* Inline error banner */}
            {inlineError && (
              <div
                style={{
                  background: "rgba(150,0,0,0.7)",
                  border: "1px solid #ff4444",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  marginBottom: "10px",
                  color: "#ffaaaa",
                  fontSize: "clamp(11px, 2.5vw, 13px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>⚠️</span>
                <span>{inlineError}</span>
                <button
                  onClick={() => setInlineError(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#ff8888",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                    padding: "0 4px",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Move card grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
              }}
            >
              {playerMoves.map((moveId) => {
                const meta = MOVE_META[moveId];
                const isAttack = meta?.type === "attack";
                const isGrowth = meta?.type === "growth";
                const isHybrid = meta?.type === "hybrid";
                const isPending = pendingMoveId === moveId;
                const isDisabled =
                  battleFinished || pendingMoveId !== null || !isMyTurn;

                const borderColor = isGrowth
                  ? "#00ff88"
                  : isHybrid
                    ? "#ffaa33"
                    : "#ff5544";
                const bgBase = isGrowth
                  ? "rgba(0,80,30,0.75)"
                  : isHybrid
                    ? "rgba(80,40,0,0.75)"
                    : "rgba(80,0,0,0.75)";
                const badgeColor = isGrowth
                  ? "#00ff88"
                  : isHybrid
                    ? "#ffaa33"
                    : "#ff5544";
                const badgeLabel = isGrowth
                  ? "GROWTH"
                  : isHybrid
                    ? "HYBRID"
                    : "ATTACK";

                return (
                  <button
                    key={moveId}
                    onClick={() => handleUseAbility(moveId)}
                    disabled={isDisabled}
                    style={{
                      background: isPending ? "rgba(200,160,0,0.3)" : bgBase,
                      border: `2px solid ${borderColor}`,
                      borderRadius: "10px",
                      padding: "12px 10px",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled && !isPending ? 0.5 : 1,
                      textAlign: "left",
                      transition: "all 0.2s ease",
                      boxShadow: isPending
                        ? `0 0 16px ${borderColor}`
                        : `0 0 6px ${borderColor}40`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = `0 0 20px ${borderColor}`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = `0 0 6px ${borderColor}40`;
                    }}
                    data-testid={`button-ability-${moveId}`}
                  >
                    {/* Badge */}
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "bold",
                        color: badgeColor,
                        fontFamily: "Orbitron, sans-serif",
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                      }}
                    >
                      {meta?.emoji} {badgeLabel}
                    </span>
                    {/* Name */}
                    <span
                      style={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "clamp(11px, 2.5vw, 13px)",
                        fontWeight: "bold",
                        color: "#fff",
                        lineHeight: "1.3",
                      }}
                    >
                      {isPending ? "⏳ " : ""}
                      {MOVE_LABELS[moveId] || `Move ${moveId}`}
                    </span>
                    {/* Effect description */}
                    {meta?.effect && (
                      <span
                        style={{
                          fontSize: "clamp(10px, 2vw, 11px)",
                          color: "rgba(255,255,255,0.65)",
                          fontFamily: "Orbitron, sans-serif",
                          lineHeight: "1.4",
                        }}
                      >
                        {meta.effect}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {(battleState && !battleFinished) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "18px",
                }}
              >
                <button
                  onClick={handleForfeitBattle}
                  disabled={isForfeiting}
                  style={{
                    padding: "14px 18px",
                    borderRadius: "10px",
                    border: "2px solid #ff4444",
                    background: isForfeiting
                      ? "rgba(100, 0, 0, 0.5)"
                      : "linear-gradient(45deg, #ff4444, #aa0000)",
                    color: isForfeiting ? "#ccc" : "#fff",
                    cursor: isForfeiting ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    boxShadow: isForfeiting
                      ? "none"
                      : "0 0 18px rgba(255, 68, 68, 0.45)",
                  }}
                >
                  {isForfeiting ? "Forfeiting..." : "Forfeit Battle"}
                </button>
                {canClaimTimeout && (
                  <button
                    onClick={handleClaimTimeout}
                    disabled={isClaimingTimeout}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid #ffcc00",
                      background: isClaimingTimeout
                        ? "rgba(100, 100, 0, 0.5)"
                        : "linear-gradient(45deg, #ffcc00, #ffdd55)",
                      color: isClaimingTimeout ? "#333" : "#000",
                      cursor: isClaimingTimeout ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxShadow: isClaimingTimeout
                        ? "none"
                        : "0 0 18px rgba(255, 204, 0, 0.55)",
                    }}
                  >
                    {isClaimingTimeout ? "Claiming..." : "Claim Timeout Win"}
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={handleAdminForceClose}
                    disabled={isAdminClosing}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid #00ccff",
                      background: isAdminClosing
                        ? "rgba(0, 100, 150, 0.5)"
                        : "linear-gradient(45deg, #00ccff, #00aaff)",
                      color: isAdminClosing ? "#ccc" : "#000",
                      cursor: isAdminClosing ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxShadow: isAdminClosing
                        ? "none"
                        : "0 0 18px rgba(0, 204, 255, 0.45)",
                    }}
                  >
                    {isAdminClosing ? "Closing..." : "Admin Force Close"}
                  </button>
                )}
              </div>
            )}

            {/* Battle Log */}
            <div
              style={{
                marginTop: "16px",
                background: "rgba(0,10,30,0.8)",
                border: "1px solid rgba(0,200,255,0.25)",
                borderRadius: "10px",
                padding: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(0,200,255,0.6)",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: "6px",
                }}
              >
                📜 Battle Log
              </div>
              <BattleLog entries={actionLog} isPlayer1={!!isPlayer1} />
            </div>
          </div>
        )}

        {/* Join Battle Button - Show when connected and not in an active battle/queue */}
        {isConnected && (!battleState || battleFinished) && !isWaiting && (
          <div style={{ margin: "20px auto", textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={handleJoinBattle}
                disabled={isJoining || isStartingBot}
                style={{
                  padding: "20px 34px",
                  background: isJoining
                    ? "rgba(100, 100, 100, 0.5)"
                    : "linear-gradient(45deg, #00ff00, #00cc00)",
                  color: isJoining ? "#666" : "#000",
                  border: "3px solid #00ff00",
                  borderRadius: "12px",
                  fontSize: "clamp(15px, 3.6vw, 22px)",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: "bold",
                  cursor:
                    isJoining || isStartingBot ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  boxShadow: isJoining
                    ? "none"
                    : "0 0 30px rgba(0, 255, 0, 0.8)",
                  opacity: isJoining || isStartingBot ? 0.5 : 1,
                  transition: "all 0.3s ease",
                  animation: isJoining
                    ? "none"
                    : "pulseGlow 2s infinite alternate",
                }}
                onMouseEnter={(e) => {
                  if (!isJoining && !isStartingBot) {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow =
                      "0 0 40px rgba(0, 255, 0, 1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 0 30px rgba(0, 255, 0, 0.8)";
                }}
                data-testid="button-join-battle"
              >
                {isJoining
                  ? "Joining..."
                  : `Join Battle Queue (${entryFeeLabel})`}
              </button>
              <button
                onClick={handleStartBotBattle}
                disabled={isJoining || isStartingBot}
                style={{
                  padding: "20px 34px",
                  background: isStartingBot
                    ? "rgba(100, 100, 100, 0.5)"
                    : "linear-gradient(45deg, #00ccff, #00ffcc)",
                  color: isStartingBot ? "#666" : "#001b1b",
                  border: "3px solid #00ffcc",
                  borderRadius: "12px",
                  fontSize: "clamp(15px, 3.6vw, 22px)",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: "bold",
                  cursor:
                    isJoining || isStartingBot ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  boxShadow: isStartingBot
                    ? "none"
                    : "0 0 30px rgba(0, 255, 204, 0.75)",
                  opacity: isJoining || isStartingBot ? 0.5 : 1,
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isJoining && !isStartingBot) {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow =
                      "0 0 40px rgba(0, 255, 204, 1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 0 30px rgba(0, 255, 204, 0.75)";
                }}
                data-testid="button-start-bot-battle"
              >
                {isStartingBot ? "Starting..." : "Play Garden Bot"}
              </button>
            </div>
            <p
              style={{
                marginTop: "15px",
                fontSize: "clamp(12px, 3vw, 16px)",
                color: "#00ffcc",
                maxWidth: "600px",
                margin: "15px auto 0",
                padding: "0 15px",
              }}
            >
              Join the paid player queue, or start a no-payout practice battle
              with Garden Bot.
            </p>
          </div>
        )}

        {/* Battle Info */}
        <p
          style={{
            margin: "15px 0",
            fontSize: "clamp(14px, 3.5vw, 20px)",
            color: "#00ffcc",
            padding: "0 15px",
          }}
          data-testid="text-entry-fee"
        >
          {entryFeeLabel} per Battle
        </p>
        <p
          style={{
            marginTop: "15px",
            fontSize: "clamp(14px, 3.5vw, 20px)",
            color: "#ffff00",
            padding: "0 15px",
          }}
          data-testid="text-battle-status"
        >
          {battleStatus}
        </p>

        {/* Game Info Section */}
        <div
          style={{
            margin: "clamp(15px, 4vw, 25px) auto",
            maxWidth: "900px",
            padding: "clamp(15px, 4vw, 25px)",
            background: "rgba(0, 50, 0, 0.8)",
            border: "2px solid #00ff00",
            borderRadius: "15px",
            boxShadow: "0 0 15px #00ff00",
            textAlign: "left",
          }}
        >
          <h2
            style={{
              color: "#00ff00",
              textShadow: "0 0 5px #00ff00",
              marginBottom: "15px",
              fontFamily: "FantasyBattles, sans-serif",
              fontSize: "clamp(16px, 4vw, 24px)",
            }}
          >
            Gameplay: The Garden Battles
          </h2>
          <p
            style={{
              color: "#00ffcc",
              fontSize: "clamp(12px, 3vw, 18px)",
              lineHeight: "1.5",
              marginBottom: "15px",
            }}
          >
            Welcome to The Garden Battles by Thickquidity, a thrilling 1v1
            strategy game powered by the Sui blockchain! To participate, you
            must hold a Sapling NFT from our official issuer. Engage in
            turn-based battles where your NFT grows from a seed to a full tree
            as you increase your Growth points. PvP battles finish at 100
            Growth; practice battles against Garden Bot finish at 50.
          </p>
          <ul
            style={{
              listStyleType: "disc",
              marginLeft: "20px",
              color: "#00ffcc",
              fontSize: "clamp(11px, 2.8vw, 16px)",
            }}
          >
            <li style={{ marginBottom: "10px" }}>
              <strong>NFT Requirement</strong>: Hold a Sapling NFT to access
              battles.
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Entry Fee</strong>: Each battle costs {entryFeeLabel}.
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Rewards</strong>: The winner receives 5 SUI, with 1 SUI
              supporting Thickquidity's token buyback program.
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Gameplay</strong>: Each player is randomly assigned four
              moves per battle—two to reduce the opponent's Growth (e.g., Thorn
              Spike Bomb, Razor Leaf Sword) and two to boost their own (e.g.,
              Sun Beam, Photosynthetic Surge).
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Visuals</strong>: Watch your NFT evolve from seed (0-25
              Growth) to sapling (26-50), mature sapling (51-75), and full tree
              (76-100).
            </li>
          </ul>

          <h2
            style={{
              color: "#00ff00",
              textShadow: "0 0 5px #00ff00",
              marginTop: "25px",
              marginBottom: "15px",
              fontFamily: "FantasyBattles, sans-serif",
              fontSize: "clamp(16px, 4vw, 24px)",
            }}
          >
            Explore The Arboretum
          </h2>
          <Link
            href="/mint"
            style={{
              display: "inline-block",
              color: "#00ffcc",
              fontSize: "clamp(14px, 3.5vw, 22px)",
              marginBottom: "15px",
              textDecoration: "underline",
              fontWeight: "bold",
            }}
          >
            Click here to Mint your Sapling NFT and join the Arboretum!
          </Link>
          <p
            style={{
              color: "#00ffcc",
              fontSize: "clamp(12px, 3vw, 18px)",
              lineHeight: "1.5",
              marginBottom: "15px",
            }}
          >
            Get ready for Phase 2 of The Garden Battles, launching in Q4 2025
            with the introduction of The Arboretum! This exciting expansion
            brings dynamic NFT utility, unlocking massive rewards for Sapling
            NFT holders. Stay tuned for new gameplay mechanics, enhanced
            strategies, and opportunities to grow your rewards in the lush,
            competitive world of The Arboretum.
          </p>
          <ul
            style={{
              listStyleType: "disc",
              marginLeft: "20px",
              color: "#00ffcc",
              fontSize: "clamp(11px, 2.8vw, 16px)",
            }}
          >
            <li style={{ marginBottom: "10px" }}>
              <strong>Dynamic NFT Utility</strong>: Your Sapling NFTs will
              unlock new abilities and perks.
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Massive Rewards</strong>: Compete for exclusive prizes and
              boosted payouts.
            </li>
            <li style={{ marginBottom: "10px" }}>
              <strong>Launch</strong>: Expected in Q4 2025—join our community
              for updates!
            </li>
          </ul>
        </div>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "25px",
            background: "rgba(0, 50, 0, 0.8)",
            borderTop: "2px solid #00ff00",
            boxShadow: "0 0 15px #00ff00",
            position: "relative",
          }}
        >
          <a
            href="https://t.me/cryptoarborist"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#00ffcc",
              textDecoration: "none",
              transition: "color 0.3s ease, text-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00ffff";
              e.currentTarget.style.textShadow =
                "0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#00ffcc";
              e.currentTarget.style.textShadow = "none";
            }}
          >
            Powered by $TREE on SUI
          </a>
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              right: "15px",
              fontSize: "13px",
              color: "#00ff00",
              opacity: 0.7,
            }}
          >
            © 2025 Thickquidity
          </div>
        </footer>

        <BattleDialog
          isOpen={dialogOpen}
          message={dialogMessage}
          onClose={() => setDialogOpen(false)}
          canClose={!isQueueWaitingDialog}
        />
        <WaitingOverlay isWaiting={isWaiting} onLeaveQueue={cancelQueue} />

        <AdminPanel
          adminAddresses={SUI_CONFIG.ADMIN_ADDRESSES}
          currentAddress={address || null}
        />

        {/* Arboretum Coming Soon Modal */}
        {arboretumModalOpen && (
          <div
            onClick={() => setArboretumModalOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.9)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(1rem, 3vw, 2rem)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                width: "clamp(300px, 90vw, 600px)",
                background:
                  "linear-gradient(rgba(0, 50, 0, 0.95), rgba(0, 80, 0, 0.95))",
                border: "3px solid #00ff00",
                borderRadius: "10px",
                boxShadow: "0 0 30px rgba(0, 255, 0, 0.6)",
                padding: "clamp(2rem, 5vw, 3rem)",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                  color: "#00ff00",
                  marginBottom: "clamp(1rem, 3vw, 1.5rem)",
                  textShadow: "0 0 10px rgba(0, 255, 0, 0.8)",
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                The Arboretum
              </h2>
              <Link
                href="/mint"
                style={{
                  fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
                  color: "#00ffcc",
                  marginBottom: "clamp(1rem, 3vw, 1.5rem)",
                  display: "inline-block",
                  textDecoration: "underline",
                  fontWeight: "bold",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onClick={() => setArboretumModalOpen(false)}
              >
                Mint your Sapling NFT to Enter
              </Link>
              <p
                style={{
                  fontSize: "clamp(0.9rem, 2.2vw, 1rem)",
                  color: "#fff",
                  marginBottom: "clamp(1.5rem, 4vw, 2rem)",
                  lineHeight: "1.6",
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                The Arboretum is your gateway to explore, collect, and nurture
                your NFT forest. Mint your unique Sapling now to unlock
                exclusive features and community-driven growth!
              </p>
              <button
                onClick={() => setArboretumModalOpen(false)}
                style={{
                  background: "linear-gradient(45deg, #00ff00, #00cc00)",
                  color: "#000",
                  padding:
                    "clamp(0.6rem, 1.8vw, 0.8rem) clamp(1.2rem, 2.8vw, 2rem)",
                  borderRadius: "9999px",
                  border: "2px solid #00ff00",
                  fontWeight: "bold",
                  fontSize: "clamp(0.8rem, 2.2vw, 1rem)",
                  cursor: "pointer",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  boxShadow: "0 0 15px rgba(0, 255, 0, 0.6)",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.boxShadow = "0 0 25px #00ff00";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 0 15px rgba(0, 255, 0, 0.6)";
                }}
                data-testid="button-close-arboretum"
              >
                Got it!
              </button>
              <button
                onClick={() => setArboretumModalOpen(false)}
                style={{
                  position: "absolute",
                  top: "clamp(10px, 2vw, 15px)",
                  right: "clamp(10px, 2vw, 15px)",
                  width: "clamp(30px, 8vw, 40px)",
                  height: "clamp(30px, 8vw, 40px)",
                  background: "rgba(0, 50, 0, 0.8)",
                  color: "#00ff00",
                  borderRadius: "50%",
                  border: "2px solid #00ff00",
                  fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
                  cursor: "pointer",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.boxShadow = "0 0 15px #00ff00";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "";
                }}
                data-testid="button-close-arboretum-x"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
