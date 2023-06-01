use anchor_lang::prelude::*;

#[error_code]
pub enum CabozError {
    /// 6000 0x1770
    #[msg("Cannot pass the same NFT several times")]
    DuplicateNFT,
    /// 6001 0x1771
    #[msg("NFT collection is not as expected or is not verified")]
    ConstraintCollection,
    /// 6002 0x1772
    #[msg("Order is not open")]
    OrderNotOpen,
    /// 6003 0x1773
    #[msg("NFT is not in set")]
    NFTNotInSet,
    /// 6004 0x1774
    #[msg("Neither collection address nor merkle root were provided")]
    UndefinedNftSet,
    /// 6005 0x1775
    #[msg("Payment mint is not native")]
    PaymentMintNotNative,
    /// 6006 0x1776
    #[msg("Price mismatch")]
    PriceMismatch,
}
