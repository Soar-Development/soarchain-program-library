use anchor_lang::declare_id;

/***
 * IDs
 */

pub use system_program::ID as SYSTEM_PROGRAM;
mod system_program {
    use super::*;
    declare_id!("11111111111111111111111111111111");
}

pub use soar_token::ID as SOAR_TOKEN;
mod soar_token {
    use super::*;
    #[cfg(feature = "mainnet")]
    declare_id!("6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP");
}

pub use staking_program::ID as STAKING_PROGRAM;
mod staking_program {
    use super::*;
    declare_id!("BjQHTqshCHuf6Zu7XK8jWiJnknMzi7exkRrLXioU4AK2");
}

pub use rewards_program::ID as REWARDS_PROGRAM;
mod rewards_program {
    use super::*;
    declare_id!("UPSXdvWxwUTxMVkMtXLZhz2arCmx1uoc8c1z2V7Rf7S");
}

pub use authority::ID as AUTHORITY;
mod authority {
    use super::*;
    #[cfg(feature = "mainnet")]
    declare_id!("soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX");
}

pub use token_account::ID as TOKEN_ACCOUNT;
mod token_account {
    use super::*;
    #[cfg(feature = "mainnet")]
    declare_id!("A9V8JkR5HihvFpHq1ZbwrpPAGBhsGfeWw5TVcUdGf2dg");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("HLtABkKqsUjb4ECPEnvad6HN7QYf6ANHahAeZQXrAGgV");
}
