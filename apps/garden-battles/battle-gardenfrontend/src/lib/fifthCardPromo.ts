export type FifthCardPromoStatus =
  | "not-connected"
  | "checking"
  | "qualified"
  | "not-qualified"
  | "verification-incomplete"
  | "unavailable";

export type FifthCardPromoPresentation = {
  tone: "disconnected" | "checking" | "qualified" | "not-qualified" | "unavailable";
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  badge: "+1" | "check" | "wallet" | "checking" | "alert";
};

export function getFifthCardPromoPresentation(
  status: FifthCardPromoStatus,
): FifthCardPromoPresentation {
  switch (status) {
    case "qualified":
      return {
        tone: "qualified",
        eyebrow: "TREE Holder Battle Advantage",
        title: "Fifth Battle Card Unlocked",
        description: "Your qualifying TREE is verified. Garden Bot and paid PvP will add your fifth move card automatically.",
        action: "View Your Benefits",
        badge: "check",
      };
    case "not-qualified":
      return {
        tone: "not-qualified",
        eyebrow: "TREE Holder Battle Advantage",
        title: "Unlock a Fifth Battle Card with TREE",
        description: "See the supported liquidity and staking routes that count toward unlocking your extra move.",
        action: "See How to Qualify",
        badge: "+1",
      };
    case "checking":
      return {
        tone: "checking",
        eyebrow: "Checking TREE Battle Benefits",
        title: "Checking Fifth Card Access…",
        description: "We are reading your supported TREE positions. This check does not move or spend your assets.",
        action: "View Check Details",
        badge: "checking",
      };
    case "verification-incomplete":
      return {
        tone: "unavailable",
        eyebrow: "TREE Benefit Check Incomplete",
        title: "Some TREE Positions Could Not Be Verified",
        description: "Open the benefits panel to see which supported position needs another check.",
        action: "Review Check Details",
        badge: "alert",
      };
    case "unavailable":
      return {
        tone: "unavailable",
        eyebrow: "TREE Benefit Check Unavailable",
        title: "Fifth Card Status Needs Another Check",
        description: "The network could not confirm your supported TREE positions. Your assets have not been changed.",
        action: "Open Benefits & Retry",
        badge: "alert",
      };
    case "not-connected":
    default:
      return {
        tone: "disconnected",
        eyebrow: "TREE Holder Battle Advantage",
        title: "Connect to Check Fifth Card Access",
        description: "Connect your wallet to see whether your fifth move card is already unlocked and what counts toward access.",
        action: "Check Fifth Card Access",
        badge: "wallet",
      };
  }
}
