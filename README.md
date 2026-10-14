# ACM-COIN

A moeda do ACM Student Chapter da FEUP na Polkadot Devnet, com a carteira de quem compra e o
terminal da loja. Workshop "criar uma moeda" · web 3.0, em colaboração com web3up.org.

| Pasta | O que é |
|---|---|
| `evm` | O contrato `Moeda.sol` (ERC-20 + Ownable, OpenZeppelin 5), testes e scripts de lançamento. |
| `apps/wallet` | A carteira no telemóvel: 12 palavras BIP-39 no browser, saldo, receber, enviar e pagar. |
| `apps/terminal` | O terminal da loja no Chrome do SUNMI V3: teclado, QR, deteção do pagamento, recibo e vendas do dia. |
| `apps/shared` | Rede, leitura da moeda, QR, câmara, estilos e logótipos ACM. |

## A moeda

ACM-COIN · 18 casas · 1 000 000 no início para quem lança · máximo 2 000 000 · inflação de 67%
ao ano, proporcional ao tempo, emitida pelo dono com `mintInflation()` para o tesouro · taxa de
1% por transferência, paga a mais por quem envia, para o tesouro (que não paga taxa).

## Correr

```sh
npm install
npm test                                        # testes da moeda
COIN_ADDRESS=0x… npm run dev -w apps/wallet
COIN_ADDRESS=0x… npm run dev -w apps/terminal
```

A morada da moeda fica fixa no build pela variável `COIN_ADDRESS`. `VITE_RPC_URL` muda o RPC.

## Lançar e publicar

```sh
export PRIVATE_KEY=… DOT_NAME=… DOTNS_MNEMONIC="…"
./deploy.sh
```

Lança a moeda, envia 100 ACM-COIN para `0x4Da0…d416`, e publica a carteira em
`https://$DOT_NAME.dev-dot.li` e o terminal em `https://$DOT_NAME-terminal.dev-dot.li`.

## Notas

- Cada app é uma só página que nunca recarrega: o gateway .dot corre-a numa moldura e perde os
  parâmetros se recarregar. Os pagamentos `#pay=` leem-se do hash sem navegar.
- Dentro do gateway a câmara só abre depois de `requestDevicePermission("Camera")`.
- O terminal mostra `ethereum:<moeda>@420420417/transfer?address=<terminal>&uint256=<valor>`
  e junta ao valor menos de um milionésimo aleatório, para cada venda casar com uma só transferência.
- No SUNMI, imprimir passa o recibo em ESC/POS à app RawBT. Fora do Android usa `window.print()`
  com papel de 58 mm.
