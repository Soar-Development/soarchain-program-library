use crate::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Account<'info, TokenAccount>,
    #[account(mut, constraint = vault.amount != 0 @ SoarchainError::VaultEmpty)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = vault @ SoarchainError::InvalidVault,
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond != 0 @ SoarchainStakingError::NotUnbonded,
    )]
    pub stake: Account<'info, StakeAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Withdraw<'info> {
    pub fn handler(&self) -> Result<()> {
        let amount: u64 = self
            .stake
            .withdraw(self.vault.amount, Clock::get()?.unix_timestamp);
        if amount > 0 {
            transfer_tokens_from_vault!(self, user, seeds!(self.stake, self.vault), amount)
        } else {
            Ok(())
        }
    }
}
