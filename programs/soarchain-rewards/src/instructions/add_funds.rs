use crate::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct AddFunds<'info> {
    #[account(mut)]
    pub user: Account<'info, TokenAccount>,
    #[account(mut, has_one = vault @ SoarchainError::InvalidVault)]
    pub reflection: Account<'info, ReflectionAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> AddFunds<'info> {
    pub fn handler(&mut self, amount: u64) -> Result<()> {
        self.reflection.add_funds(u128::from(amount));
        transfer_tokens_to_vault!(self, amount)
    }
}
