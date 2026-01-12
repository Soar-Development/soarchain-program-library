import { Connection, PublicKey } from '@solana/web3.js';
import { getContractInfo } from './main';
import BN from 'bn.js';
import moment from "moment";

/** Decode BN timestamp to a human-readable date */
const decodeTimestamp = (timestamp: BN): string => {
  return moment
    .utc(timestamp.toNumber() * 1000) // Convert seconds to milliseconds
    .local() // Convert to local time
    .format('DD.MM.YYYY HH:mm'); // Format as DD.MM.YYYY HH:mm
};

/** Decode the schedules array */
const decodeSchedules = (schedules: any[], decimals: number) => {
  return schedules.map((schedule, index) => ({
    index: index + 1,
    releaseTime: decodeTimestamp(schedule.releaseTime),
    amount: schedule.amount.div(new BN(10 ** decimals)).toString(), // Adjust amount based on token decimals
  }));
};

/**
 * Retrieve and decode contract info
 * @param rpcUrl - The Solana RPC URL
 * @param vestingAccountPublicKey - The public key of the vesting account
 * @returns Decoded contract info
 */
export const retrieveContractInfo = async (
  rpcUrl: string,
  vestingAccountPublicKey: string
): Promise<{
  destinationAddress: string;
  mintAddress: string;
  schedules: { index: number; releaseTime: string; amount: string }[];
}> => {
  try {
    const connection = new Connection(rpcUrl);
    const publicKey = new PublicKey(vestingAccountPublicKey);

    const contractInfo = await getContractInfo(connection, publicKey);

    // Decode contract info
    const decodedInfo = {
      destinationAddress: contractInfo.destinationAddress.toBase58(),
      mintAddress: contractInfo.mintAddress.toBase58(),
      schedules: decodeSchedules(contractInfo.schedules, 6), // Replace 6 with your token's decimal places
    };

    return decodedInfo;
  } catch (error) {
    console.error('Error retrieving contract info:', error);
    throw error; // Re-throw error to handle it at the call site
  }
};
