import hre from "hardhat"
import { getAddress, parseUnits } from "viem"
import { explorer, polkadotDevnet } from "./network"

const coin = process.env.COIN_ADDRESS
const to = process.env.TO ?? "0x4Da06C4382D3A145A954981dE969c11DB9Ced416"
const amount = parseUnits(process.env.AMOUNT ?? "100", 18)

async function main() {
  if (!coin) throw new Error("Falta COIN_ADDRESS no ambiente.")
  const publicClient = await hre.viem.getPublicClient({ chain: polkadotDevnet })
  const [wallet] = await hre.viem.getWalletClients({ chain: polkadotDevnet })
  const moeda = await hre.viem.getContractAt("Moeda", getAddress(coin), { client: { public: publicClient, wallet } })
  const hash = await moeda.write.transfer([getAddress(to), amount])
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== "success") throw new Error(`Transferência falhou: ${hash}`)
  console.log(`hash ${hash}`)
  console.log(`${explorer}/tx/${hash}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
