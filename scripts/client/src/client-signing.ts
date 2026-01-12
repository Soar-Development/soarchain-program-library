import {
    Connection,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  import { AnchorError } from "@coral-xyz/anchor";
  
  /**
   * Optional: parseAnchorError
   * Attempts to parse custom Anchor program errors from logs
   */
  function parseAnchorError(err: any): AnchorError | null {
    if (!err?.logs) return null;
    try {
      // If your program is known, you could also do:
      // AnchorError.parse(err, program.idlErrors, program.programId)
      return AnchorError.parse(err);
    } catch {
      return null;
    }
  }
  
  /**
   * verifyTransaction
   * Checks if a given signature is actually confirmed or finalized on-chain.
   */
  async function verifyTransaction(
    connection: Connection,
    signature: string
  ): Promise<boolean> {
    const status = await connection.getSignatureStatuses([signature]);
    const result = status.value[0];
    if (!result) return false;
    return (
      result.confirmationStatus === "confirmed" ||
      result.confirmationStatus === "finalized"
    );
  }
  
  /**
   * createSolanaWeb3Client
   *
   * Creates a simple client with an enhanced `sendTx` method that:
   *   - Signs and sends a transaction
   *   - Waits for confirmation
   *   - Handles timeouts more gracefully (checks on-chain if possible)
   *   - Optionally parses custom Anchor errors
   *
   * @param connection A pre-constructed Connection object
   * @param localKeypair A Keypair representing your stored wallet
   * @returns An object with a single function: sendTx(tx)
   */
  export function createSolanaWeb3Client(
    connection: Connection,
    localKeypair: Keypair
  ) {
    /**
     * sendTx
     *
     * Signs and sends a transaction, then waits for confirmation.
     * Catches and returns errors instead of throwing them, so you can handle them gracefully.
     *
     * @param tx The Transaction object with your instructions
     * @returns { success, signature?, error? }
     *   - success: boolean
     *   - signature: string (if success OR if we recovered it on a timeout)
     *   - error: the error object (AnchorError, or generic)
     */
    async function sendTx(
      tx: Transaction
    ): Promise<{
      success: boolean;
      signature?: string;
      error?: any;
    }> {
      try {
        // 1) Fee payer
        tx.feePayer = localKeypair.publicKey;
  
        // 2) Send + confirm using web3.js
        const signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [localKeypair],
          {
            skipPreflight: false,
            commitment: "confirmed",
          }
        );
  
        // If successful, return the signature
        return {
          success: true,
          signature,
        };
      } catch (err: any) {
        // 3) Enhanced error handling
        console.error("Error in sendTx:", err);
  
        // (a) Attempt to parse custom Anchor errors from logs
        const anchorErr = parseAnchorError(err);
        if (anchorErr) {
          return {
            success: false,
            error: anchorErr,
          };
        }
  
        // (b) Check if it's a known timeout error
        // e.g. "TransactionExpiredTimeoutError" or "Transaction was not confirmed in X"
        if (
          err.name === "TransactionExpiredTimeoutError" ||
          (typeof err.message === "string" &&
            err.message.includes("Transaction was not confirmed in"))
        ) {
          // If the error object includes a signature, we can attempt on-chain verification
          if (err.txSignature) {
            const txSignature = err.txSignature as string;
            console.log("Timeout occurred. Checking on-chain for:", txSignature);
  
            const confirmedOnChain = await verifyTransaction(connection, txSignature);
            if (confirmedOnChain) {
              console.log("Transaction actually confirmed on-chain!");
              return {
                success: true,
                signature: txSignature,
              };
            } else {
              console.error("Transaction not found or not confirmed on-chain.");
              return {
                success: false,
                error: new Error(
                  `Timeout and not found on-chain. Signature: ${txSignature}`
                ),
              };
            }
          } else {
            // No signature to check on chain
            return {
              success: false,
              error: err,
            };
          }
        }
  
        // (c) If it's some other error, return it directly
        return {
          success: false,
          error: err,
        };
      }
    }
  
    return {
      sendTx,
    };
  }
  