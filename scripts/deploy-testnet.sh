#!/usr/bin/env bash
# Deploys a demo asset protected by Habeas on testnet, from nothing:
#   1. fresh accounts (asset issuer, Habeas issuer key, reviewer, 4 holders)
#   2. DEMOUSD issued with AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED, set before
#      any trustline so every holder's tokens can be frozen and taken back
#   3. the asset's SAC, the Habeas contract, and set_admin to Habeas
#   4. the classic issuer account locked: the reviewer becomes a required
#      co-signer, so the issuer can't skip Habeas with a classic clawback
#
# Secrets stay in the Stellar CLI key store. Only public data is written to
# deployments/testnet.json.
#
# Usage: scripts/deploy-testnet.sh [answer_window_secs] [review_window_secs]
set -euo pipefail

STELLAR="${STELLAR:-stellar}"
command -v "$STELLAR" >/dev/null || STELLAR="/c/Program Files (x86)/Stellar CLI/stellar.exe"
export STELLAR_NETWORK=testnet
ANSWER="${1:-180}"
REVIEW="${2:-120}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$(mktemp)"
trap 'rm -f "$LOG" "$LOG.out"' EXIT

step() { printf '\n== %s\n' "$*"; }
# Runs a CLI command, prints only the tx hash lines, and fails loudly.
tx() {
  if ! "$STELLAR" "$@" >"$LOG.out" 2>"$LOG"; then
    cat "$LOG" >&2
    exit 1
  fi
  grep -oE 'Signing transaction: [0-9a-f]{64}' "$LOG" | sed 's/Signing transaction: /   tx /' || true
}
addr() { "$STELLAR" keys address "$1"; }
key() {
  if "$STELLAR" keys address "$1" >/dev/null 2>&1; then
    echo "   $1 exists: $(addr "$1")"
  else
    "$STELLAR" keys generate "$1" --fund >/dev/null 2>&1
    echo "   $1 created: $(addr "$1")"
  fi
}

step "Accounts"
for k in habeas-asset-issuer habeas-issuer habeas-reviewer habeas-holder-a habeas-holder-b habeas-holder-c habeas-holder-d hb-relayer; do key "$k"; done
ASSET="DEMOUSD:$(addr habeas-asset-issuer)"

step "Issuer flags: revocable + clawback enabled (before any trustline)"
tx tx new set-options --source habeas-asset-issuer --set-revocable --set-clawback-enabled

step "Holders open trustlines"
for h in a b c d; do tx tx new change-trust --source "habeas-holder-$h" --line "$ASSET"; done

step "Deploy the DEMOUSD asset contract (SAC)"
SAC="$("$STELLAR" contract id asset --asset "$ASSET")"
if "$STELLAR" contract invoke --id "$SAC" --source habeas-issuer --send=no -- name >/dev/null 2>&1; then
  echo "   already deployed"
else
  tx contract asset deploy --source habeas-asset-issuer --asset "$ASSET"
fi
echo "   SAC $SAC"

step "Build and deploy Habeas (answer ${ANSWER}s, review ${REVIEW}s)"
(cd "$ROOT" && "$STELLAR" contract build --package habeas >/dev/null 2>&1)
WASM="$ROOT/target/wasm32v1-none/release/habeas.wasm"
WASM_HASH="$(sha256sum "$WASM" | cut -d' ' -f1)"
tx contract deploy --source habeas-issuer --wasm "$WASM" --alias habeas-demousd -- \
  --sac "$SAC" --issuer "$(addr habeas-issuer)" --reviewer "$(addr habeas-reviewer)" \
  --answer_window "$ANSWER" --review_window "$REVIEW"
HABEAS="$(tail -n1 "$LOG.out")"
echo "   Habeas $HABEAS (wasm sha256 $WASM_HASH)"

step "Hand the SAC admin role to Habeas"
CURRENT_ADMIN="$("$STELLAR" contract invoke --id "$SAC" --source habeas-issuer --send=no -- admin 2>/dev/null | tr -d '"')"
if [ "$CURRENT_ADMIN" != "$(addr habeas-asset-issuer)" ]; then
  echo "   SAC admin is already $CURRENT_ADMIN, not the asset issuer. Use a fresh asset issuer." >&2
  exit 1
fi
tx contract invoke --source habeas-asset-issuer --id "$SAC" -- set_admin --new_admin "$HABEAS"
echo "   admin now: $("$STELLAR" contract invoke --id "$SAC" --source habeas-issuer --send=no -- admin 2>/dev/null)"

step "Lock the classic issuer account (reviewer becomes a required co-signer)"
tx tx new set-options --source habeas-asset-issuer --signer "$(addr habeas-reviewer)" --signer-weight 1 \
  --master-weight 1 --low-threshold 2 --med-threshold 2 --high-threshold 2

step "Check the back door is closed: classic clawback signed by the issuer alone"
if "$STELLAR" tx new clawback --source habeas-asset-issuer --from "$(addr habeas-holder-a)" \
  --asset "$ASSET" --amount 1 >/dev/null 2>"$LOG"; then
  echo "   BACK DOOR OPEN: classic clawback succeeded" >&2
  exit 1
fi
echo "   refused: $(grep -oE 'TxBadAuth|tx_bad_auth' "$LOG" | head -1)"

step "Write deployments/testnet.json"
mkdir -p "$ROOT/deployments"
cat >"$ROOT/deployments/testnet.json" <<JSON
{
  "network": "testnet",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "asset": "$ASSET",
  "asset_issuer": "$(addr habeas-asset-issuer)",
  "sac": "$SAC",
  "habeas": "$HABEAS",
  "wasm_sha256": "$WASM_HASH",
  "issuer": "$(addr habeas-issuer)",
  "reviewer": "$(addr habeas-reviewer)",
  "answer_window_secs": $ANSWER,
  "review_window_secs": $REVIEW,
  "holders": {
    "a": "$(addr habeas-holder-a)",
    "b": "$(addr habeas-holder-b)",
    "c": "$(addr habeas-holder-c)",
    "d": "$(addr habeas-holder-d)"
  },
  "relayer": "$(addr hb-relayer)"
}
JSON
cat "$ROOT/deployments/testnet.json"
