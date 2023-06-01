use crate::{config::*, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct DisallowPaymentMint<'info> {
    #[account(mut, address = MINT_LIST_AUTHORITY)]
    mint_list_authority: Signer<'info>,
    #[account(
        mut,
        close = mint_list_authority,
        seeds = [b"allowed_payment_mint", allowed_payment_mint.load()?.payment_mint.as_ref()],
        bump,
    )]
    allowed_payment_mint: AccountLoader<'info, AllowedPaymentMint>,
}

pub fn disallow_payment_mint(_ctx: Context<DisallowPaymentMint>) -> Result<()> {
    Ok(())
}
