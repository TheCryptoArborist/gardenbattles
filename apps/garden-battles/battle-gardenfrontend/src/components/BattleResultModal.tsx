type BattleResultModalProps = {
  open: boolean;
  title: string;
  score: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  xShareUrl: string;
  buyNftreeUrl: string;
  battleUrl: string;
  leaderboardUrl: string;
  canPlayAgain?: boolean;
  isPlayingAgain?: boolean;
  onShare: () => void;
  onCopy: () => void;
  onClose: () => void;
  onPlayAgain?: () => void;
};

export default function BattleResultModal({
  open,
  title,
  score,
  summary,
  imageUrl,
  imageAlt,
  xShareUrl,
  buyNftreeUrl,
  battleUrl,
  leaderboardUrl,
  canPlayAgain = false,
  isPlayingAgain = false,
  onShare,
  onCopy,
  onClose,
  onPlayAgain,
}: BattleResultModalProps) {
  if (!open) return null;

  return (
    <div className="gb-result-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="gb-result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gb-result-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="gb-result-modal-close"
          aria-label="Close battle result"
          onClick={onClose}
        >
          X
        </button>

        <div className="gb-result-modal-image-wrap">
          <img src={imageUrl} alt={imageAlt} className="gb-result-modal-image" />
        </div>

        <div className="gb-result-modal-copy">
          <p className="gb-result-modal-kicker">Battle Result</p>
          <h2 id="gb-result-modal-title">{title}</h2>
          <p className="gb-result-modal-score">{score}</p>
          <p className="gb-result-modal-summary">{summary}</p>

          <section className="gb-result-modal-cta" aria-label="Join the fight">
            <p className="gb-result-modal-cta-title">Join The Fight</p>
            <ul>
              <li>Buy an NFTree at NFTree.net.</li>
              <li>Connect your wallet.</li>
              <li>Enter Garden Battles.</li>
              <li>See if your tree can survive the arena.</li>
            </ul>
            <div className="gb-result-modal-cta-links">
              <a href={buyNftreeUrl} target="_blank" rel="noopener noreferrer">
                Buy NFTree
              </a>
              <a href={battleUrl} target="_blank" rel="noopener noreferrer">
                Play Garden Battles
              </a>
            </div>
          </section>

          <div className="gb-result-modal-actions">
            <button type="button" onClick={onShare}>
              Share
            </button>
            <button type="button" onClick={onCopy}>
              Copy Result
            </button>
            <a href={xShareUrl} target="_blank" rel="noopener noreferrer">
              Share on X
            </a>
            <a href={leaderboardUrl} onClick={onClose}>
              View Leaderboard
            </a>
            {canPlayAgain && onPlayAgain && (
              <button type="button" onClick={onPlayAgain} disabled={isPlayingAgain}>
                {isPlayingAgain ? "Starting..." : "New Bot Hand"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
