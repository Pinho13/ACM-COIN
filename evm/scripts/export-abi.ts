import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const artifact = JSON.parse(readFileSync(resolve(__dirname, "../artifacts/contracts/Moeda.sol/Moeda.json"), "utf8"))
const out = resolve(__dirname, "../../apps/shared/src/generated/moeda.ts")
writeFileSync(out, `// Gerado por evm/scripts/export-abi.ts. Não editar à mão.\nexport const moedaAbi = ${JSON.stringify(artifact.abi, null, 2)} as const\n`)
console.log(`ABI escrita em ${out}`)
