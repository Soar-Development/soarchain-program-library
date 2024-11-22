use crate::*;
use soarchain_staking::{SoarchainStakingError, StakeAccount};

#[derive(Accounts)]
pub struct Sync<'info> {
    #[account(mut)]
    pub reward: Account<'info, RewardAccount>,
    #[account(
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded,
        constraint = stake.authority == reward.authority @ SoarchainError::Unauthorized,
    )]
    pub stake: Account<'info, StakeAccount>,
    #[account(mut)]
    pub reflection: Account<'info, ReflectionAccount>,
}

impl<'info> Sync<'info> {
    pub fn handler(&mut self) -> Result<()> {
        // decrease the reflection pool
        self.reflection
            .remove_rewards_account(self.reward.reflection, self.reward.xsoar)?;

        // re-enter the pool with the current stake
        let amount: u128 = self.reward.get_amount(self.reflection.rate);
        self.reward.update(
            self.reflection.add_rewards_account(self.stake.xsoar, amount),
            self.stake.xsoar,
        )
    }
}
