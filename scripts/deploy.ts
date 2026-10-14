import hre from "hardhat"
import { parseUnits } from "viem"
import { explorer, polkadotHubTestnet } from "./network"

const name = "Fino"
const symbol = "FINO"
const initialSupply = parseUnits("1000000", 18)
const maxSupply = parseUnits("2000000", 18)
const inflationBps = 500n
const feeBps = 100n

async function main() {
  const publicClient = await hre.viem.getPublicClient({ chain: polkadotHubTestnet })
  const [wallet] = await hre.viem.getWalletClients({ chain: polkadotHubTestnet })
  const moeda = await hre.viem.deployContract(
    "Moeda",
    [name, symbol, initialSupply, maxSupply, inflationBps, feeBps],
    { client: { public: publicClient, wallet } },
  )
  console.log(`${symbol} deployed at ${moeda.address}`)
  console.log(`${explorer}/address/${moeda.address}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
