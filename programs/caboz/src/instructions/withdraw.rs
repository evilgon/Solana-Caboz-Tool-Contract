use crate::utils::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"wallet", buyer.key().as_ref()],
        bump,
    )]
    buyer_wallet: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawNonNative<'info> {
    withdraw: Withdraw<'info>,
    #[account(mut, token::authority = withdraw.buyer_wallet)]
    buyer_wallet_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

pub fn withdraw_native(ctx: Context<Withdraw>, lamports: u64) -> Result<()> {
    transfer(
        &ctx.accounts.buyer_wallet.to_account_info(),
        &ctx.accounts.buyer.to_account_info(),
        lamports,
    )
}

pub fn withdraw_non_native(ctx: Context<WithdrawNonNative>, amount: u64) -> Result<()> {
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.buyer_wallet_token_account.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.withdraw.buyer_wallet.to_account_info(),
            },
            &[&[
                b"wallet",
                ctx.accounts.withdraw.buyer.key().as_ref(),
                &[*ctx.bumps.get("buyer_wallet").unwrap()],
            ]],
        ),
        amount,
    )
}
