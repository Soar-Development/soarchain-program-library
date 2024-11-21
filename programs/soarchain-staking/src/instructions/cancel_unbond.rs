use crate::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct CancelUnbond<'info> {
    #[account(
        mut,
        constraint = vault.amount >= StakeAccount::STAKE_MINIMUM
            @ SoarchainStakingError::AmountNotEnough,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = vault @ SoarchainError::InvalidVault,
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond != 0 @ SoarchainStakingError::AlreadyStaked,
    )]
    pub stake: Account<'info, StakeAccount>,
    pub authority: Signer<'info>,
}

impl<'info> CancelUnbond<'info> {
    pub fn handler(&mut self) -> Result<()> {
        self.stake.cancel_unbond(self.vault.amount)
    }
}
