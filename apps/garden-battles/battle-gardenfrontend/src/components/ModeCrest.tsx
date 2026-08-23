import { useState } from "react";
import { appAsset } from "@/lib/assets";

type ModeCrestType = "garden-bot" | "pvp-battle" | "arborist-trials" | "canopy-clash";

interface ModeCrestProps {
  alt: string;
  type: ModeCrestType;
}

const CREST_ASSETS: Record<ModeCrestType, string> = {
  "garden-bot": "assets/mode-crests/garden-bot-crest.png",
  "pvp-battle": "assets/mode-crests/pvp-battle-crest.png",
  "arborist-trials": "assets/mode-crests/arborist-trials-crest.png",
  "canopy-clash": "assets/mode-crests/canopy-clash-crest.png",
};

export default function ModeCrest({ alt, type }: ModeCrestProps) {
  const [imageAvailable, setImageAvailable] = useState(type !== "arborist-trials");
  const assetPath = appAsset(CREST_ASSETS[type]);

  return (
    <span className={`gb-mode-crest gb-mode-crest-${type}`} role="img" aria-label={alt}>
      {imageAvailable ? (
        <img
          className="gb-mode-crest-image"
          src={assetPath}
          alt=""
          aria-hidden="true"
          onError={() => setImageAvailable(false)}
        />
      ) : (
        <span className="gb-mode-crest-fallback" aria-hidden="true">
          <span className="gb-mode-crest-rim" />
          <svg
            className="gb-mode-crest-svg"
            viewBox="0 0 96 96"
            aria-hidden="true"
            focusable="false"
          >
            <circle className="gb-mode-crest-orbit" cx="48" cy="48" r="31" />
            {type === "garden-bot" && (
              <>
                <path className="gb-mode-crest-symbol" d="M48 66V39" />
                <path className="gb-mode-crest-symbol" d="M34 34c0-12 7-20 14-20s14 8 14 20" />
                <rect className="gb-mode-crest-fill" x="27" y="36" width="42" height="28" rx="12" />
                <circle className="gb-mode-crest-eye" cx="41" cy="50" r="4" />
                <circle className="gb-mode-crest-eye" cx="55" cy="50" r="4" />
                <path className="gb-mode-crest-symbol gb-mode-crest-accent" d="M27 44l-12-8M69 44l12-8" />
                <path className="gb-mode-crest-symbol" d="M40 22l-12-9M56 22l12-9" />
              </>
            )}
            {type === "pvp-battle" && (
              <>
                <path className="gb-mode-crest-fill" d="M48 15l25 11v20c0 18-10 29-25 36-15-7-25-18-25-36V26l25-11z" />
                <path className="gb-mode-crest-symbol" d="M31 66l34-38" />
                <path className="gb-mode-crest-symbol" d="M65 66L31 28" />
                <path className="gb-mode-crest-symbol gb-mode-crest-accent" d="M28 43h40M28 52h40" />
              </>
            )}
            {type === "canopy-clash" && (
              <>
                <path className="gb-mode-crest-fill" d="M30 32h36v17c0 11-7 19-18 19S30 60 30 49V32z" />
                <path className="gb-mode-crest-symbol" d="M25 32h46M38 68h20M42 77h12" />
                <path className="gb-mode-crest-symbol gb-mode-crest-accent" d="M31 29l8-13 9 13 9-13 8 13" />
                <path className="gb-mode-crest-symbol" d="M30 40c-11 0-14 8-11 15 3 6 10 7 16 3" />
                <path className="gb-mode-crest-symbol" d="M66 40c11 0 14 8 11 15-3 6-10 7-16 3" />
              </>
            )}
            {type === "arborist-trials" && (
              <>
                <path className="gb-mode-crest-fill" d="M48 14l24 12v20c0 17-10 29-24 36-14-7-24-19-24-36V26l24-12z" />
                <path className="gb-mode-crest-symbol" d="M48 64V34M48 45L36 36M48 50l13-11" />
                <path className="gb-mode-crest-symbol gb-mode-crest-accent" d="M37 34c-8-1-12-7-12-13 7 0 14 3 16 10M59 37c8-1 13-7 13-14-8 0-14 4-17 11" />
              </>
            )}
          </svg>
        </span>
      )}
    </span>
  );
}
