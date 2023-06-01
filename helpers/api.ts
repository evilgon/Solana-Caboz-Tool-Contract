import { BN, IdlTypes, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  SystemProgram,
  Keypair,
  PublicKey,
  TransactionSignature,
  Connection,
} from "@solana/web3.js";
import { expect } from "chai";
import { getTokenAccountsByOwner } from "./utils";
import { Caboz } from "../target/types/caboz";
import { Metaplex } from "@metaplex-foundation/js";
import * as token from "@solana/spl-token";

// required for `CABOZ_PROGRAM` to pick up env provider
anchor.setProvider(anchor.AnchorProvider.env());

export const CABOZ_PROGRAM: Program<Caboz> = anchor.workspace.Caboz;

export function findAllowedPaymentMint(paymentMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("allowed_payment_mint"), paymentMint.toBuffer()],
    CABOZ_PROGRAM.programId
  )[0];
}

export function findWallet(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("wallet"), owner.toBuffer()],
    CABOZ_PROGRAM.programId
  )[0];
}

export async function getWalletBalanceNative(
  connection: Connection,
  owner: PublicKey
): Promise<number> {
  return (await connection.getBalance(findWallet(owner))) - 890880;
}

export async function getWalletBalanceNonNative(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<number> {
  return Number(
    (
      await token.getAccount(
        connection,
        getAssociatedTokenAddressSync(mint, findWallet(owner), true)
      )
    ).amount
  );
}

export async function allowPaymentMint(
  paymentMint: PublicKey,
  feeMultiplierBps: number,
  mintListAuthority: Keypair
): Promise<TransactionSignature> {
  return await CABOZ_PROGRAM.methods
    .allowPaymentMint(feeMultiplierBps)
    .accounts({
      mintListAuthority: mintListAuthority.publicKey,
      paymentMint,
      allowedPaymentMint: findAllowedPaymentMint(paymentMint),
    })
    .signers([mintListAuthority])
    .rpc();
}

export async function disallowPaymentMint(
  paymentMint: PublicKey,
  mintListAuthority: Keypair
): Promise<TransactionSignature> {
  return await CABOZ_PROGRAM.methods
    .disallowPaymentMint()
    .accounts({
      mintListAuthority: mintListAuthority.publicKey,
      allowedPaymentMint: findAllowedPaymentMint(paymentMint),
    })
    .signers([mintListAuthority])
    .rpc();
}

export async function createOrder(
  connection: Connection,
  paymentMint: PublicKey,
  price: number | BN,
  collectionMint: PublicKey,
  nftSet: IdlTypes<Caboz>["MerkleTree"] = {
    root: new Array(32).fill(0),
    arweaveAddress: new Array(43).fill(0),
  },
  inkworkCollectionNftMint: PublicKey = PublicKey.default,
  buyer: Keypair,
  order = new Keypair()
): Promise<{ transactionSignature: TransactionSignature; order: PublicKey }> {
  let remainingAccounts = [];

  for (const account of (
    await getTokenAccountsByOwner(connection, buyer.publicKey)
  ).filter((ta) => ta.amount == 1)) {
    if (account.amount == 1) {
      try {
        const nft = await new Metaplex(connection)
          .nfts()
          .findByMint({ mintAddress: account.mint });

        if (
          nft.collection.address.equals(inkworkCollectionNftMint) &&
          nft.collection.verified
        ) {
          remainingAccounts.push(
            { pubkey: account.address, isSigner: false, isWritable: false },
            { pubkey: nft.metadataAddress, isSigner: false, isWritable: false }
          );
          if (remainingAccounts.length == 20) {
            // we don't need more than 10 NFTs
            // and it will not fit in a transaction
            break;
          }
        }
      } catch (e) {
        expect(e.toString()).to.contain(
          "The account of type [Metadata] was not found at the provided address"
        );
      }
    }
  }

  const transactionSignature = await CABOZ_PROGRAM.methods
    .createOrder(new BN(price), collectionMint, nftSet)
    .accounts({
      buyer: buyer.publicKey,
      order: order.publicKey,
      allowedPaymentMint: findAllowedPaymentMint(paymentMint),
    })
    .remainingAccounts(remainingAccounts)
    .signers([buyer, order])
    .rpc();

  return { transactionSignature, order: order.publicKey };
}

export async function acceptOrderNative(
  connection: Connection,
  order: PublicKey,
  expectedPrice: number | BN,
  proof: number[][] = [],
  nftMint: PublicKey,
  feeReceiver: PublicKey,
  seller: Keypair
): Promise<TransactionSignature> {
  const orderAccount = await CABOZ_PROGRAM.account.order.fetch(order);

  const buyerNftTokenAccount = getAssociatedTokenAddressSync(
    nftMint,
    orderAccount.buyer
  );

  let preInstructions = [];
  if (!(await connection.getAccountInfo(buyerNftTokenAccount))) {
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        seller.publicKey,
        buyerNftTokenAccount,
        orderAccount.buyer,
        nftMint
      )
    );
  }

  return await CABOZ_PROGRAM.methods
    .acceptOrderNative(new BN(expectedPrice), proof)
    .accounts({
      buyer: orderAccount.buyer,
      buyerWallet: findWallet(orderAccount.buyer),
      buyerNftTokenAccount,
      order,
      nftMetadata: new Metaplex(connection)
        .nfts()
        .pdas()
        .metadata({ mint: nftMint }),
      seller: seller.publicKey,
      sellerNftTokenAccount: getAssociatedTokenAddressSync(
        nftMint,
        seller.publicKey
      ),
      feeReceiver,
    })
    .preInstructions(preInstructions)
    .signers([seller])
    .rpc();
}

export async function acceptOrderNonNative(
  connection: Connection,
  order: PublicKey,
  expectedPrice: number | BN,
  proof: number[][] = [],
  nftMint: PublicKey,
  feeReceiver: PublicKey,
  seller: Keypair
): Promise<TransactionSignature> {
  const orderAccount = await CABOZ_PROGRAM.account.order.fetch(order);

  const buyerNftTokenAccount = getAssociatedTokenAddressSync(
    nftMint,
    orderAccount.buyer
  );
  const buyerWallet = findWallet(orderAccount.buyer);

  const sellerTokenAccount = getAssociatedTokenAddressSync(
    orderAccount.paymentMint,
    seller.publicKey
  );

  let preInstructions = [];
  if (!(await connection.getAccountInfo(buyerNftTokenAccount))) {
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        seller.publicKey,
        buyerNftTokenAccount,
        orderAccount.buyer,
        nftMint
      )
    );
  }
  if (!(await connection.getAccountInfo(sellerTokenAccount))) {
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        seller.publicKey,
        sellerTokenAccount,
        seller.publicKey,
        orderAccount.paymentMint
      )
    );
  }

  return await CABOZ_PROGRAM.methods
    .acceptOrderNonNative(new BN(expectedPrice), proof)
    .accounts({
      acceptOrder: {
        buyer: orderAccount.buyer,
        buyerWallet,
        buyerNftTokenAccount,
        order,
        nftMetadata: new Metaplex(connection)
          .nfts()
          .pdas()
          .metadata({ mint: nftMint }),
        seller: seller.publicKey,
        sellerNftTokenAccount: getAssociatedTokenAddressSync(
          nftMint,
          seller.publicKey
        ),
        feeReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      buyerWalletTokenAccount: getAssociatedTokenAddressSync(
        orderAccount.paymentMint,
        buyerWallet,
        true
      ),
      sellerTokenAccount,
      feeReceiverTokenAccount: getAssociatedTokenAddressSync(
        orderAccount.paymentMint,
        feeReceiver
      ),
    })
    .preInstructions(preInstructions)
    .signers([seller])
    .rpc();
}

export async function closeOrder(
  order: PublicKey,
  buyer: Keypair
): Promise<TransactionSignature> {
  return await CABOZ_PROGRAM.methods
    .closeOrder()
    .accounts({
      buyer: buyer.publicKey,
      order,
    })
    .signers([buyer])
    .rpc();
}

export async function createWallet(
  buyer: Keypair
): Promise<TransactionSignature> {
  return await CABOZ_PROGRAM.methods
    .createWallet()
    .accounts({
      buyer: buyer.publicKey,
      buyerWallet: findWallet(buyer.publicKey),
    })
    .signers([buyer])
    .rpc();
}

export async function withdrawNative(
  lamports: number | BN,
  buyer: Keypair
): Promise<TransactionSignature> {
  return await CABOZ_PROGRAM.methods
    .withdrawNative(new BN(lamports))
    .accounts({
      buyer: buyer.publicKey,
      buyerWallet: findWallet(buyer.publicKey),
    })
    .signers([buyer])
    .rpc();
}

export async function withdrawNonNative(
  connection: Connection,
  mint: PublicKey,
  amount: number | BN,
  buyer: Keypair
): Promise<TransactionSignature> {
  let preInstructions = [];
  const destination = getAssociatedTokenAddressSync(mint, buyer.publicKey);
  if (!(await connection.getAccountInfo(destination))) {
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        buyer.publicKey,
        destination,
        buyer.publicKey,
        mint
      )
    );
  }

  return await CABOZ_PROGRAM.methods
    .withdrawNonNative(new BN(amount))
    .accounts({
      withdraw: {
        buyer: buyer.publicKey,
        buyerWallet: findWallet(buyer.publicKey),
      },
      buyerWalletTokenAccount: getAssociatedTokenAddressSync(
        mint,
        findWallet(buyer.publicKey),
        true
      ),
      destination,
    })
    .preInstructions(preInstructions)
    .signers([buyer])
    .rpc();
}
