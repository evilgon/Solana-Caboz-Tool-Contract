use crate::{config::*, error::*, state::*};
use anchor_lang::prelude::{ErrorCode, *};
use anchor_spl::{metadata::MetadataAccount, token::TokenAccount};
use core::mem::size_of;
use mpl_token_metadata::state::Collection;

#[derive(Accounts)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    buyer: Signer<'info>,
    #[account(
        init,
        payer = buyer,
        space = 8 + size_of::<Order>(),
    )]
    order: AccountLoader<'info, Order>,
    #[account(
        seeds = [b"allowed_payment_mint", allowed_payment_mint.load()?.payment_mint.as_ref()],
        bump,
    )]
    allowed_payment_mint: AccountLoader<'info, AllowedPaymentMint>,
    system_program: Program<'info, System>,
}

pub fn create_order(
    ctx: Context<CreateOrder>,
    price: u64,
    collection_mint: Pubkey,
    nft_set: MerkleTree,
) -> Result<()> {
    if collection_mint == Pubkey::default() && nft_set.root == [0; 32] {
        return err!(CabozError::UndefinedNftSet);
    }

    let allowed_payment_mint = &ctx.accounts.allowed_payment_mint.load()?;
    let order = &mut ctx.accounts.order.load_init()?;
    order.buyer = ctx.accounts.buyer.key();
    order.payment_mint = allowed_payment_mint.payment_mint;
    order.price = price;
    order.buyer_inkwork_nft_count = ctx.remaining_accounts.len() as u8 / 2;
    let fee_bps = match order.buyer_inkwork_nft_count {
        0 => 100,
        1..=4 => 50,
        5..=9 => 25,
        10.. => 0,
    };
    order.fee = (price as u128 * fee_bps * allowed_payment_mint.fee_multiplier_bps as u128
        / 10_000_u128.pow(2)) as _;
    order.collection_mint = collection_mint;
    order.nft_set = nft_set;
    order.creation_ts = Clock::get()?.unix_timestamp;

    if ctx.remaining_accounts.len() as u8 % 2 != 0 {
        return err!(ErrorCode::AccountNotEnoughKeys);
    }

    for i in (0..ctx.remaining_accounts.len()).step_by(2) {
        for j in (i + 2..ctx.remaining_accounts.len()).step_by(2) {
            if ctx.remaining_accounts[i].key() == ctx.remaining_accounts[j].key() {
                return err!(CabozError::DuplicateNFT);
            }
        }
    }

    for [inkwork_nft_token_account, inkwork_nft_metadata] in ctx.remaining_accounts.array_chunks() {
        let inkwork_nft_token_account =
            Account::<TokenAccount>::try_from(inkwork_nft_token_account)?;
        if inkwork_nft_token_account.owner != ctx.accounts.buyer.key() {
            return err!(ErrorCode::ConstraintTokenOwner);
        }
        if inkwork_nft_token_account.amount != 1 {
            Err(ProgramError::InsufficientFunds)?;
        }

        let inkwork_nft_metadata = Account::<MetadataAccount>::try_from(inkwork_nft_metadata)?;
        if inkwork_nft_token_account.mint != inkwork_nft_metadata.mint {
            return err!(ErrorCode::ConstraintTokenMint);
        }
        if inkwork_nft_metadata.collection
            != Some(Collection {
                verified: true,
                key: INKWORK_COLLECTION_MINT,
            })
        {
            return err!(CabozError::ConstraintCollection);
        }
    }

    Ok(())
}
