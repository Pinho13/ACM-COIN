import "@nomicfoundation/hardhat-toolbox-viem"
import type { HardhatUserConfig } from "hardhat/config"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    // Mesmo chain id da Devnet, para testar as apps contra um nó local.
    hardhat: { chainId: 420420417 },
    polkadotDevnet: {
      url: process.env.RPC_URL ?? "https://eth-rpc-testnet.polkadot.io/",
      chainId: 420420417,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
}

export default config
