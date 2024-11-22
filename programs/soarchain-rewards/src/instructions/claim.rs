use crate::*;
use anchor_spl::token::{Token, TokenAccount};
use soarchain_staking::{SoarchainStakingError, StakeAccount};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, has_one = vault @ SoarchainError::InvalidVault)]
    pub reflection: Account<'info, ReflectionAccount>,
    #[account(mut, has_one = authority @ SoarchainError::Unauthorized)]
    pub reward: Account<'info, RewardAccount>,
    #[account(
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded,
        constraint = stake.xsoar >= reward.xsoar @ SoarchainStakingError::Decreased,
    )]
    pub stake: Account<'info, StakeAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Claim<'info> {
    pub fn handler(&mut self) -> Result<()> {
        // determine amount to claim
        let amount: u128 = self.reward.get_amount(self.reflection.rate);
        if amount == 0 {
            return Ok(());
        }

        // decrease the reflection pool
        self.reflection
            .remove_rewards_account(self.reward.reflection, self.reward.xsoar + amount)?;

        // re-enter the pool with the current stake
        self.reward.update(
            self.reflection.add_rewards_account(self.stake.xsoar, 0),
            self.stake.xsoar,
        )?;

        // pay-out pending reward
        transfer_tokens_from_vault!(
            self,
            user,
            seeds!(self.reflection, self.vault),
            amount.try_into().unwrap()
        )
    }
}
