use crate::*;

#[derive(Accounts)]
pub struct Extend<'info> {
    #[account(
        mut,
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded,
    )]
    pub stake: Account<'info, StakeAccount>,
    pub authority: Signer<'info>,
}

impl<'info> Extend<'info> {
    pub fn handler(&mut self, duration: u64) -> Result<()> {
        // test duration
        require!(duration > 0, SoarchainStakingError::DurationTooShort);

        // test new duration
        require!(
            self.stake.duration + duration <= StakeAccount::DURATION_MAX.try_into().unwrap(),
            SoarchainStakingError::DurationTooLong
        );

        // extend stake
        self.stake.extend(duration)
    }
}
