// decoders/systemProgramDecoder.ts
import { Connection, SystemInstruction } from '@solana/web3.js';

export async function decodeSystemProgramInstruction(
  instruction: any,
  connection: Connection
): Promise<number> {
  let totalRentLamports = 0;

  const instructionType = SystemInstruction.decodeInstructionType(instruction);
  if (instructionType === 'Create') {
    const params = SystemInstruction.decodeCreateAccount(instruction);
    totalRentLamports += await connection.getMinimumBalanceForRentExemption(params.space);
  } else if (instructionType === 'CreateWithSeed') {
    const params = SystemInstruction.decodeCreateWithSeed(instruction);
    totalRentLamports += await connection.getMinimumBalanceForRentExemption(params.space);
  } else if (instructionType === 'Allocate') {
    const params = SystemInstruction.decodeAllocate(instruction);
    totalRentLamports += await connection.getMinimumBalanceForRentExemption(params.space);
  }
  

  return totalRentLamports;
}
