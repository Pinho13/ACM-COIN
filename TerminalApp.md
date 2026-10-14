Cria o terminal de pagamento da loja para o SUNMI V3.

Contexto
- Aceita a moeda do Level 1, na Polkadot Devnet.
- Corre no Chrome do SUNMI, sem app instalada.
- Usa Vite, TypeScript e viem. Sem servidor.

O terminal
- Um teclado para o valor e um botão Cobrar.
- Mostra um QR com a moeda, o destino e o valor.
- Vê a cadeia a cada 2 segundos até chegar o pagamento.
- Mostra pago e imprime o recibo.
- Lista as vendas do dia.

Passos
1. Cria o projeto com Vite.
2. Gera o QR no formato ethereum:moeda@chain/transfer.
3. Deteta o pagamento pelos eventos Transfer da moeda.
4. Publica com o pad e paga com a carteira do Level 2.