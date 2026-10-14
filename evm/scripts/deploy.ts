import hre from "hardhat"
import { formatEther } from "viem"
import { coinArgs, ACM_COIN } from "./coin"
import { explorer, polkadotDevnet } from "./network"

async function main() {
  const publicClient = await hre.viem.getPublicClient({ chain: polkadotDevnet })
  const [wallet] = await hre.viem.getWalletClients({ chain: polkadotDevnet })
  if (!wallet) throw new Error("Falta PRIVATE_KEY no ambiente.")

  const gas = await publicClient.getBalance({ address: wallet.account.address })
  if (gas === 0n) throw new Error(`A carteira ${wallet.account.address} não tem PAS para o gás.`)
  console.log(`Carteira ${wallet.account.address} · ${formatEther(gas)} PAS`)

  const moeda = await hre.viem.deployContract("Moeda", [...coinArgs], { client: { public: publicClient, wallet } })
  console.log(`${ACM_COIN.symbol} deployed at ${moeda.address}`)
  console.log(`${explorer}/address/${moeda.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
