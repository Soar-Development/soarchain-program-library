// decoders/soarchainRewardsDecoder.ts
import { Connection, PublicKey } from '@solana/web3.js';

export async function decodeSoarchainRewardsInstruction(
  instruction: any,
  connection: Connection
): Promise<number> {
  let totalRentLamports = 0;

  const data = instruction.data;
  if (!data) {
    return 0;
  }

  // if we want to detect `.enter()` method:
  const ENTER_METHOD_DISCRIMINATOR = Buffer.from([139, 49, 209, 114, 88, 91, 77, 134]);
  const methodDiscriminator = data.subarray(0, 8);

  if (methodDiscriminator.equals(ENTER_METHOD_DISCRIMINATOR)) {
    // We create a RewardAccount (8 + size_of(RewardAccount))
    // RewardAccount: 32 + 1 + 16 + 16 = 65
    // total = 8 + 65 = 73
    const rewardAccountSize = 73;
    totalRentLamports += await connection.getMinimumBalanceForRentExemption(rewardAccountSize);
  }

  return totalRentLamports;
}
