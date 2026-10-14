import hre from "hardhat"
import { parseUnits, getAddress } from "viem"
import { explorer, polkadotHubTestnet } from "./network"

const to = getAddress("0x4Da06C4382D3A145A954981dE969c11DB9Ced416")
const amount = parseUnits("100", 18)

async function main() {
  const address = process.env.MOEDA_ADDRESS as `0x${string}`
  if (!address) throw new Error("set MOEDA_ADDRESS")
  const publicClient = await hre.viem.getPublicClient({ chain: polkadotHubTestnet })
  const [wallet] = await hre.viem.getWalletClients({ chain: polkadotHubTestnet })
  const moeda = await hre.viem.getContractAt("Moeda", address, { client: { public: publicClient, wallet } })
  const hash = await moeda.write.transfer([to, amount])
  console.log(`tx ${hash}`)
  console.log(`${explorer}/tx/${hash}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
