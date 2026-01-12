// decoders/associatedTokenDecoder.ts
import { Connection } from '@solana/web3.js';

export async function decodeAssociatedTokenInstruction(
  _instruction: any,
  connection: Connection
): Promise<number> {
  const dataLength = 165;
  return connection.getMinimumBalanceForRentExemption(dataLength);
}
