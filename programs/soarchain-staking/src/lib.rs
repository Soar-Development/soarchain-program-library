mod errors;
mod instructions;
mod macros;
mod security;
mod state;

use anchor_lang::prelude::*;
pub use errors::*; // expose errors for cpi
use instructions::*;
use soarchain_common::*;
pub use state::*; // expose stake for cpi

declare_id!("BjQHTqshCHuf6Zu7XK8jWiJnknMzi7exkRrLXioU4AK2");

#[program]
pub mod soarchain_staking {
    use super::*;

    /// Initialize the [SettingsAccount](#settings-account).
    pub fn init(ctx: Context<Init>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Create a [StakeAccount](#stake-account) and [VaultAccount](#vault-account).
    /// Stake `amount` of [soar](/tokens/token) tokens for `duration` fo seconds.
    pub fn stake(ctx: Context<Stake>, amount: u64, duration: u128) -> Result<()> {
        ctx.accounts
            .handler(amount, duration, *ctx.bumps.get("vault").unwrap())
    }

    /// Start the unbond duration.
    pub fn unbond(ctx: Context<Unbond>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Make a stake active again and reset the unbond time.
    pub fn cancel_unbond(ctx: Context<CancelUnbond>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Add `amount` of [soar](/tokens/token) of a [StakeAccount](#stake-account).
    pub fn add_stake(ctx: Context<AddStake>, amount: u64) -> Result<()> {
        ctx.accounts.handler(amount)
    }

    /// Extend the `duration` of a [StakeAccount](#stake-account).
    pub fn extend(ctx: Context<Extend>, duration: u64) -> Result<()> {
        ctx.accounts.handler(duration)
    }

    /// Close a [StakeAccount](#stake-account) and [VaultAccount](#vault-account).
    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Withdraw  [soaer(/tokens/token) that is released after an [unbond](#unbond)
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Reduce a [StakeAccount](#stake-account)'s [soar](/tokens/token) tokens.
    /// Slashing is a feature used by the guardians to punish bad actors.
    pub fn slash(ctx: Context<Slash>, amount: u64) -> Result<()> {
        ctx.accounts.handler(amount)
    }

    /// Update the Slashing Authority and Token Account.
    pub fn update_settings(ctx: Context<UpdateSettings>) -> Result<()> {
        ctx.accounts.handler()
    }
}
