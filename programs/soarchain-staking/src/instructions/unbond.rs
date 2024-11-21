use crate::*;

#[derive(Accounts)]
pub struct Unbond<'info> {
    #[account(
        mut,
        has_one = authority @ SoarchainError::Unauthorized,
        constraint = stake.time_unbond == 0 @ SoarchainStakingError::AlreadyUnbonded,
    )]
    pub stake: Account<'info, StakeAccount>,
    /// CHECK: we only want to verify this account does not exist
    #[account(
        address = pda::soarchain_rewards(authority.key) @ SoarchainError::InvalidAccount,
        constraint = utils::account_is_closed(&reward) @ SoarchainStakingError::HasReward,
    )]
    pub reward: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

impl<'info> Unbond<'info> {
    pub fn handler(&mut self) -> Result<()> {
        self.stake.unbond(Clock::get()?.unix_timestamp)
    }
}
