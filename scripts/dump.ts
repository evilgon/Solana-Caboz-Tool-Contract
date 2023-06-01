import * as anchor from "@coral-xyz/anchor";
import * as bs58 from "bs58";
import * as bs64 from "base64-js";
import { BN } from "@coral-xyz/anchor";
import { writeFile } from "fs";
import { execSync } from "child_process";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const wallet = (provider.wallet as NodeWallet).payer;

function dumpMint(
  mintAddress: string,
  tokenName: string,
  mintAuthority: string = null,
  freezeAuthority: string = null,
  supply: number | BN = null
) {
  const mintPath = `tests/accounts/${tokenName}.json`;
  execSync(
    `mkdir -p tests/accounts && solana account ${mintAddress} --output json -o ${mintPath} -um >/dev/null`
  );
  const mint = require(`../${mintPath}`);

  let data = bs64.toByteArray(mint["account"]["data"][0]);
  if (mintAuthority !== null) {
    data = Buffer.concat([
      new BN(1).toBuffer("le", 4),
      bs58.decode(mintAuthority),
      data.slice(4 + 32),
    ]);
  }
  if (freezeAuthority !== null) {
    data = Buffer.concat([
      data.slice(0, 46),
      new BN(1).toBuffer("le", 4),
      bs58.decode(freezeAuthority),
      data.slice(46 + 36),
    ]);
  }
  if (supply !== null) {
    data = Buffer.concat([
      data.slice(0, 36),
      new BN(supply).toBuffer("le", 8),
      data.slice(36 + 8),
    ]);
  }
  mint["account"]["data"][0] = bs64.fromByteArray(data);

  writeFile(mintPath, JSON.stringify(mint), "utf8", (err: any) => {
    if (err) {
      console.log(err);
      process.exit(1);
    }
  });
}

dumpMint(
  "FdkitqFFz7U65o3v7kjQ6neNGz3DwdQ36pqCELcsMG9s",
  "IWL",
  wallet.publicKey.toString(),
  wallet.publicKey.toString(),
  0
);
