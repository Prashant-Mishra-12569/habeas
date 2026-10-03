#!/usr/bin/env bash
# Finishes the demo asset issuer's classic setup and then switches its key off
# for good (master weight 0, no other signers). After this nobody can sign
# for the issuer account again, so the only way to freeze, take back or mint
# DEMOUSD is through the Habeas contract.
#
# Before the lock: spare XLM moves to the relayer (it pays for free answers)
# and the home domain is set so wallets can find stellar.toml.
# After the lock: checks that the account can't sign, that a classic take back
# is refused, and that minting through Habeas still works.
#
# The account is currently co-signed (issuer + reviewer, thresholds 2), so
# every step before the lock needs both signatures.
#
# Usage: HOME_DOMAIN=habeas-stellar.vercel.app scripts/lock-issuer.sh
# Irreversible. If the asset ever needs a redo, use a fresh asset issuer.
set -euo pipefail

STELLAR="${STELLAR:-stellar}"
command -v "$STELLAR" >/dev/null || STELLAR="/c/Program Files (x86)/Stellar CLI/stellar.exe"
export STELLAR_NETWORK=testnet
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ISSUER_KEY="${ASSET_ISSUER:-habeas-asset-issuer-v1}"
HOME_DOMAIN="${HOME_DOMAIN:?set HOME_DOMAIN, e.g. habeas-stellar.vercel.app}"
HORIZON=https://horizon-testnet.stellar.org

addr() { "$STELLAR" keys address "$1"; }
ISSUER="$(addr "$ISSUER_KEY")"
HABEAS="$(python -c "import json;print(json.load(open('deployments/testnet.json'))['habeas'])")"
ASSET="$(python -c "import json;print(json.load(open('deployments/testnet.json'))['asset'])")"
[ "$ASSET" = "DEMOUSD:$ISSUER" ] || { echo "deployments/testnet.json is for $ASSET, not $ISSUER" >&2; exit 1; }

# Builds a transaction, signs it with the issuer and the reviewer, sends it,
# and prints the hash.
cosigned() {
  local out
  out="$("$STELLAR" tx new "$@" --source "$ISSUER_KEY" --build-only     | "$STELLAR" tx sign --sign-with-key "$ISSUER_KEY" 2>/dev/null     | "$STELLAR" tx sign --sign-with-key habeas-reviewer 2>/dev/null     | "$STELLAR" tx send 2>&1)"
  echo "   tx $(echo "$out" | grep -oE 'Transaction hash is [0-9a-f]{64}' | cut -d' ' -f4)  $(echo "$out" | grep -oE '"status": "[A-Z]+"' | head -1)"
}

echo "== Before"
curl -s "$HORIZON/accounts/$ISSUER" | python -c "import json,sys;d=json.load(sys.stdin);print('   flags',{k for k,v in d['flags'].items() if v});print('   signers',[(s['key'][:6],s['weight']) for s in d['signers']]);print('   thresholds',d['thresholds']);print('   home domain',d.get('home_domain'));print('   XLM',[b['balance'] for b in d['balances'] if b['asset_type']=='native'][0])"

echo "== stellar.toml is live at https://$HOME_DOMAIN/.well-known/stellar.toml"
curl -sf "https://$HOME_DOMAIN/.well-known/stellar.toml" | grep -q "$ISSUER" || { echo "   stellar.toml doesn't list $ISSUER yet" >&2; exit 1; }
echo "   yes, and it lists the issuer"

echo "== Move spare XLM to the relayer (keep 3 XLM for the account's reserve)"
XLM=$(curl -s "$HORIZON/accounts/$ISSUER" | python -c "import json,sys;d=json.load(sys.stdin);print([b['balance'] for b in d['balances'] if b['asset_type']=='native'][0])")
SEND=$(python -c "print(int(round(float('$XLM')*1e7)) - 30000000)")
cosigned payment --destination hb-relayer --amount "$SEND"

echo "== Set the home domain"
cosigned set-options --home-domain "$HOME_DOMAIN"

echo "== Record the Habeas contract on the issuer account (data entry \"habeas\")"
# Anyone can check the link from the chain alone, without trusting a website.
cosigned manage-data --data-name habeas --data-value "$(printf '%s' "$HABEAS" | xxd -p | tr -d '\n')"

echo "== Switch the key off: master weight 0, remove the reviewer as signer"
cosigned set-options --master-weight 0 --signer "$(addr habeas-reviewer)" --signer-weight 0

echo "== After"
curl -s "$HORIZON/accounts/$ISSUER" | python -c "
import json,sys;d=json.load(sys.stdin)
w=sum(s['weight'] for s in d['signers'])
print('   signers',[(s['key'][:6],s['weight']) for s in d['signers']],'total weight',w)
print('   home domain',d.get('home_domain'))
print('   can anyone sign?','NO' if w==0 else 'YES')
sys.exit(0 if w==0 else 1)"

echo "== A classic take back by the issuer is refused"
if "$STELLAR" tx new clawback --source "$ISSUER_KEY" --from "$(addr habeas-holder-a)" --asset "$ASSET" --amount 1 >/dev/null 2>/tmp/lock.err; then
  echo "   BACK DOOR OPEN" >&2; exit 1
fi
echo "   refused: $(grep -oE 'TxBadAuth|tx_bad_auth' /tmp/lock.err | head -1)"

echo "== Minting through Habeas still works"
"$STELLAR" contract invoke --id "$HABEAS" --source habeas-issuer -- mint --to "$(addr habeas-holder-a)" --amount 10000000 2>&1 \
  | grep -oE 'Signing transaction: [0-9a-f]{64}' | sed 's/Signing transaction: /   tx /'
