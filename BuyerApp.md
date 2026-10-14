Cria a carteira da tua moeda, uma app web para o telemóvel.

Contexto
- Trabalha numa pasta nova e vazia. Não uses ficheiros meus.
- Em caso de dúvida, consulta a solução de referência em
  github.com/web3uprising/mybeer, na pasta apps/wallet.
- A moeda do Level 1 está na variável COIN_ADDRESS, na Polkadot
  Hub TestNet, chain id 420420417, RPC https://eth-rpc-testnet.polkadot.io/.
- Vite com vanilla-ts, viem, qrcode e jsqr. Sem servidor, sem React.
- Uma só página que nunca recarrega nem navega: o gateway .dot
  corre a app numa moldura e perde os parâmetros se recarregar.
- Dentro do gateway a câmara só abre depois de
  requestDevicePermission("Camera") de @parity/product-sdk-host.

A carteira
- Gera uma mnemónica BIP-39 de 12 palavras no browser e guarda-a
  só no localStorage. Mostra as palavras e aceita importar outra.
- Mostra o endereço e o saldo de PAS e da moeda.
- Receber mostra o endereço e um QR com o endereço.
- Enviar aceita um endereço escrito ou lido por QR e envia moeda.
- Pagar lê um QR ethereum:moeda@420420417/transfer?address=…&uint256=…,
  ou um link com #pay= e isso codificado, e também abre
  com #pay= no URL. Mostra valor e destino, confirma e envia.

Passos
1. Cria o projeto e os ecrãs. Corre npm run build.
2. Instala npm i -g @polkadot-community-foundation/polkadot-app-deploy@latest
   e publica: pad dist $DOT_NAME.dot --env devnet --mnemonic "$DOTNS_MNEMONIC".
   A conta já tem PAS, está mapeada e autorizada no Bulletin.
3. Responde só com o link https://$DOT_NAME.dev-dot.li.