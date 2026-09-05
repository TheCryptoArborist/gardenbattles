export function formatGardenBotStartFailureMessage(message: string): string {
  const detail = message.trim();
  const lower = detail.toLowerCase();

  if (lower.includes("timed out waiting")) {
    return "Timed out waiting for the Garden Bot battle to start. Please try again.";
  }
  if (lower.includes("could not scan your nftrees")) {
    return "Could not scan your NFTrees because the Sui RPC request failed. Wait a moment and try again.";
  }
  if (lower.includes("did not refresh")) {
    return "Battle transaction confirmed, but the game did not refresh. Try Refresh Battle.";
  }
  if (/reject|cancel|denied|declined/.test(lower)) {
    return "Start cancelled in wallet.";
  }
  if (lower.includes("fifth card is unlocked")) {
    return detail;
  }
  if (/failed to fetch|fetch failed|load failed|network|transport/.test(lower)) {
    return "The Garden Bot battle could not reach the Sui network. No battle was created. Check your connection and try again.";
  }
  if (/insufficient.*gas|gas.*insufficient/.test(lower)) {
    return "The wallet needs more SUI for network gas before this Garden Bot battle can start.";
  }
  return detail
    ? `Garden Bot could not start. Wallet or network detail: ${detail}`
    : "Could not start Garden Bot battle. Try again.";
}
