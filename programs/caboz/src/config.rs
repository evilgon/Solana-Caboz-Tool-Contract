use anchor_lang::prelude::*;
use solana_program::pubkey;

/// authority that can (dis)allow payment mints
#[constant]
pub const MINT_LIST_AUTHORITY: Pubkey = pubkey!("2cJ9pLhz8cvqVi5eaiPLZS5WWDMzD18PhJ9uc4NRQ6PG");
/// address to tranfer fees to
#[constant]
pub const FEE_RECEIVER: Pubkey = pubkey!("GYFSYhaagL1Z9njJbAUj4uvrU2uvPPL6vJJhn7MqL55y");
/// Inkwork NFT collection mint address
#[constant]
pub const INKWORK_COLLECTION_MINT: Pubkey = pubkey!("FdkitqFFz7U65o3v7kjQ6neNGz3DwdQ36pqCELcsMG9s");
