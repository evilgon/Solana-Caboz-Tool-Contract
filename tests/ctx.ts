import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { airdrop, transferEverything } from "../helpers/utils";
import * as token from "@solana/spl-token";
import {
  CreateNftOutput,
  keypairIdentity,
  Metaplex,
  Nft,
} from "@metaplex-foundation/js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

export class Context {
  provider: AnchorProvider;
  payer: Keypair;

  airdropKeypairs: Keypair[];

  hacker: Keypair;

  mintListAuthority: Keypair;
  feeReceiver: Keypair;

  buyer0: Keypair;
  seller0: Keypair;

  inkworkCollectionNft: Nft;

  sharxCollectionAuthority: Keypair;
  sharxCollectionNft: Nft;

  sharx0: Nft;
  sharx1: Nft;
  sharx2: Nft;
  sharx3: Nft;
  sharx012Tree: MerkleTree;
  sharx012Root: number[];

  soDead0: Nft;
  soDead1: Nft;
  soDead2: Nft;
  soDead3: Nft;
  soDeadTree: MerkleTree;
  soDead0123Root: number[];

  trbMint: PublicKey;
  trbMintAuthority: Keypair;

  orders: Keypair[];

  price: number;

  constructor() {
    this.provider = anchor.AnchorProvider.env();
    anchor.setProvider(this.provider);
    this.payer = (this.provider.wallet as NodeWallet).payer;

    this.hacker = new Keypair();
    this.mintListAuthority = Keypair.fromSecretKey(
      new Uint8Array(require("./accounts/mintListAuthority"))
    );
    this.feeReceiver = Keypair.fromSecretKey(
      new Uint8Array(require("./accounts/feeReceiver"))
    );
    this.sharxCollectionAuthority = new Keypair();
    this.buyer0 = new Keypair();
    this.seller0 = new Keypair();
    this.trbMintAuthority = new Keypair();

    this.orders = Array.from({ length: 10 }, () => new Keypair());
    this.price = 100_000;

    this.airdropKeypairs = [
      this.hacker,
      this.mintListAuthority,
      this.feeReceiver,
      this.sharxCollectionAuthority,
      this.buyer0,
      this.seller0,
      this.trbMintAuthority,
    ];
  }

  async setup(): Promise<void> {
    await airdrop(
      this.provider.connection,
      this.airdropKeypairs.map((k) => k.publicKey),
      this.payer
    );

    this.inkworkCollectionNft = (
      await new Metaplex(this.provider.connection)
        .use(keypairIdentity(this.payer))
        .nfts()
        .create({
          name: "Inkwork Labs #1",
          symbol: "IWL",
          uri: "",
          sellerFeeBasisPoints: 0,
          isCollection: true,
          useExistingMint: new PublicKey(
            "FdkitqFFz7U65o3v7kjQ6neNGz3DwdQ36pqCELcsMG9s"
          ),
        })
    ).nft;

    this.sharxCollectionNft = (
      await new Metaplex(this.provider.connection)
        .use(keypairIdentity(this.sharxCollectionAuthority))
        .nfts()
        .create({
          name: "Sharx Collection",
          symbol: "SHARX",
          uri: "",
          sellerFeeBasisPoints: 0,
          isCollection: true,
        })
    ).nft;

    [this.sharx0, this.sharx1, this.sharx2, this.sharx3] = (
      await Promise.all([
        this.mintSharxNft(this.seller0),
        this.mintSharxNft(this.seller0),
        this.mintSharxNft(this.seller0),
        this.mintSharxNft(this.hacker),
      ])
    ).map((x) => x.nft);

    this.sharx012Tree = new MerkleTree(
      [
        this.sharx0.mint.address.toBuffer(),
        this.sharx1.mint.address.toBuffer(),
        this.sharx2.mint.address.toBuffer(),
      ],
      keccak256,
      { sortPairs: true, hashLeaves: false }
    );
    this.sharx012Root = Array.from(this.sharx012Tree.getRoot());

    [this.soDead0, this.soDead1, this.soDead2, this.soDead3] = (
      await Promise.all([
        this.mintSoDeadNft(this.seller0),
        this.mintSoDeadNft(this.seller0),
        this.mintSoDeadNft(this.seller0),
        this.mintSoDeadNft(this.hacker),
      ])
    ).map((x) => x.nft);

    this.soDeadTree = new MerkleTree(
      [
        this.soDead0.mint.address.toBuffer(),
        this.soDead1.mint.address.toBuffer(),
        this.soDead2.mint.address.toBuffer(),
        this.soDead3.mint.address.toBuffer(),
      ].concat(
        Array.from({ length: 20000 }, () => new Keypair().publicKey.toBuffer())
      ),
      keccak256,
      { sortPairs: true, hashLeaves: false }
    );
    this.soDead0123Root = Array.from(this.soDeadTree.getRoot());

    this.trbMint = await token.createMint(
      this.provider.connection,
      this.payer,
      this.trbMintAuthority.publicKey,
      this.trbMintAuthority.publicKey,
      6
    );

    await this.provider.sendAndConfirm(
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.feeReceiver.publicKey,
          getAssociatedTokenAddressSync(
            this.trbMint,
            this.feeReceiver.publicKey
          ),
          this.feeReceiver.publicKey,
          this.trbMint
        )
      ),
      [this.feeReceiver]
    );
  }

  async teardown(): Promise<void> {
    await transferEverything(
      this.provider.connection,
      this.airdropKeypairs,
      this.payer
    );
  }

  async mintInkworkNft(owner: Keypair): Promise<CreateNftOutput> {
    return await new Metaplex(this.provider.connection)
      .use(keypairIdentity(owner))
      .nfts()
      .create({
        name: "Inkwork NFT",
        symbol: "INK",
        uri: "",
        sellerFeeBasisPoints: 0,
        collection: this.inkworkCollectionNft.mint.address,
        collectionAuthority: this.payer,
      });
  }

  async mintSharxNft(owner: Keypair): Promise<CreateNftOutput> {
    return await new Metaplex(this.provider.connection)
      .use(keypairIdentity(owner))
      .nfts()
      .create({
        name: "Sharx NFT",
        symbol: "SHX",
        uri: "https://arweave.net/y5e5DJsiwH0s_ayfMwYk-SnrZtVZzHLQDSTZ5dNRUHA",
        sellerFeeBasisPoints: 0,
        collection: this.sharxCollectionNft.mint.address,
        collectionAuthority: this.sharxCollectionAuthority,
      });
  }

  async mintSoDeadNft(owner: Keypair): Promise<CreateNftOutput> {
    return await new Metaplex(this.provider.connection)
      .use(keypairIdentity(owner))
      .nfts()
      .create({
        name: "SoDead NFT",
        symbol: "SD",
        uri: "https://arweave.net/y5e5DJsiwH0s_ayfMwYk-SnrZtVZzHLQDSTZ5dNRUHA",
        sellerFeeBasisPoints: 0,
      });
  }
}
