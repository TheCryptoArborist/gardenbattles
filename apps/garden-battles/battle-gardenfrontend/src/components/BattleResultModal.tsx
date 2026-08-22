import type { BattleResultShareOption } from "@/lib/battleResultShare";

type BattleResultModalProps = {
  open: boolean;
  title: string;
  score: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  shareOptions: BattleResultShareOption[];
  selectedShareOptionId: string;
  xShareUrl: string;
  smsShareUrl: string;
  facebookShareUrl: string;
  leaderboardUrl: string;
  canPlayAgain?: boolean;
  isPlayingAgain?: boolean;
  onSelectShareOption: (optionId: string) => void;
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
  shareOptions,
  selectedShareOptionId,
  xShareUrl,
  smsShareUrl,
  facebookShareUrl,
  leaderboardUrl,
  canPlayAgain = false,
  isPlayingAgain = false,
  onSelectShareOption,
  onShare,
  onCopy,
  onClose,
  onPlayAgain,
}: BattleResultModalProps) {
  if (!open) return null;

  const selectedOption =
    shareOptions.find((option) => option.id === selectedShareOptionId) ??
    shareOptions[0];

  return (
    <div
      className="gb-result-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
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

        <div className="gb-result-modal-visual">
          <div className="gb-result-modal-image-wrap">
            <img src={imageUrl} alt={imageAlt} className="gb-result-modal-image" />
          </div>
          <p className="gb-result-modal-score-card">{score}</p>
        </div>

        <div className="gb-result-modal-copy">
          <p className="gb-result-modal-kicker">Battle Complete</p>
          <h2 id="gb-result-modal-title">{title}</h2>
          <p className="gb-result-modal-summary">{summary}</p>

          <section
            className="gb-result-share-picker"
            aria-labelledby="gb-result-share-title"
          >
            <div className="gb-result-share-heading">
              <div>
                <p className="gb-result-share-kicker">Choose Your Message</p>
                <h3 id="gb-result-share-title">Share the battle your way</h3>
              </div>
              <span>1 of 3 selected</span>
            </div>

            <div className="gb-result-share-options">
              {shareOptions.map((option) => {
                const selected = option.id === selectedOption?.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    onClick={() => onSelectShareOption(option.id)}
                  >
                    <strong>{option.title}</strong>
                  </button>
                );
              })}
            </div>
            {selectedOption && (
              <p className="gb-result-share-preview">{selectedOption.message}</p>
            )}
          </section>

          <div className="gb-result-modal-actions gb-result-share-actions">
            <button
              type="button"
              className="gb-result-share-primary"
              onClick={onShare}
            >
              Share to Apps
              <small>Instagram, Facebook &amp; more</small>
            </button>
            <a href={smsShareUrl}>Text Message</a>
            <a href={xShareUrl} target="_blank" rel="noopener noreferrer">
              Share on X
            </a>
            <a
              href={facebookShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Copies your selected caption for pasting into Facebook"
              onClick={onCopy}
            >
              Facebook
            </a>
            <button type="button" onClick={onCopy}>
              Copy Caption
            </button>
          </div>

          <div
            className="gb-result-next-actions"
            aria-label="Battle result next steps"
          >
            {canPlayAgain && onPlayAgain && (
              <button
                type="button"
                onClick={onPlayAgain}
                disabled={isPlayingAgain}
              >
                {isPlayingAgain ? "Starting..." : "Play Again"}
              </button>
            )}
            <a href={leaderboardUrl} onClick={onClose}>
              View Leaderboard
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
