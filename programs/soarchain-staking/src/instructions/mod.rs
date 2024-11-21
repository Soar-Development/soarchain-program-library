//! Instructions for Soarchain Staking.

pub mod close;
pub mod extend;
pub mod init;
pub mod cancel_unbond;
pub mod slash;
pub mod stake;
pub mod add_stake;
pub mod unbond;
pub mod update_settings;
pub mod withdraw;

pub use close::*;
pub use extend::*;
pub use init::*;
pub use cancel_unbond::*;
pub use slash::*;
pub use stake::*;
pub use add_stake::*;
pub use unbond::*;
pub use update_settings::*;
pub use withdraw::*;
