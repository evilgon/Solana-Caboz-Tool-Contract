use crate::{error::*, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseOrder<'info> {
    #[account(mut)]
    buyer: Signer<'info>,
    #[account(
        mut,
        has_one = buyer,
        constraint = order.load()?.completion_receipt.sale_ts == 0 @ CabozError::OrderNotOpen,
        close = buyer,
    )]
    order: AccountLoader<'info, Order>,
}

pub fn close_order(_ctx: Context<CloseOrder>) -> Result<()> {
    Ok(())
}
