import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type UtilityDrawerProps = {
  title: string;
  eyebrow: string;
  description: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function UtilityDrawer({
  title,
  eyebrow,
  description,
  className = "",
  onClose,
  children,
}: UtilityDrawerProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="gb-utility-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`gb-utility-drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="gb-utility-drawer-head">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={22} />
          </button>
        </header>
        <div className="gb-utility-drawer-body">{children}</div>
      </section>
    </div>
  );
}
