import {
  buildNightlyBattleLink,
  buildPhantomBattleLink,
} from "@/lib/mobileWalletLinks";

export default function MobileWalletLaunchers() {
  return (
    <aside className="gb-mobile-wallet-launchers" aria-label="Mobile wallet options">
      <p>
        On mobile? Slush connects above. Nightly and Phantom open Garden Battles
        in their secure wallet browsers.
      </p>
      <div>
        <a href={buildNightlyBattleLink()}>Open in Nightly</a>
        <a href={buildPhantomBattleLink()}>Open in Phantom</a>
      </div>
    </aside>
  );
}
