import {
  Connection,
  GetProgramAccountsFilter,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function airdrop(
  connection: Connection,
  toPubkeys: PublicKey[],
  fromKeypair: Keypair
): Promise<void> {
  await connection.confirmTransaction({
    signature: await connection.requestAirdrop(
      fromKeypair.publicKey,
      200_000_000 * (toPubkeys.length + 1)
    ),
    ...(await connection.getLatestBlockhash()),
  });
  const tx = new Transaction();
  for (const toPubkey of toPubkeys) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        lamports: 200_000_000,
        toPubkey,
      })
    );
  }
  await sendAndConfirmTransaction(connection, tx, [fromKeypair]);
}

export async function transferEverything(
  connection: Connection,
  fromKeypairs: Keypair[],
  toKeypair: Keypair
): Promise<void> {
  const tx = new Transaction();
  for (const fromKeypair of fromKeypairs) {
    const lamports = await connection.getBalance(fromKeypair.publicKey);

    tx.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        lamports,
        toPubkey: toKeypair.publicKey,
      })
    );
  }

  tx.feePayer = toKeypair.publicKey;

  await sendAndConfirmTransaction(
    connection,
    tx,
    [toKeypair].concat(fromKeypairs)
  );
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTokenAccountsByOwner(
  connection: Connection,
  owner: PublicKey
): Promise<{ address: PublicKey; mint: PublicKey; amount: number }[]> {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165,
    },
    {
      memcmp: {
        offset: 32,
        bytes: owner.toString(),
      },
    },
  ];
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters,
  });
  return accounts.map((account) => {
    const parsedAccountInfo = account.account.data["parsed"]["info"];
    return {
      address: account.pubkey,
      mint: new PublicKey(parsedAccountInfo["mint"]),
      amount: Number(parsedAccountInfo["tokenAmount"]["amount"]),
    };
  });
}
