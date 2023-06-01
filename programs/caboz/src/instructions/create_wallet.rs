use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CreateWallet<'info> {
    #[account(mut)]
    buyer: Signer<'info>,
    #[account(
        init,
        payer = buyer,
        space = 0,
        seeds = [b"wallet", buyer.key().as_ref()],
        bump,
    )]
    buyer_wallet: UncheckedAccount<'info>,
    system_program: Program<'info, System>,
}

pub fn create_wallet(_ctx: Context<CreateWallet>) -> Result<()> {
    Ok(())
}
