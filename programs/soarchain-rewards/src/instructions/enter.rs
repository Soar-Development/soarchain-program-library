use crate::*;
use soarchain_staking::{SoarchainStakingError, StakeAccount};

#[derive(Accounts)]
pub struct Enter<'info> {
    #[account(mut)]
    pub reflection: Account<'info, ReflectionAccount>,
    #[account(
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded
    )]
    pub stake: Account<'info, StakeAccount>,
    #[account(
        init,
        payer = authority,
        space = RewardAccount::SIZE,
        seeds = [ constants::PREFIX_REWARDS.as_ref(), authority.key().as_ref() ],
        bump,
    )]
    pub reward: Account<'info, RewardAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Enter<'info> {
    pub fn handler(&mut self, bump: u8) -> Result<()> {
        self.reward.init(
            self.authority.key(),
            bump,
            self.reflection.add_rewards_account(self.stake.xsoar, 0),
            self.stake.xsoar,
        )
    }
}
