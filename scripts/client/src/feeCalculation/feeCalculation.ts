import {
  Transaction,
  Connection,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SystemInstruction,
} from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { decodeSystemProgramInstruction } from "./systemProgramDecoder";
import { decodeAssociatedTokenInstruction } from "./associatedTokenDecoder";
import { decodeSoarchainStakingInstruction } from "./soarchainStakingDecoder";
import { decodeSoarchainRewardsInstruction } from "./soarchainRewardsDecoder";

/**
 * Calculate total transaction cost: 
 *   - base transaction fee 
 *   + sum of rent exemptions for all new accounts 
 *
 * @param transaction - The prepared Transaction object
 * @param connection  - Solana Connection for fee & rent calls
 * @returns { totalCostSOL } in SOL
 */
export async function calculateTotalTransactionCost(
  transaction: Transaction,
  connection: Connection
): Promise<{ totalCostSOL: number }> {
  // 1) Compile the transaction message
  const message = transaction.compileMessage();

  // 2) Query the fee for this message
  const { value: feeInLamports } = await connection.getFeeForMessage(message);
  if (feeInLamports === null) {
    throw new Error("Failed to calculate fee for the transaction");
  }

  let totalRentExemptionLamports = 0;

  // 3) For each instruction, add its rent requirements
  for (const instruction of transaction.instructions) {
    const programId = instruction.programId;

    // (A) System Program
    if (programId.equals(SystemProgram.programId)) {
      totalRentExemptionLamports += await decodeSystemProgramInstruction(instruction, connection);
    }
    // (B) ATA Program
    else if (programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      totalRentExemptionLamports += await decodeAssociatedTokenInstruction(instruction, connection);
    }
    // (C) Soarchain Staking
    else if (programId.toBase58() === "BKxuAERUTNYEiMuLwz6tSDtrt1tCjhFkHbUBeuVvXBrz") {
      // your STAKING_PROGRAM_ID
      totalRentExemptionLamports += await decodeSoarchainStakingInstruction(instruction, connection);
    }
    // (D) Soarchain Rewards
    else if (programId.toBase58() === "EbGAsCqfiFx5K8zvP3dXn5jsX7yojw4tgLZxuENmqTEc") {
      // your REWARDS_PROGRAM_ID
      totalRentExemptionLamports += await decodeSoarchainRewardsInstruction(instruction, connection);
    }

  }

  // 4) Sum base fee + rent
  const totalCostLamports = feeInLamports + totalRentExemptionLamports;
  const totalCostSOL = totalCostLamports / LAMPORTS_PER_SOL;

  // 5) Return in SOL
  return { totalCostSOL };
}
