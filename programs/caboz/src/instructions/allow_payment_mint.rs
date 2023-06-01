use crate::{config::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use core::mem::size_of;

#[derive(Accounts)]
pub struct AllowPaymentMint<'info> {
    #[account(mut, address = MINT_LIST_AUTHORITY)]
    mint_list_authority: Signer<'info>,
    payment_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = mint_list_authority,
        space = 8 + size_of::<AllowedPaymentMint>(),
        seeds = [b"allowed_payment_mint", payment_mint.key().as_ref()],
        bump,
    )]
    allowed_payment_mint: AccountLoader<'info, AllowedPaymentMint>,
    system_program: Program<'info, System>,
}

pub fn allow_payment_mint(ctx: Context<AllowPaymentMint>, fee_multiplier_bps: u16) -> Result<()> {
    let allowed_payment_mint = &mut ctx.accounts.allowed_payment_mint.load_init()?;
    allowed_payment_mint.payment_mint = ctx.accounts.payment_mint.key();
    allowed_payment_mint.fee_multiplier_bps = fee_multiplier_bps;
    Ok(())
}
