import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, Sparkles, X } from "lucide-react";
import MoveCardFace from "./MoveCardFace";
import {
  filterCardGuideCards,
  type CardGuideFilter,
} from "@/lib/cardGuide";

type CardGuideProps = {
  isOpen: boolean;
  onClose: () => void;
  currentHand?: number[];
  initialCurrentHandOnly?: boolean;
};

const FILTERS: Array<{ id: CardGuideFilter; label: string }> = [
  { id: "all", label: "All Cards" },
  { id: "attack", label: "Attack" },
  { id: "growth", label: "Growth" },
  { id: "hybrid", label: "Hybrid" },
  { id: "tree-power", label: "TREE Power" },
];

export default function CardGuide({
  isOpen,
  onClose,
  currentHand = [],
  initialCurrentHandOnly = false,
}: CardGuideProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardGuideFilter>("all");
  const [currentHandOnly, setCurrentHandOnly] = useState(initialCurrentHandOnly);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    setCurrentHandOnly(initialCurrentHandOnly && currentHand.length > 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentHand.length, initialCurrentHandOnly, isOpen]);

  const cards = useMemo(
    () =>
      filterCardGuideCards({
        query,
        filter,
        currentHand,
        currentHandOnly,
      }),
    [currentHand, currentHandOnly, filter, query],
  );

  if (!isOpen) return null;

  return (
    <div
      className="gb-card-guide-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="gb-card-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-guide-title"
      >
        <header className="gb-card-guide-header">
          <div className="gb-card-guide-heading">
            <BookOpen size={25} aria-hidden="true" />
            <div>
              <p>Garden Battles field manual</p>
              <h2 id="card-guide-title">Battle Card Guide</h2>
              <span>39 live cards · effects, timing, counters, and availability</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Card Guide">
            <X size={20} />
          </button>
        </header>

        <div className="gb-card-guide-toolbar">
          <label className="gb-card-guide-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search battle cards</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a card, effect, condition, or strategy..."
              autoFocus
            />
          </label>
          <div className="gb-card-guide-filters" aria-label="Filter cards by type">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {option.id === "tree-power" && <Sparkles size={13} aria-hidden="true" />}
                {option.label}
              </button>
            ))}
          </div>
          {currentHand.length > 0 && (
            <button
              type="button"
              className="gb-card-guide-hand-filter"
              aria-pressed={currentHandOnly}
              onClick={() => setCurrentHandOnly((current) => !current)}
            >
              My Current Hand ({currentHand.length})
            </button>
          )}
        </div>

        <div className="gb-card-guide-legend">
          <span><b>Core cards 01–30</b> can appear in normal hands.</span>
          <span><Sparkles size={13} aria-hidden="true" /> <b>TREE Power cards 31–39</b> are bonus fifth-card candidates.</span>
          <strong>{cards.length} card{cards.length === 1 ? "" : "s"} shown</strong>
        </div>

        <div className="gb-card-guide-body">
          {cards.length === 0 ? (
            <div className="gb-card-guide-empty">
              <Search size={24} aria-hidden="true" />
              <strong>No cards match those filters.</strong>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); setCurrentHandOnly(false); }}>
                Show All Cards
              </button>
            </div>
          ) : (
            <div className="gb-card-guide-grid">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className={`gb-card-guide-card gb-card-guide-card-${card.meta.type}${card.meta.fifthExclusive ? " gb-card-guide-card-fifth" : ""}`}
                >
                  {currentHand.includes(card.id) && <span className="gb-card-guide-in-hand">In Your Hand</span>}
                  <MoveCardFace moveId={card.id} isFifth={card.meta.fifthExclusive} />
                  <div className="gb-card-guide-card-details">
                    <p className="gb-card-guide-availability">{card.availability}</p>
                    <dl>
                      <div>
                        <dt>Best use</dt>
                        <dd>{card.bestUse}</dd>
                      </div>
                      <div>
                        <dt>Watch for</dt>
                        <dd>{card.watchFor}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
