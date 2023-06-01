import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Context } from "./ctx";
import * as token from "@solana/spl-token";
import {
  acceptOrderNative,
  acceptOrderNonNative,
  allowPaymentMint,
  CABOZ_PROGRAM,
  closeOrder,
  createOrder,
  createWallet,
  disallowPaymentMint,
  findAllowedPaymentMint,
  findWallet,
  getWalletBalanceNative,
  getWalletBalanceNonNative,
  withdrawNative,
  withdrawNonNative,
} from "../helpers/api";
import { SystemProgram, Transaction } from "@solana/web3.js";
import { expect } from "chai";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";

chai.use(chaiAsPromised);

const ctx = new Context();

before(async () => {
  await ctx.setup();
});

after(async () => {
  await ctx.teardown();
});

describe("Logic", () => {
  it("AllowPaymentMint", async () => {
    await allowPaymentMint(NATIVE_MINT, 10_000, ctx.mintListAuthority);

    const allowedPaymentMint0 =
      await CABOZ_PROGRAM.account.allowedPaymentMint.fetch(
        findAllowedPaymentMint(NATIVE_MINT)
      );
    expect(allowedPaymentMint0.paymentMint).to.eql(NATIVE_MINT);
    expect(allowedPaymentMint0.feeMultiplierBps).to.eql(10_000);

    await allowPaymentMint(ctx.trbMint, 7500, ctx.mintListAuthority);
    const allowedPaymentMint1 =
      await CABOZ_PROGRAM.account.allowedPaymentMint.fetch(
        findAllowedPaymentMint(ctx.trbMint)
      );
    expect(allowedPaymentMint1.paymentMint).to.eql(ctx.trbMint);
    expect(allowedPaymentMint1.feeMultiplierBps).to.eql(7500);
  });

  it("DisallowPaymentMint", async () => {
    await disallowPaymentMint(NATIVE_MINT, ctx.mintListAuthority);

    expect(
      await ctx.provider.connection.getAccountInfo(
        findAllowedPaymentMint(NATIVE_MINT)
      )
    ).to.eql(null);

    await allowPaymentMint(NATIVE_MINT, 10_000, ctx.mintListAuthority);

    const allowedPaymentMint =
      await CABOZ_PROGRAM.account.allowedPaymentMint.fetch(
        findAllowedPaymentMint(NATIVE_MINT)
      );
    expect(allowedPaymentMint.paymentMint).to.eql(NATIVE_MINT);
    expect(allowedPaymentMint.feeMultiplierBps).to.eql(10_000);
  });

  it("CreateOrder", async () => {
    const arweaveAddress = Array.from(
      new TextEncoder().encode("eSUeGbehTEAYy6P07yWQCpUMi947WaqCA6gI4NWejcM")
    );

    await createOrder(
      ctx.provider.connection,
      NATIVE_MINT,
      ctx.price,
      ctx.sharxCollectionNft.mint.address,
      { root: ctx.sharx012Root, arweaveAddress },
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[0]
    );

    const order0 = await CABOZ_PROGRAM.account.order.fetch(
      ctx.orders[0].publicKey
    );

    expect(order0.buyer).to.eql(ctx.buyer0.publicKey);
    expect(order0.price.toNumber()).to.eql(ctx.price);
    expect(order0.paymentMint).to.eql(NATIVE_MINT);
    expect(order0.buyerInkworkNftCount).to.eql(0);
    expect(order0.fee.toNumber()).to.eql(ctx.price / 100);
    expect(order0.collectionMint.equals(ctx.sharxCollectionNft.mint.address)).to
      .be.true;
    expect(order0.nftSet.root).to.eql(ctx.sharx012Root);
    expect(order0.nftSet.arweaveAddress).to.eql(arweaveAddress);
    expect(order0.creationTs.toNumber()).to.be.within(
      +new Date() / 1000 - 7,
      +new Date() / 1000
    );

    await ctx.mintInkworkNft(ctx.buyer0);
    await createOrder(
      ctx.provider.connection,
      ctx.trbMint,
      ctx.price,
      ctx.sharxCollectionNft.mint.address,
      undefined,
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[1]
    );
    const order1 = await CABOZ_PROGRAM.account.order.fetch(
      ctx.orders[1].publicKey
    );
    expect(order1.buyerInkworkNftCount).to.eql(1);
    expect(order1.fee.toNumber()).to.eql(((ctx.price * 0.5) / 100) * 0.75);

    await Promise.all([
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
    ]);
    await createOrder(
      ctx.provider.connection,
      NATIVE_MINT,
      ctx.price,
      ctx.sharxCollectionNft.mint.address,
      undefined,
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[2]
    );
    const order2 = await CABOZ_PROGRAM.account.order.fetch(
      ctx.orders[2].publicKey
    );
    expect(order2.buyerInkworkNftCount).to.eql(5);
    expect(order2.fee.toNumber()).to.eql((ctx.price * 0.25) / 100);

    await Promise.all([
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
      ctx.mintInkworkNft(ctx.buyer0),
    ]);
    await createOrder(
      ctx.provider.connection,
      NATIVE_MINT,
      ctx.price,
      ctx.sharxCollectionNft.mint.address,
      { root: ctx.sharx012Root, arweaveAddress },
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[3]
    );
    const order3 = await CABOZ_PROGRAM.account.order.fetch(
      ctx.orders[3].publicKey
    );
    expect(order3.buyerInkworkNftCount).to.eql(10);
    expect(order3.fee.toNumber()).to.eql(0);

    await createOrder(
      ctx.provider.connection,
      NATIVE_MINT,
      ctx.price,
      undefined,
      { root: ctx.soDead0123Root, arweaveAddress },
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[4]
    );

    await createOrder(
      ctx.provider.connection,
      ctx.trbMint,
      ctx.price,
      undefined,
      { root: ctx.soDead0123Root, arweaveAddress },
      ctx.inkworkCollectionNft.mint.address,
      ctx.buyer0,
      ctx.orders[5]
    );

    await expect(
      createOrder(
        ctx.provider.connection,
        NATIVE_MINT,
        ctx.price,
        undefined,
        undefined,
        ctx.inkworkCollectionNft.mint.address,
        ctx.buyer0,
        ctx.orders[6]
      )
    ).to.be.rejectedWith("UndefinedNftSet");
  });

  it("CreateWallet", async () => {
    await createWallet(ctx.buyer0);

    expect(
      await getWalletBalanceNative(
        ctx.provider.connection,
        ctx.buyer0.publicKey
      )
    ).to.eql(0);

    await ctx.provider.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: ctx.buyer0.publicKey,
          toPubkey: findWallet(ctx.buyer0.publicKey),
          lamports: 1_000_000,
        })
      ),
      [ctx.buyer0]
    );

    expect(
      await getWalletBalanceNative(
        ctx.provider.connection,
        ctx.buyer0.publicKey
      )
    ).to.eql(1_000_000);

    await ctx.provider.sendAndConfirm(
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          ctx.payer.publicKey,
          getAssociatedTokenAddressSync(
            ctx.trbMint,
            findWallet(ctx.buyer0.publicKey),
            true
          ),
          findWallet(ctx.buyer0.publicKey),
          ctx.trbMint
        )
      ),
      [ctx.payer]
    );
    await token.mintTo(
      ctx.provider.connection,
      ctx.payer,
      ctx.trbMint,
      getAssociatedTokenAddressSync(
        ctx.trbMint,
        findWallet(ctx.buyer0.publicKey),
        true
      ),
      ctx.trbMintAuthority,
      110_000
    );

    expect(
      await getWalletBalanceNonNative(
        ctx.provider.connection,
        ctx.buyer0.publicKey,
        ctx.trbMint
      )
    ).to.eql(110_000);
  });

  it("AcceptOrderNative", async () => {
    const walletBalanceBefore = await getWalletBalanceNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey
    );
    const feeBalanceBefore = await ctx.provider.connection.getBalance(
      ctx.feeReceiver.publicKey
    );

    await expect(
      acceptOrderNative(
        ctx.provider.connection,
        ctx.orders[0].publicKey,
        1,
        ctx.sharx012Tree
          .getProof(ctx.sharx0.mint.address.toBuffer())
          .map((x) => x.data),
        ctx.sharx0.mint.address,
        ctx.feeReceiver.publicKey,
        ctx.seller0
      )
    ).to.be.rejectedWith("PriceMismatch");

    await acceptOrderNative(
      ctx.provider.connection,
      ctx.orders[0].publicKey,
      ctx.price,
      ctx.sharx012Tree
        .getProof(ctx.sharx0.mint.address.toBuffer())
        .map((x) => x.data),
      ctx.sharx0.mint.address,
      ctx.feeReceiver.publicKey,
      ctx.seller0
    );

    const walletBalanceAfter = await getWalletBalanceNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey
    );
    const feeBalanceAfter = await ctx.provider.connection.getBalance(
      ctx.feeReceiver.publicKey
    );
    expect(walletBalanceBefore - walletBalanceAfter).to.eql(
      ctx.price + ctx.price / 100
    );
    expect(feeBalanceAfter - feeBalanceBefore).to.eql(ctx.price / 100);
    expect(
      Number(
        (
          await token.getAccount(
            ctx.provider.connection,
            getAssociatedTokenAddressSync(
              ctx.sharx0.mint.address,
              ctx.buyer0.publicKey
            )
          )
        ).amount
      )
    ).to.eql(1);

    const order = await CABOZ_PROGRAM.account.order.fetch(
      ctx.orders[0].publicKey
    );
    expect(order.completionReceipt.seller).to.eql(ctx.seller0.publicKey);
    expect(order.completionReceipt.soldNftMint.equals(ctx.sharx0.mint.address))
      .to.be.true;
    expect(order.completionReceipt.saleTs.toNumber()).to.be.within(
      +new Date() / 1000 - 7,
      +new Date() / 1000
    );

    await acceptOrderNative(
      ctx.provider.connection,
      ctx.orders[4].publicKey,
      ctx.price,
      ctx.soDeadTree
        .getProof(ctx.soDead2.mint.address.toBuffer())
        .map((x) => x.data),
      ctx.soDead2.mint.address,
      ctx.feeReceiver.publicKey,
      ctx.seller0
    );
  });

  it("AcceptOrderNonNative", async () => {
    const walletBalanceBefore = await getWalletBalanceNonNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey,
      ctx.trbMint
    );
    const feeBalanceBefore = Number(
      (
        await token.getAccount(
          ctx.provider.connection,
          getAssociatedTokenAddressSync(ctx.trbMint, ctx.feeReceiver.publicKey)
        )
      ).amount
    );

    await acceptOrderNonNative(
      ctx.provider.connection,
      ctx.orders[1].publicKey,
      ctx.price,
      [],
      ctx.sharx1.mint.address,
      ctx.feeReceiver.publicKey,
      ctx.seller0
    );

    const walletBalanceAfter = await getWalletBalanceNonNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey,
      ctx.trbMint
    );
    const feeBalanceAfter = Number(
      (
        await token.getAccount(
          ctx.provider.connection,
          getAssociatedTokenAddressSync(ctx.trbMint, ctx.feeReceiver.publicKey)
        )
      ).amount
    );
    expect(walletBalanceBefore - walletBalanceAfter).to.eql(
      ctx.price + (((ctx.price * 0.5) / 100) * 75) / 100
    );
    expect(feeBalanceAfter - feeBalanceBefore).to.eql(
      ((ctx.price * 0.5) / 100) * 0.75
    );
    expect(
      Number(
        (
          await token.getAccount(
            ctx.provider.connection,
            getAssociatedTokenAddressSync(
              ctx.sharx1.mint.address,
              ctx.buyer0.publicKey
            )
          )
        ).amount
      )
    ).to.eql(1);
  });

  it("CloseOrder", async () => {
    await closeOrder(ctx.orders[2].publicKey, ctx.buyer0);

    expect(
      await ctx.provider.connection.getAccountInfo(ctx.orders[2].publicKey)
    ).to.eql(null);

    await expect(
      closeOrder(ctx.orders[1].publicKey, ctx.buyer0)
    ).to.be.rejectedWith("OrderNotOpen");
  });

  it("WithdrawNative", async () => {
    const walletBalanceBefore = await getWalletBalanceNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey
    );

    const amount = 110_000;
    await withdrawNative(amount, ctx.buyer0);

    const walletBalanceAfter = await getWalletBalanceNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey
    );
    expect(walletBalanceBefore - walletBalanceAfter).to.eql(amount);
  });

  it("WithdrawNonNative", async () => {
    const walletBalanceBefore = await getWalletBalanceNonNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey,
      ctx.trbMint
    );

    const amount = 100;
    await withdrawNonNative(
      ctx.provider.connection,
      ctx.trbMint,
      amount,
      ctx.buyer0
    );

    const walletBalanceAfter = await getWalletBalanceNonNative(
      ctx.provider.connection,
      ctx.buyer0.publicKey,
      ctx.trbMint
    );
    expect(walletBalanceBefore - walletBalanceAfter).to.eql(amount);
  });
});

describe("Security", () => {
  it("AllowPaymentMint", async () => {
    await expect(
      allowPaymentMint(ctx.inkworkCollectionNft.mint.address, 0, ctx.hacker)
    ).to.be.rejectedWith("ConstraintAddress");
  });

  it("DisallowPaymentMint", async () => {
    await expect(
      disallowPaymentMint(NATIVE_MINT, ctx.hacker)
    ).to.be.rejectedWith("ConstraintAddress");
  });

  it("AcceptOrderNative", async () => {
    await expect(
      acceptOrderNative(
        ctx.provider.connection,
        ctx.orders[4].publicKey,
        ctx.price,
        ctx.soDeadTree
          .getProof(ctx.soDead3.mint.address.toBuffer())
          .map((x) => x.data),
        ctx.soDead3.mint.address,
        ctx.feeReceiver.publicKey,
        ctx.hacker
      )
    ).to.be.rejectedWith("OrderNotOpen");

    const nft = await ctx.mintInkworkNft(ctx.hacker);
    await expect(
      acceptOrderNative(
        ctx.provider.connection,
        ctx.orders[3].publicKey,
        ctx.price,
        [],
        nft.mintAddress,
        ctx.feeReceiver.publicKey,
        ctx.hacker
      )
    ).to.be.rejectedWith("ConstraintCollection");

    await expect(
      acceptOrderNative(
        ctx.provider.connection,
        ctx.orders[3].publicKey,
        ctx.price,
        [],
        ctx.sharx3.mint.address,
        ctx.feeReceiver.publicKey,
        ctx.hacker
      )
    ).to.be.rejectedWith("NFTNotInSet");

    await expect(
      acceptOrderNative(
        ctx.provider.connection,
        ctx.orders[5].publicKey,
        ctx.price,
        ctx.soDeadTree
          .getProof(ctx.soDead3.mint.address.toBuffer())
          .map((x) => x.data),
        ctx.soDead3.mint.address,
        ctx.feeReceiver.publicKey,
        ctx.hacker
      )
    ).to.be.rejectedWith("PaymentMintNotNative");
  });

  it("AcceptOrderNonNative", async () => {
    await expect(
      acceptOrderNonNative(
        ctx.provider.connection,
        ctx.orders[5].publicKey,
        ctx.price,
        [],
        ctx.sharx3.mint.address,
        ctx.feeReceiver.publicKey,
        ctx.hacker
      )
    ).to.be.rejectedWith("NFTNotInSet");
  });
});
