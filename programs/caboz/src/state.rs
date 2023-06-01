// required to suppress `AnchorSerialize` warning,
// which is in turn needed for type to show up in IDL
#![allow(unaligned_references)]

use anchor_lang::prelude::*;

// `AnchorSerialize` is only needed for IDL to pick up this type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(packed)]
pub struct CompletionReceipt {
    pub seller: Pubkey,
    pub sold_nft_mint: Pubkey,
    pub sale_ts: i64,
}

// `AnchorSerialize` is only needed for IDL to pick up this type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(packed)]
pub struct MerkleTree {
    pub root: [u8; 32],
    /// the part that goes after arweave.net/ in the URI of file with the full set
    /// such as b"eSUeGbehTEAYy6P07yWQCpUMi947WaqCA6gI4NWejcM"
    pub arweave_address: [u8; 43],
}

#[account(zero_copy)]
#[derive(Debug)]
#[repr(packed)]
pub struct Order {
    pub buyer: Pubkey,
    /// zeroed if order is open
    pub completion_receipt: CompletionReceipt,
    pub payment_mint: Pubkey,
    pub price: u64,
    /// amount of buyer's Inkwork NFTs at the moment of order creation.
    /// may be used to prioritize holders
    pub buyer_inkwork_nft_count: u8,
    pub fee: u64,
    /// address of desired collection mint.
    /// zeroed if none
    pub collection_mint: Pubkey,
    /// the set of wanted NFTs.
    /// zeroed if none
    pub nft_set: MerkleTree,
    /// creation timestamp
    pub creation_ts: i64,
}

#[account(zero_copy)]
#[derive(Debug)]
#[repr(packed)]
pub struct AllowedPaymentMint {
    pub payment_mint: Pubkey,
    /// fee multiplier in basis points, e.g. 7500 for 25% off
    pub fee_multiplier_bps: u16,
}
