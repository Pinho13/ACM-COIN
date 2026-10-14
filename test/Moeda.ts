import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers"
import { expect } from "chai"
import hre from "hardhat"
import { parseUnits } from "viem"

const million = parseUnits("1000000", 18)

async function deployFino() {
  const [owner, alice, bob] = await hre.viem.getWalletClients()
  const moeda = await hre.viem.deployContract("Moeda", ["Fino", "FINO", million, 2n * million, 500n, 100n])
  return { moeda, owner, alice, bob }
}

describe("Moeda", () => {
  it("mints the initial supply to the owner", async () => {
    const { moeda, owner } = await loadFixture(deployFino)
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million)
  })

  it("charges the fee on top and sends it to the treasury", async () => {
    const { moeda, owner, alice, bob } = await loadFixture(deployFino)
    await moeda.write.transfer([alice.account.address, 1000n])
    await moeda.write.transfer([bob.account.address, 100n], { account: alice.account })
    expect(await moeda.read.balanceOf([bob.account.address])).to.equal(100n)
    expect(await moeda.read.balanceOf([alice.account.address])).to.equal(899n)
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million - 1000n + 1n)
  })

  it("lets the owner mint a year of inflation", async () => {
    const { moeda } = await loadFixture(deployFino)
    await time.increase(365 * 24 * 60 * 60)
    await moeda.write.mintInflation()
    const supply = await moeda.read.totalSupply()
    expect(supply > million).to.equal(true)
    expect(supply <= (million * 10_501n) / 10_000n).to.equal(true)
  })

  it("never mints above the maximum", async () => {
    const { moeda } = await loadFixture(deployFino)
    await time.increase(100 * 365 * 24 * 60 * 60)
    await moeda.write.mintInflation()
    expect(await moeda.read.totalSupply()).to.equal(2n * million)
  })

  it("rejects inflation minted by anyone else", async () => {
    const { moeda, alice } = await loadFixture(deployFino)
    await expect(moeda.write.mintInflation({ account: alice.account })).to.be.rejected
  })
})
