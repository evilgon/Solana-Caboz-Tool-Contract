use crate::{config::*, error::*, state::*, utils::*};
use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::MetadataAccount,
    token::spl_token::native_mint::ID as NATIVE_MINT,
    token::{self, Token, TokenAccount},
};
use mpl_token_metadata::state::Collection;

#[derive(Accounts)]
pub struct AcceptOrder<'info> {
    buyer: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"wallet", buyer.key().as_ref()], bump)]
    buyer_wallet: UncheckedAccount<'info>,
    #[account(
        mut,
        /*associated_*/token::authority = buyer,
        /*associated_*/token::mint = seller_nft_token_account.mint,
    )]
    buyer_nft_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = buyer,
        constraint = order.load()?.completion_receipt.sale_ts == 0 @ CabozError::OrderNotOpen,
    )]
    order: AccountLoader<'info, Order>,
    #[account(
        seeds = [
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            seller_nft_token_account.mint.as_ref(),
        ],
        seeds::program = mpl_token_metadata::ID,
        bump,
    )]
    nft_metadata: Account<'info, MetadataAccount>,
    #[account(mut)]
    seller: Signer<'info>,
    #[account(mut, token::authority = seller)]
    seller_nft_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = FEE_RECEIVER)]
    fee_receiver: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptOrderNonNative<'info> {
    accept_order: AcceptOrder<'info>,
    #[account(
        mut,
        /*associated_*/token::authority = accept_order.buyer_wallet,
        /*associated_*/token::mint = accept_order.order.load()?.payment_mint,
    )]
    buyer_wallet_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    seller_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        /*associated_*/token::authority = accept_order.fee_receiver,
        /*associated_*/token::mint = accept_order.order.load()?.payment_mint,
    )]
    fee_receiver_token_account: Box<Account<'info, TokenAccount>>,
}

fn accept_order(accounts: &mut AcceptOrder, expected_price: u64, proof: &[[u8; 32]]) -> Result<()> {
    let order = &mut accounts.order.load_mut()?;

    if order.price != expected_price {
        return err!(CabozError::PriceMismatch);
    }

    if order.collection_mint.to_bytes() != [0; 32]
        && accounts.nft_metadata.collection
            != Some(Collection {
                verified: true,
                key: order.collection_mint,
            })
    {
        return err!(CabozError::ConstraintCollection);
    }

    if order.nft_set.root != [0; 32]
        && !merkle_verify(
            proof,
            order.nft_set.root,
            accounts.seller_nft_token_account.mint.to_bytes(),
        )
    {
        return err!(CabozError::NFTNotInSet);
    }

    order.completion_receipt = CompletionReceipt {
        seller: accounts.seller.key(),
        sold_nft_mint: accounts.seller_nft_token_account.mint,
        sale_ts: Clock::get()?.unix_timestamp,
    };

    token::transfer(
        CpiContext::new(
            accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: accounts.seller_nft_token_account.to_account_info(),
                to: accounts.buyer_nft_token_account.to_account_info(),
                authority: accounts.seller.to_account_info(),
            },
        ),
        1,
    )
}

pub fn accept_order_native(
    ctx: Context<AcceptOrder>,
    expected_price: u64,
    proof: &[[u8; 32]],
) -> Result<()> {
    accept_order(ctx.accounts, expected_price, proof)?;

    let order = &ctx.accounts.order.load()?;

    if order.payment_mint != NATIVE_MINT {
        return err!(CabozError::PaymentMintNotNative);
    }

    transfer(
        &ctx.accounts.buyer_wallet.to_account_info(),
        &ctx.accounts.seller,
        order.price,
    )?;
    transfer(
        &ctx.accounts.buyer_wallet.to_account_info(),
        &ctx.accounts.fee_receiver,
        order.fee,
    )?;

    Ok(())
}

pub fn accept_order_non_native(
    ctx: Context<AcceptOrderNonNative>,
    expected_price: u64,
    proof: &[[u8; 32]],
) -> Result<()> {
    accept_order(&mut ctx.accounts.accept_order, expected_price, proof)?;

    let order = &ctx.accounts.accept_order.order.load()?;

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.accept_order.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.buyer_wallet_token_account.to_account_info(),
                to: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.accept_order.buyer_wallet.to_account_info(),
            },
            &[&[
                b"wallet",
                ctx.accounts.accept_order.buyer.key().as_ref(),
                &[*ctx.bumps.get("buyer_wallet").unwrap()],
            ]],
        ),
        order.price,
    )?;
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.accept_order.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.buyer_wallet_token_account.to_account_info(),
                to: ctx.accounts.fee_receiver_token_account.to_account_info(),
                authority: ctx.accounts.accept_order.buyer_wallet.to_account_info(),
            },
            &[&[
                b"wallet",
                ctx.accounts.accept_order.buyer.key().as_ref(),
                &[*ctx.bumps.get("buyer_wallet").unwrap()],
            ]],
        ),
        order.fee,
    )?;

    Ok(())
}
