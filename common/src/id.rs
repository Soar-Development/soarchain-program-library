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
    declare_id!("");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP");
}

pub use staking_program::ID as STAKING_PROGRAM;
mod staking_program {
    use super::*;
    declare_id!("2ESmAfheqA1h1wgMhLZQGPir7PMvw2RomJWQZ9safjAJ");
}

pub use rewards_program::ID as REWARDS_PROGRAM;
mod rewards_program {
    use super::*;
    declare_id!("");
}

pub use authority::ID as AUTHORITY;
mod authority {
    use super::*;
    #[cfg(feature = "mainnet")]
    declare_id!("");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("XXXxddiNnmoD2h2LbQYaL76Swi21MaQbtBbRynAdQL8");
}

pub use token_account::ID as TOKEN_ACCOUNT;
mod token_account {
    use super::*;
    #[cfg(feature = "mainnet")]
    declare_id!("A9V8JkR5HihvFpHq1ZbwrpPAGBhsGfeWw5TVcUdGf2dg");
    #[cfg(not(feature = "mainnet"))]
    declare_id!("HLtABkKqsUjb4ECPEnvad6HN7QYf6ANHahAeZQXrAGgV");
}
