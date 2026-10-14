#!/usr/bin/env bash
# Lança a ACM-COIN na Polkadot Devnet e publica a carteira e o terminal no gateway .dot.
# Precisa de PRIVATE_KEY (Level 1) e de DOT_NAME e DOTNS_MNEMONIC (Level 2/3) no ambiente.
# Se COIN_ADDRESS já estiver definida, salta o lançamento da moeda.
set -euo pipefail
cd "$(dirname "$0")"

# Lê os segredos de .env (git-ignored) se existir.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

: "${DOT_NAME:?Falta DOT_NAME}"
: "${DOTNS_MNEMONIC:?Falta DOTNS_MNEMONIC}"

if [ -z "${COIN_ADDRESS:-}" ]; then
  : "${PRIVATE_KEY:?Falta PRIVATE_KEY}"
  echo "== Level 1: lançar a ACM-COIN"
  out=$(npm run -s deploy -w evm | tee /dev/stderr)
  COIN_ADDRESS=$(grep -oE 'deployed at 0x[0-9a-fA-F]{40}' <<<"$out" | awk '{print $3}')
  export COIN_ADDRESS
  echo "== Enviar 100 ACM-COIN"
  npm run -s send -w evm
fi
echo "COIN_ADDRESS=$COIN_ADDRESS"

command -v pad >/dev/null || npm i -g @polkadot-community-foundation/polkadot-app-deploy@latest

# Publica com a conta DotNS. Se o Bulletin ainda não a autorizou, publica pela conta 0 do pool
# do pad (a única autorizada na devnet) e passa o nome para a nossa conta no fim.
publish() {
  local dir=$1 name=$2
  if pad "$dir" "$name" --env devnet --mnemonic "$DOTNS_MNEMONIC"; then return; fi
  echo "   conta DotNS sem autorização no Bulletin, a usar o pool do pad"
  env -u DOTNS_MNEMONIC -u MNEMONIC pad "$dir" "$name" --env devnet --pool-size 1
  if [ -n "${DOTNS_H160:-}" ]; then
    env -u DOTNS_MNEMONIC -u MNEMONIC pad transfer "$name" --to "$DOTNS_H160" --env devnet
  else
    echo "   define DOTNS_H160 no .env para passar $name para a tua conta"
  fi
}

echo "== Level 2: carteira"
npm run -s build -w apps/wallet
publish apps/wallet/dist "$DOT_NAME.dot"

echo "== Level 3: terminal"
npm run -s build -w apps/terminal
publish apps/terminal/dist "$DOT_NAME-terminal.dot"

echo
echo "moeda     https://blockscout-testnet.polkadot.io/address/$COIN_ADDRESS"
echo "carteira  https://$DOT_NAME.dev-dot.li"
echo "terminal  https://$DOT_NAME-terminal.dev-dot.li"
