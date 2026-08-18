function compactMessage(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[rpc-url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function isWalletCancelMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("reject") ||
    lowerMessage.includes("cancel") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("declined")
  );
}

export function formatPvpJoinFailureMessage(message: string) {
  const safeMessage = compactMessage(message);
  const lowerMessage = safeMessage.toLowerCase();
  const failedAfterWalletApproval = lowerMessage.includes(
    "pvp queue transaction failed after wallet approval",
  );

  if (lowerMessage.includes("this match type is not active yet")) {
    return "This match type is not active yet.";
  }

  if (lowerMessage.includes("could not scan your nftrees")) {
    return "Could not scan your NFTrees because the Sui RPC request failed. Wait a moment and try again.";
  }

  if (isWalletCancelMessage(lowerMessage)) {
    return "Queue join cancelled in wallet.";
  }

  if (lowerMessage.includes("insufficient balance")) {
    return safeMessage;
  }

  if (lowerMessage.includes("wallet not connected")) {
    return "Wallet not connected. Reconnect your wallet and try again.";
  }

  if (lowerMessage.includes("random object not initialised")) {
    return "Sui randomness is still loading. Wait a moment and try again.";
  }

  if (/\b101\b/.test(lowerMessage) || lowerMessage.includes("enftnotwhitelisted")) {
    return "This NFTree collection is not whitelisted for Garden Battles.";
  }

  if (/\b102\b/.test(lowerMessage) || lowerMessage.includes("eunauthorizedplayer")) {
    return "This wallet may already be waiting in that PvP queue. Check Queue Status before trying to join again.";
  }

  if (/\b104\b/.test(lowerMessage) || lowerMessage.includes("einsufficientpayment")) {
    return "The PvP entry payment did not match the on-chain entry fee. Refresh and try again.";
  }

  if (/\b107\b/.test(lowerMessage) || lowerMessage.includes("epaused")) {
    return "Garden Battles is paused on-chain right now.";
  }

  if (/\b112\b/.test(lowerMessage) || lowerMessage.includes("eentryfeechanged")) {
    return "The PvP entry fee changed while joining. Refresh and try again.";
  }

  if (/\b113\b/.test(lowerMessage) || lowerMessage.includes("einvalidtargetgrowth")) {
    return "The selected PvP match length is not active on-chain.";
  }

  if (failedAfterWalletApproval) {
    return "Wallet approval opened, but the queue transaction result could not be confirmed. Check your wallet activity before trying again.";
  }

  if (
    lowerMessage.includes("rate-limiting") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("timeout")
  ) {
    return "The Sui RPC request failed while preparing the queue join. Wait a moment and try again.";
  }

  if (lowerMessage.includes("moveabort") || lowerMessage.includes("move abort")) {
    return `PvP queue join was rejected on-chain: ${safeMessage}`;
  }

  return safeMessage
    ? `Could not join the PvP queue: ${safeMessage}`
    : "Could not join the PvP queue. Try again.";
}
