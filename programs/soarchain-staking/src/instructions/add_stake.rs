use crate::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct AddStake<'info> {
    #[account(mut)]
    pub user: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        has_one = vault @ SoarchainError::InvalidVault,
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded,
    )]
    pub stake: Account<'info, StakeAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> AddStake<'info> {
    pub fn handler(&mut self, amount: u64) -> Result<()> {
        // test amount
        require!(amount > 0, SoarchainStakingError::AmountNotEnough);

        // get stake account and add_stake 
        self.stake.add_stake(amount);

        // transfer tokens to the vault
        transfer_tokens_to_vault!(self, amount)
    }
}
