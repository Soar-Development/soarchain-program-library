use crate::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct Slash<'info> {
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, has_one = vault @ SoarchainError::InvalidVault)]
    pub stake: Account<'info, StakeAccount>,
    #[account(mut, address = settings.token_account @ SoarchainError::InvalidTokenAccount)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(
        has_one = authority @ SoarchainError::Unauthorized,
        seeds = [ constants::PREFIX_SETTINGS.as_ref() ],
        bump,
    )]
    pub settings: Account<'info, SettingsAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> Slash<'info> {
    pub fn handler(&mut self, amount: u64) -> Result<()> {
        // test amount
        require!(
            amount <= self.stake.amount,
            SoarchainStakingError::AmountNotEnough
        );

        // slash stake
        self.stake.slash(amount);
        transfer_tokens_from_vault!(self, token_account, seeds!(self.stake, self.vault), amount)
    }
}
