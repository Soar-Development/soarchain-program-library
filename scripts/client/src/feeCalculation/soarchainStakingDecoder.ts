// decoders/soarchainStakingDecoder.ts
import { Connection, PublicKey } from '@solana/web3.js';

export async function decodeSoarchainStakingInstruction(
  instruction: any,
  connection: Connection
): Promise<number> {
  let totalRentLamports = 0;

  const data = instruction.data; // raw Buffer
  if (!data) {
    return 0;
  }

  // Anchor Discriminator = first 8 bytes

  // If it's "stake", we add rent for StakeAccount (121 bytes) + token vault (165 bytes).
  // If it's something else, we do 0 or parse differently.

  // Hard-coded approach:
  const STAKE_METHOD_DISCRIMINATOR = Buffer.from([
    206, 176, 202, 18, 200, 209, 179, 108,
  ]);

  const methodDiscriminator = data.subarray(0, 8);
  if (methodDiscriminator.equals(STAKE_METHOD_DISCRIMINATOR)) {
    // stake method => one StakeAccount + one Vault
    // stake account: 8 + (u64 + Pubkey + u64 + i64 + Pubkey + u8 + u128) = 121
    // vault = 165
    const stakeAccountSize = 121;
    const vaultSize = 165;

    totalRentLamports += await connection.getMinimumBalanceForRentExemption(stakeAccountSize);
    totalRentLamports += await connection.getMinimumBalanceForRentExemption(vaultSize);
  }


  return totalRentLamports;
}
