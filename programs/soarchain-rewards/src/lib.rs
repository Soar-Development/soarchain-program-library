mod instructions;
mod macros;
mod security;
mod state;

use anchor_lang::declare_id;
use anchor_lang::prelude::*;
use instructions::*;
use soarchain_common::*;
pub use state::*; // expose state for cpi

declare_id!("UPSXdvWxwUTxMVkMtXLZhz2arCmx1uoc8c1z2V7Rf7S");

#[program]
pub mod soarchain_rewards {
    use super::*;

    /// Initialize the [ReflectionAccount](#reflection-account) and [VaultAccount](#vault-account).
    pub fn init(ctx: Context<Init>) -> Result<()> {
        ctx.accounts.handler(*ctx.bumps.get("vault").unwrap())
    }

    /// Initialize a [RewardsAccount](#rewards-account).
    pub fn enter(ctx: Context<Enter>) -> Result<()> {
        ctx.accounts.handler(*ctx.bumps.get("reward").unwrap())
    }

    /// Send [SOAR](/tokens/token) to the [VaultAccount](#vault-account).
    pub fn add_funds(ctx: Context<AddFunds>, amount: u64) -> Result<()> {
        ctx.accounts.handler(amount)
    }

    /// Claim rewards from a [RewardsAccount](#rewards-account) and [VaultAccount](#vault-account).
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Re-calculate reflection points.
    pub fn sync(ctx: Context<Sync>) -> Result<()> {
        ctx.accounts.handler()
    }

    /// Close a [RewardsAccount](#rewards-account).
    pub fn close(ctx: Context<Close>) -> Result<()> {
        ctx.accounts.handler()
    }
}
