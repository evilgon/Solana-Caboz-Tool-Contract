use anchor_lang::prelude::*;

pub fn transfer(from: &AccountInfo, to: &AccountInfo, lamports: u64) -> Result<()> {
    **from.try_borrow_mut_lamports()? = (from.lamports())
        .checked_sub(lamports)
        .ok_or(ProgramError::InsufficientFunds)?;
    **to.try_borrow_mut_lamports()? += lamports;
    Ok(())
}

pub fn merkle_verify(proof: &[[u8; 32]], root: [u8; 32], leaf: [u8; 32]) -> bool {
    let mut computed_hash = leaf;
    for proof_element in proof.iter() {
        let vals: [&[u8]; 2] = if computed_hash <= *proof_element {
            [&computed_hash, proof_element]
        } else {
            [proof_element, &computed_hash]
        };
        computed_hash = solana_program::keccak::hashv(&vals).0;
    }
    computed_hash == root
}
