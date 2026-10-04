"use client";

import { useState, useSyncExternalStore } from "react";
import { WalletError } from "@/lib/freighter";
import { shortAddress } from "@/lib/format";
import { type Signer, freighterSigner, hasTestWallet, testWalletSigner } from "@/lib/signer";
import { useT } from "@/i18n/client";
import { Button } from "./Button";

const noop = () => () => {};

/** Connect Freighter, or reuse the test wallet made earlier in this tab. */
export function WalletPicker({ signer, onSigner }: { signer: Signer | null; onSigner: (s: Signer) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Session storage is invisible to the server, so read it only after hydration.
  const testWallet = useSyncExternalStore(noop, hasTestWallet, () => false);

  const use = (make: () => Promise<Signer>) => async () => {
    setBusy(true);
    setError(null);
    try {
      onSigner(await make());
    } catch (e) {
      setError(e instanceof WalletError && e.kind === "missing" ? t.tryIt.wallet.missing : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (signer) {
    return (
      <p className="text-sm">
        <span className="text-muted">{t.roles.signedInAs}: </span>
        <span className="font-mono text-pen">{shortAddress(signer.address, 6)}</span>
      </p>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Button busy={busy} onClick={use(freighterSigner)}>
          {t.roles.connect}
        </Button>
        {testWallet && (
          <Button variant="secondary" busy={busy} onClick={use(testWalletSigner)}>
            {t.roles.useTestWallet}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-[2px] border-l-4 border-taken bg-pink px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
