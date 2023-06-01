#![allow(clippy::result_large_err)]
#![feature(array_chunks)]

use crate::{instructions::*, state::*};
use anchor_lang::prelude::*;

pub mod config;
pub mod error;
mod instructions;
pub mod state;
mod utils;

declare_id!("133Sr1TwJf1uxJj1N5vtGSHZMDmbNJFpxxZTNhr84PJU");

#[program]
pub mod caboz {
    use super::*;

    /// whitelist mint to allow orders in it
    pub fn allow_payment_mint(
        ctx: Context<AllowPaymentMint>,
        fee_multiplier_bps: u16,
    ) -> Result<()> {
        instructions::allow_payment_mint(ctx, fee_multiplier_bps)
    }

    /// remove payment mint from whitelist,
    /// can be used in combination with `allow_payment_mint` to change fee multiplier
    pub fn disallow_payment_mint(ctx: Context<DisallowPaymentMint>) -> Result<()> {
        instructions::disallow_payment_mint(ctx)
    }

    /// create an order, passing up to 10 buyer's Inkwork NFT
    /// pairs of (TokenAccount, Metadata) in remaining_accounts
    pub fn create_order(
        ctx: Context<CreateOrder>,
        price: u64,
        collection_mint: Pubkey,
        nft_set: MerkleTree,
    ) -> Result<()> {
        instructions::create_order(ctx, price, collection_mint, nft_set)
    }

    /// sell NFT for SOL
    pub fn accept_order_native(
        ctx: Context<AcceptOrder>,
        expected_price: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::accept_order_native(ctx, expected_price, &proof)
    }

    /// sell NFT for an SPL token
    pub fn accept_order_non_native(
        ctx: Context<AcceptOrderNonNative>,
        expected_price: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::accept_order_non_native(ctx, expected_price, &proof)
    }

    /// make order unavailable for trading
    pub fn close_order(ctx: Context<CloseOrder>) -> Result<()> {
        instructions::close_order(ctx)
    }

    /// create a virtual wallet to then deposit tokens into it
    pub fn create_wallet(ctx: Context<CreateWallet>) -> Result<()> {
        instructions::create_wallet(ctx)
    }

    /// withdraw SOL from a wallet
    pub fn withdraw_native(ctx: Context<Withdraw>, lamports: u64) -> Result<()> {
        instructions::withdraw_native(ctx, lamports)
    }

    /// withdraw SPL tokens from wallet's token account
    pub fn withdraw_non_native(ctx: Context<WithdrawNonNative>, amount: u64) -> Result<()> {
        instructions::withdraw_non_native(ctx, amount)
    }
}
