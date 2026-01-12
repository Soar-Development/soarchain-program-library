import bs58 from "bs58";
import type { Transaction } from "@solana/web3.js";

/** 
 * Possible priority levels recognized by Helius for fee estimation.
 */
export type HeliusPriorityLevel =
  | "Min"
  | "Low"
  | "Medium"
  | "High"
  | "VeryHigh"
  | "UnsafeMax";

/**
 * The response structure for the Helius getPriorityFeeEstimate method.
 */
interface HeliusFeeResponse {
  jsonrpc: string;
  id: string;
  result?: {
    priorityFeeEstimate?: number;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * getPriorityFeeEstimateHelius
 *
 * Calls Helius's `getPriorityFeeEstimate` JSON-RPC method for a given transaction.
 * Returns the recommended microLamports for setComputeUnitPrice.
 *
 * @param heliusRpcEndpoint The Helius RPC endpoint (e.g. "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY")
 * @param tx A partially built (unsigned or signed) Transaction
 * @param priorityLevel One of "Min", "Low", "Medium", "High", "VeryHigh", or "UnsafeMax" (default "High")
 * @returns The `priorityFeeEstimate` in microLamports as a number
 * @throws If the Helius RPC responds with an error
 */
export async function getPriorityFeeEstimateHelius(
  heliusRpcEndpoint: string,
  tx: Transaction,
  priorityLevel: HeliusPriorityLevel = "High"
): Promise<number> {
  // 1) Serialize the transaction in Base58 (excluding required signatures if not fully signed)
  const serializedTx = tx.serialize({ requireAllSignatures: false });
  const base58Tx = bs58.encode(serializedTx);

  // 2) Prepare the JSON-RPC request body
  const body = {
    jsonrpc: "2.0",
    id: "1",
    method: "getPriorityFeeEstimate",
    params: [
      {
        transaction: base58Tx,
        options: {
          priorityLevel,
        },
      },
    ],
  };

  // 3) Send the request to Helius
  const response = await fetch(heliusRpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as HeliusFeeResponse;

  // 4) Check for errors
  if (data.error) {
    throw new Error(
      `Helius RPC error: code=${data.error.code}, message=${data.error.message}`
    );
  }

  // 5) Extract the priorityFeeEstimate from the result
  const priorityFeeEstimate = data.result?.priorityFeeEstimate ?? 0;
  return priorityFeeEstimate;
}

