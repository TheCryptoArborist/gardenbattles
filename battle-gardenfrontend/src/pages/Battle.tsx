import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { ConnectButton } from "@mysten/dapp-kit";
import { useSuiWallet } from "@/hooks/useSuiWallet";
import { MOVE_LABELS, SUI_CONFIG } from "@/lib/sui-config";
import BattleDialog from "@/components/BattleDialog";
import WaitingOverlay from "@/components/WaitingOverlay";
import AdminPanel from "@/components/AdminPanel";

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
    joinBattle,
    useAbility,
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
  const [playerNftImageUrl, setPlayerNftImageUrl] = useState<string | null>(null);
  const [opponentNftImageUrl, setOpponentNftImageUrl] = useState<string | null>(null);

  const playerAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const opponentAnimationTimer = useRef<NodeJS.Timeout | null>(null);

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
        setTimeout(() => setDialogOpen(false), 2000);
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

  const handleForceRefund = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsRefunding(true);
    try {
      await cancelQueue();
      setDialogOpen(true);
      setDialogMessage(`Refund successful! Your ${SUI_CONFIG.ENTRY_FEE / 1e9} SUI has been returned.`);
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Refund failed: ${error.message}`);
    } finally {
      setIsRefunding(false);
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
    try {
      await useAbility(abilityId);
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(error.message || "Failed to use ability");
    }
  };

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
      const opponentAddress = isPlayer1 ? battleState.player2 : battleState.player1;
      if (opponentAddress && opponentAddress !== "0x0" && !opponentNftImageUrl) {
        getFirstValidSaplingNft(opponentAddress).then(nft => {
          if (nft?.imageUrl) {
            setOpponentNftImageUrl(nft.imageUrl);
          }
        });
      }
    }
  }, [battleState, isConnected, address, isPlayer1, opponentNftImageUrl, getFirstValidSaplingNft]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }
    };
  }, []);

  let battleStatus = "Connect wallet to start!";
  if (isWaiting) {
    battleStatus = "Waiting for 2nd player... (Need 2 players total!)";
  } else if (isConnected && !battleState) {
    battleStatus = "Ready to join! Click the button below.";
  } else if (battleState && !winner) {
    battleStatus = "Battle in progress! Use your moves!";
  } else if (winner) {
    battleStatus = winner === "player" ? "You Win!" : "Opponent Wins!";
  }

  // Check if user is admin to show admin panel
  const isAdmin =
    address &&
    [
      "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4",
      "0x8d73665b159d406d1bd208782cbba5304900ecafbde23f957f77843b5ea06961",
    ].some((adminAddr) => adminAddr.toLowerCase() === address.toLowerCase());

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
              You have paid {SUI_CONFIG.ENTRY_FEE / 1e9} SUI and are in the queue.
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
                margin: "8px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${playerGrowth}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-player"
              />
            </div>
            <p
              style={{ marginTop: "8px", fontSize: "clamp(12px, 3vw, 16px)" }}
              data-testid="text-growth-player"
            >
              Your Growth: {playerGrowth}
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
                src={getNFTImage(opponentGrowth, opponentNftImageUrl || undefined)}
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
                margin: "8px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${opponentGrowth}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-opponent"
              />
            </div>
            <p
              style={{ marginTop: "8px", fontSize: "clamp(12px, 3vw, 16px)" }}
              data-testid="text-growth-opponent"
            >
              Opponent Growth: {opponentGrowth}
            </p>
          </div>
        </div>

        {/* Battle Options */}
        {playerMoves.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px",
              padding: "15px 10px",
              background: "rgba(0, 50, 0, 0.8)",
              border: "2px solid #00ff00",
              borderRadius: "12px",
              margin: "15px auto",
              maxWidth: "95%",
              width: "700px",
              maxHeight: "200px",
              overflowY: "auto",
              position: "relative",
              boxShadow: "0 0 15px #00ff00",
            }}
            data-testid="battle-options"
          >
            {playerMoves.map((moveId) => (
              <button
                key={moveId}
                onClick={() => handleUseAbility(moveId)}
                disabled={winner !== null}
                style={{
                  padding: "clamp(8px, 2vw, 12px) clamp(12px, 3vw, 24px)",
                  border: "2px solid #00ff00",
                  background: "transparent",
                  color: "white",
                  fontSize: "clamp(14px, 3vw, 18px)",
                  cursor: winner ? "not-allowed" : "pointer",
                  transition: "0.3s ease",
                  boxShadow: "0 0 10px #00ff00",
                  borderRadius: "8px",
                  opacity: winner ? 0.5 : 1,
                  fontFamily: "Orbitron, sans-serif",
                  flex: "1 1 auto",
                  minWidth: "120px",
                }}
                onMouseEnter={(e) => {
                  if (!winner) {
                    e.currentTarget.style.background = "#00ff00";
                    e.currentTarget.style.color = "#000";
                    e.currentTarget.style.boxShadow = "0 0 25px #00ff00";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "white";
                  e.currentTarget.style.boxShadow = "0 0 10px #00ff00";
                }}
                data-testid={`button-ability-${moveId}`}
              >
                {MOVE_LABELS[moveId] || `Move ${moveId}`}
              </button>
            ))}
          </div>
        )}

        {/* Join Battle Button - Only show when connected and not in battle/queue */}
        {isConnected && !battleState && !isWaiting && (
          <div style={{ margin: "20px auto", textAlign: "center" }}>
            <button
              onClick={handleJoinBattle}
              disabled={isJoining}
              style={{
                padding: "20px 40px",
                background: isJoining
                  ? "rgba(100, 100, 100, 0.5)"
                  : "linear-gradient(45deg, #00ff00, #00cc00)",
                color: isJoining ? "#666" : "#000",
                border: "3px solid #00ff00",
                borderRadius: "12px",
                fontSize: "clamp(16px, 4vw, 24px)",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: "bold",
                cursor: isJoining ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                boxShadow: isJoining ? "none" : "0 0 30px rgba(0, 255, 0, 0.8)",
                opacity: isJoining ? 0.5 : 1,
                transition: "all 0.3s ease",
                animation: isJoining
                  ? "none"
                  : "pulseGlow 2s infinite alternate",
              }}
              onMouseEnter={(e) => {
                if (!isJoining) {
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
              {isJoining ? "Joining..." : `Join Battle Queue (${SUI_CONFIG.ENTRY_FEE / 1e9} SUI)`}
            </button>
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
              Click to scan for your NFT and join the matchmaking queue
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
          {SUI_CONFIG.ENTRY_FEE / 1e9} SUI per Battle
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
            as you increase your Growth points. The first player to reach 100
            Growth wins!
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
              <strong>Entry Fee</strong>: Each battle costs {SUI_CONFIG.ENTRY_FEE / 1e9} SUI.
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
                The Arboretum is your gateway to explore, collect, and
                nurture your NFT forest. Mint your unique Sapling now to unlock 
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
