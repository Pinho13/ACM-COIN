import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers"
import { expect } from "chai"
import hre from "hardhat"
import { parseUnits } from "viem"
import { ACM_COIN, coinArgs } from "../scripts/coin"

const YEAR = 365 * 24 * 60 * 60
const million = parseUnits("1000000", 18)

async function deployAcmCoin() {
  const [owner, alice, bob] = await hre.viem.getWalletClients()
  const moeda = await hre.viem.deployContract("Moeda", [...coinArgs])
  return { moeda, owner, alice, bob }
}

describe("ACM-COIN", () => {
  it("tem nome, símbolo e 18 casas decimais", async () => {
    const { moeda } = await loadFixture(deployAcmCoin)
    expect(await moeda.read.name()).to.equal("ACM-COIN")
    expect(await moeda.read.symbol()).to.equal("ACM-COIN")
    expect(await moeda.read.decimals()).to.equal(18)
  })

  it("emite 1 000 000 no início, todos para o dono, que é o tesouro", async () => {
    const { moeda, owner } = await loadFixture(deployAcmCoin)
    expect(await moeda.read.totalSupply()).to.equal(million)
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million)
    expect((await moeda.read.treasury()).toLowerCase()).to.equal(owner.account.address.toLowerCase())
    expect(await moeda.read.maxSupply()).to.equal(2n * million)
  })

  it("cobra 1% a mais a quem envia e manda a taxa para o tesouro", async () => {
    const { moeda, owner, alice, bob } = await loadFixture(deployAcmCoin)
    await moeda.write.transfer([alice.account.address, 1_000n])
    await moeda.write.transfer([bob.account.address, 100n], { account: alice.account })
    expect(await moeda.read.balanceOf([bob.account.address])).to.equal(100n)
    expect(await moeda.read.balanceOf([alice.account.address])).to.equal(899n)
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million - 1_000n + 1n)
  })

  it("cobra exatamente 1% em valores redondos", async () => {
    const { moeda, owner, alice, bob } = await loadFixture(deployAcmCoin)
    const hundred = parseUnits("100", 18)
    await moeda.write.transfer([alice.account.address, parseUnits("200", 18)])
    await moeda.write.transfer([bob.account.address, hundred], { account: alice.account })
    expect(await moeda.read.balanceOf([alice.account.address])).to.equal(parseUnits("99", 18))
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million - parseUnits("199", 18))
  })

  it("não cobra taxa ao tesouro", async () => {
    const { moeda, owner, alice } = await loadFixture(deployAcmCoin)
    await moeda.write.transfer([alice.account.address, 1_000n])
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(million - 1_000n)
  })

  it("falha se quem envia não tem para a taxa", async () => {
    const { moeda, alice, bob } = await loadFixture(deployAcmCoin)
    await moeda.write.transfer([alice.account.address, 100n])
    await expect(moeda.write.transfer([bob.account.address, 100n], { account: alice.account })).to.be.rejected
  })

  it("emite 67% num ano para o tesouro", async () => {
    const { moeda, owner } = await loadFixture(deployAcmCoin)
    await time.increase(YEAR)
    await moeda.write.mintInflation()
    const supply = await moeda.read.totalSupply()
    const expected = (million * 16_700n) / 10_000n
    // Um segundo a mais de bloco dá no máximo uns trocos acima do esperado.
    expect(supply >= expected).to.equal(true)
    expect(supply - expected < parseUnits("1", 18)).to.equal(true)
    expect(await moeda.read.balanceOf([owner.account.address])).to.equal(supply)
  })

  it("emite proporcionalmente ao tempo", async () => {
    const { moeda } = await loadFixture(deployAcmCoin)
    await time.increase(YEAR / 2)
    await moeda.write.mintInflation()
    const supply = await moeda.read.totalSupply()
    const expected = (million * 13_350n) / 10_000n
    expect(supply >= expected).to.equal(true)
    expect(supply - expected < parseUnits("1", 18)).to.equal(true)
  })

  it("envia a inflação para o tesouro novo", async () => {
    const { moeda, bob } = await loadFixture(deployAcmCoin)
    await moeda.write.setTreasury([bob.account.address])
    await time.increase(YEAR)
    await moeda.write.mintInflation()
    expect((await moeda.read.balanceOf([bob.account.address])) > 0n).to.equal(true)
  })

  it("nunca passa de 2 000 000", async () => {
    const { moeda } = await loadFixture(deployAcmCoin)
    await time.increase(10 * YEAR)
    await moeda.write.mintInflation()
    expect(await moeda.read.totalSupply()).to.equal(ACM_COIN.maxSupply)
    await time.increase(YEAR)
    await moeda.write.mintInflation()
    expect(await moeda.read.totalSupply()).to.equal(ACM_COIN.maxSupply)
    expect(await moeda.read.pendingInflation()).to.equal(0n)
  })

  it("recusa lançar com o saldo inicial acima do máximo", async () => {
    await expect(hre.viem.deployContract("Moeda", ["X", "X", 2n * million + 1n, 2n * million, 6_700n, 100n])).to.be.rejected
  })

  it("só o dono emite inflação ou troca o tesouro", async () => {
    const { moeda, alice } = await loadFixture(deployAcmCoin)
    await expect(moeda.write.mintInflation({ account: alice.account })).to.be.rejected
    await expect(moeda.write.setTreasury([alice.account.address], { account: alice.account })).to.be.rejected
  })
})
