import { Connection, PublicKey, Signer } from '@solana/web3.js';

/**
 *
 * @param seeds
 * @param programId
 */
async function pda(seeds: Array<Buffer | Uint8Array>, programId: PublicKey) {
    return (PublicKey.findProgramAddressSync(seeds, programId))[0];
  }

  export {


    pda,

  };
  