Lança uma moeda ERC-20 na Polkadot Devnet.

Contexto
- Em caso de dúvida, consulta a solução de referência em
  github.com/web3uprising/mybeer, na pasta evm/.
- Rede: Polkadot Devnet, chain id 420420417,
  RPC https://eth-rpc-testnet.polkadot.io/,
  explorador https://blockscout-testnet.polkadot.io.
- Hardhat 2 com @nomicfoundation/hardhat-toolbox-viem,
  solidity 0.8.28, optimizer ligado, evmVersion cancun.
- A chave privada está na variável PRIVATE_KEY. Lê-a só
  do ambiente e nunca a escrevas em lado nenhum.
- A carteira já tem PAS para o gás. Se faltar, para e diz.

A moeda
- Nome ACM-COIN, símbolo ACM-COIN, 18 casas decimais.
- 1 000 000 ACM-COIN no início, todos para a minha carteira.
- Máximo de 2 000 000. Nenhum mint pode passar disto.
- Inflação de 67% ao ano, proporcional ao tempo, que só
  o dono emite com mintInflation() para o tesouro.
- Taxa de 1% por transferência, paga a mais por quem envia,
  para o tesouro, que não paga taxa e começa por ser eu.

Passos
1. Cria um projeto Hardhat com OpenZeppelin 5.
2. Escreve contracts/Moeda.sol com ERC20 e Ownable.
3. Testa saldo inicial, máximo, inflação e taxa até passar.
4. Lança o contrato na Polkadot Devnet.
5. Envia 100 ACM-COIN para 0x4Da06C4382D3A145A954981dE969c11DB9Ced416.
6. Responde só com endereço, link do explorador e hash.