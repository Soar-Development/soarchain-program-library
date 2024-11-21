use anchor_lang::prelude::*;

/***
 * Accounts
 */

/// The `SettingsAccount` struct holds the information about the
/// slashing authority and token account.
#[account]
pub struct SettingsAccount {
    pub authority: Pubkey,
    pub token_account: Pubkey,
}

impl SettingsAccount {
    pub const SIZE: usize = 8 + std::mem::size_of::<SettingsAccount>();

    pub fn set(&mut self, authority: Pubkey, token_account: Pubkey) -> Result<()> {
        self.authority = authority;
        self.token_account = token_account;
        Ok(())
    }
}

/// The `StakeAccount` struct holds all the information for any given stake.
#[account]
pub struct StakeAccount {
    pub amount: u64,
    pub authority: Pubkey,
    pub duration: u64,
    pub time_unbond: i64,
    pub vault: Pubkey,
    pub vault_bump: u8,
    pub xsoar: u128,
}

impl StakeAccount {
    pub const SIZE: usize = 8 + std::mem::size_of::<StakeAccount>();
    pub const STAKE_MINIMUM: u64 = 0;
    pub const SECONDS_PER_DAY: u128 = 24 * 60 * 60;
    pub const DURATION_MIN: u128 = 14 * StakeAccount::SECONDS_PER_DAY; // 2 weeks
    pub const DURATION_MAX: u128 = 365 * StakeAccount::SECONDS_PER_DAY; // 1 year
    pub const XSOAR_PRECISION: u128 = u128::pow(10, 15); // 1e15
    pub const XSOAR_DIV: u128 = 4 * StakeAccount::DURATION_MAX / 12; // 0.25 growth per month

    pub fn init(
        &mut self,
        amount: u64,
        authority: Pubkey,
        duration: u64,
        vault: Pubkey,
        vault_bump: u8,
    ) {
        self.amount = amount;
        self.authority = authority;//solana wallet
        self.duration = duration;//unbonding period
        self.time_unbond = 0;//starting time of unbonding
        self.vault = vault;//token account -> soar token adderess
        self.vault_bump = vault_bump;//bump seed
        self.update_xsoar(); //score
    }

    pub fn unbond(&mut self, now: i64) -> Result<()> {
        self.time_unbond = now;
        self.update_xsoar();//users cannot claim in the period from reward program 
        Ok(())
    }

    pub fn cancel_unbond(&mut self, amount: u64) -> Result<()> {
        self.amount = amount;
        self.time_unbond = 0;
        self.update_xsoar();// cancel unbonding
        Ok(())
    }

    pub fn withdraw(&self, balance: u64, now: i64) -> u64 {//unbounding period ends and user can withdraw
        let elapsed: u64 = u64::try_from(now - self.time_unbond).unwrap();
        if elapsed >= self.duration {
            balance
        } else {
            let precision: u64 = u64::MAX / std::cmp::max(self.amount, elapsed) - 1;
            elapsed * precision / self.duration * self.amount / precision - (self.amount - balance)
        }
    }

    pub fn add_stake(&mut self, amount: u64) {// add more stake to the account 
        self.amount += amount;
        self.update_xsoar();
    }

    pub fn slash(&mut self, amount: u64) {// guardians can slash 
        self.amount -= amount;
        self.update_xsoar();
    }

    pub fn extend(&mut self, duration: u64) -> Result<()> {// extending the time of your unboding period
        self.duration += duration;
        self.update_xsoar();
        Ok(())
    }

    fn update_xsoar(&mut self) {
        self.xsoar = if self.time_unbond != 0 {
            0
        } else {
            (u128::from(self.duration) * StakeAccount::XSOAR_PRECISION / StakeAccount::XSOAR_DIV
                + StakeAccount::XSOAR_PRECISION)
                * u128::from(self.amount)
                / StakeAccount::XSOAR_PRECISION
        }
    }
}
