import {
    AnchorProvider,
    Idl,
    Program,
    setProvider,
    getProvider,
    web3,
    Wallet,
    BN,
    AnchorError,
  } from '@coral-xyz/anchor'
  import {
    PublicKey,
    Connection,
    Transaction,
    Keypair,
    ComputeBudgetProgram,
    SignatureStatus,
  } from '@solana/web3.js'
  import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,  
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  } from '@solana/spl-token'
  import { createSolanaWeb3Client } from "./client-signing";
  import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'
  // Local IDs
  // @ts-ignore
  import { SoarchainRewards } from '/home/alp/soarchain-program-library/target/types/soarchain_rewards';
  // @ts-ignore
  import { SoarchainStaking } from '/home/alp/soarchain-program-library/target/types/soarchain_staking';
  import * as fs from 'fs';
  import { calculateTotalTransactionCost } from "./feeCalculation/feeCalculation";
  import bs58 from "bs58";
  import { getPriorityFeeEstimateHelius, HeliusPriorityLevel } from './priority-fee';
  import { unlock } from './vestingClient/main';
import { PublicKeyAmino } from 'osmojs/dist/codegen/tendermint/crypto/keys';

  // --------------------------------------------------------------------------------
  // Interfaces and Constants
  // --------------------------------------------------------------------------------
  
  interface SolanaClientConfig {
    connection: web3.Connection
    rewardsProgramId: string
    stakingProgramId: string
    mint: string
  }
  
  // Constants for xSOAR calculation
  const SECONDS_PER_DAY = 24 * 60 * 60
  const DURATION_MAX = 365 * SECONDS_PER_DAY // 1 year
  const XSOAR_PRECISION = BigInt(10 ** 15) // 1e15
  const DURATION_MAX_BIG = BigInt(DURATION_MAX)
  const XSOAR_DIV = (4n * DURATION_MAX_BIG) / 12n // 0.25 growth per month
  
  // --------------------------------------------------------------------------------
  // Create Non-Signing Solana Client
  // --------------------------------------------------------------------------------
  
  export function createSolanaClient(config: SolanaClientConfig, wallet: any, signerKeypair?: Keypair,  heliusRpcUrl: string = "https://gennifer-ksidql-fast-mainnet.helius-rpc.com"): any {
    const provider = new AnchorProvider(config.connection, wallet as Wallet, {
      commitment: 'finalized',
      preflightCommitment: 'confirmed',
    })
    setProvider(provider)
    const mint = new PublicKey(config.mint)
    const rewardsProgramId = new PublicKey(config.rewardsProgramId)
    const stakingProgramId = new PublicKey(config.stakingProgramId)
  
    let rewardsProgram: Program<SoarchainRewards>
    let stakingProgram: Program<SoarchainStaking>
  
    // 1) init
    async function init() {
      try {
        console.log('Fetching rewards IDL...')
        const rewardsIdl = (await Program.fetchIdl(rewardsProgramId, provider)) as Idl
        console.log('Rewards IDL fetched')
  
        console.log('Fetching staking IDL...')
        const stakingIdl = (await Program.fetchIdl(stakingProgramId, provider)) as Idl
        console.log('Staking IDL fetched')
  
        rewardsProgram = new Program(
          rewardsIdl,
          rewardsProgramId,
          provider
        ) as unknown as Program<SoarchainRewards>
  
        stakingProgram = new Program(
          stakingIdl,
          stakingProgramId,
          provider
        ) as unknown as Program<SoarchainStaking>
  
        console.log('Programs initialized successfully')
      } catch (error) {
        console.error('Error initializing programs in init():', error)
        throw error
      }
    }
  
    // --------------------------------------------------------------------------------
    // PDA Helpers
    // --------------------------------------------------------------------------------
    function getReflectionPda(): PublicKey {
      const [reflection] = PublicKey.findProgramAddressSync(
        [utf8.encode('reflection')],
        rewardsProgram.programId
      )
      return reflection
    }
  
    function getRewardPda(user: PublicKey): PublicKey {
      const [reward] = PublicKey.findProgramAddressSync(
        [utf8.encode('reward'), user.toBuffer()],
        rewardsProgram.programId
      )
      return reward
    }
  
    function getStakePda(user: PublicKey): PublicKey {
      const [stake] = PublicKey.findProgramAddressSync(
        [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
        stakingProgram.programId
      )
      return stake
    }
  
    function getStakingVaultPda(user: PublicKey): PublicKey {
      const [vault] = PublicKey.findProgramAddressSync(
        [utf8.encode('vault'), mint.toBuffer(), user.toBuffer()],
        stakingProgram.programId
      )
      return vault
    }
  
    function getRewardsVaultPda(): PublicKey {
      const [vault] = PublicKey.findProgramAddressSync(
        [mint.toBuffer()],
        rewardsProgram.programId
      )
      return vault
    }
  
    function getStakingStakePda(user: PublicKey): PublicKey {
      const [stake] = PublicKey.findProgramAddressSync(
        [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
        stakingProgram.programId
      )
      return stake
    }
  
    // --------------------------------------------------------------------------------
    // "Build" Transaction Methods (Non-Signing) + Priority Fees
    // --------------------------------------------------------------------------------
  
/**
 * await maybeAddPriorityFee
 *
 * 1) If `priorityLevel` > 0, use that directly.
 * 2) Otherwise, fetch a recommended fee from Helius.
 * 3) Automatically ensure `tx.feePayer` and `tx.recentBlockhash` are set if missing.
 *    (Uses a defaultFeePayer and the provided connection.)
 * 4) Prepend a ComputeBudgetProgram.setComputeUnitPrice instruction if > 0.
 *
 * @param tx The Transaction to modify
 * @param connection A Solana connection (to fetch a recent blockhash if needed)
 * @param defaultFeePayer A default fee payer public key (if none is set on the transaction)
 * @param priorityLevel Manual override for the priority fee (defaults to 0 => auto fetch)
 * @param priorityLevel The Helius priority level to request (e.g. "VeryHigh")
 * @param heliusRpcUrl Helius RPC endpoint + API key
 */
async function maybeAddPriorityFee(
  tx: Transaction,
  priorityLevel: HeliusPriorityLevel = "High",
): Promise<void> {
  try {
    // 1) Ensure the transaction has a feePayer
    if (!tx.feePayer) {
      // Use a default if none is provided
      tx.feePayer = wallet.publicKey;
    }

    // 2) Ensure the transaction has a recent blockhash
    if (!tx.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
    }

    // 3) Fetch from Helius
      const estimatedFee = await getPriorityFeeEstimateHelius(
        heliusRpcUrl,
        tx,
        priorityLevel
      );
      console.log(`Helius recommended fee (${priorityLevel}):`, estimatedFee);
    
      // Prepend a ComputeBudgetProgram.setComputeUnitPrice instruction
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: estimatedFee,
        })
      ); 
    
  } catch (err) {
    console.error("Error fetching or adding priority fee:", err);
    // You can choose to re-throw or silently continue without a priority fee.
    // throw err;
  }
}

  
    /**
     * buildStakeAndEnterTx
     *   - stake
     *   - enter
     */
    async function buildStakeAndEnterTx(
      amount: number,
      duration: number,
      priorityLevel: HeliusPriorityLevel,
    ): Promise<Transaction> {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
  
      const user = wallet.publicKey
      const vault = getStakingVaultPda(user)
      const stakePda = getStakingStakePda(user)
      const ata = await getAssociatedTokenAddress(mint, user)
      const reflection = getReflectionPda()
      const reward = getRewardPda(user)
  
      const tx = new Transaction()
      await maybeAddPriorityFee(tx, priorityLevel)
  
      // 1) Stake
      const ixStake = await stakingProgram.methods
        .stake(new BN(amount), new BN(duration))
        .accounts({
          mint,
          user: ata,
          vault,
          stake: stakePda,
          authority: user,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction()
  
      // 2) Enter
      const ixEnter = await rewardsProgram.methods
        .enter()
        .accounts({
          reflection,
          stake: stakePda,
          reward,
          authority: user,
          systemProgram: web3.SystemProgram.programId,
        })
        .instruction()
  
      tx.add(ixStake, ixEnter)
      return tx
    }
  
    /**
     * buildAddStakeAndSyncTx
     *   - addStake
     *   - sync
     */
    async function buildAddStakeAndSyncTx(amount: number, priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
  
      const user = wallet.publicKey
      const vault = getStakingVaultPda(user)
      const stakePda = getStakePda(user)
      const ata = await getAssociatedTokenAddress(mint, user)
      const reward = getRewardPda(user)
      const reflection = getReflectionPda()
  
      const tx = new Transaction()
      await maybeAddPriorityFee(tx, priorityLevel)
  
      // 1) addStake
      const ixAddStake = await stakingProgram.methods
        .addStake(new BN(amount))
        .accounts({
          user: ata,
          vault,
          stake: stakePda,
          authority: user,
        })
        .instruction()
  
      // 2) sync
      const ixSync = await rewardsProgram.methods
        .sync()
        .accounts({
          reward,
          stake: stakePda,
          reflection,
        })
        .instruction()
  
      tx.add(ixAddStake, ixSync)
      return tx
    }
  
      /**
   * buildClaimAndStakeTx
   *   - claim (Rewards Program)
   *   - stake (Staking Program)
   * This is a new function combining "claim" + "stake" in one Tx.
   */
  async function buildClaimAndStakeTx(
    stakeAmount: number,
    priorityLevel: HeliusPriorityLevel
  ): Promise<Transaction> {
    if (!wallet.publicKey) throw new Error('Wallet not connected')

    const user = wallet.publicKey
    const reflection = getReflectionPda()
    const reward = getRewardPda(user)
    const stakePda = getStakePda(user)
    const vault = getRewardsVaultPda()
    const stakeVault = getStakingVaultPda(user)
    const ata = await getAssociatedTokenAddress(mint, user)

    const tx = new Transaction()
    await maybeAddPriorityFee(tx, priorityLevel)

    // 1) Claim
    const ixClaim = await rewardsProgram.methods
      .claim()
      .accounts({
        user: ata,
        vault,
        reflection,
        reward,
        stake: stakePda,
      })
      .instruction()

    // 2) Stake
    const ixAddStake = await stakingProgram.methods
      .addStake(new BN(stakeAmount))
      .accounts({
        user: ata,
        vault: stakeVault,
        stake: stakePda,
        authority: user,
      })
      .instruction()

    tx.add(ixClaim, ixAddStake)
    return tx
  }
  
    /**
     * buildUnbondWithCloseRewardTx
     *   - close reward (if present)
     *   - unbond
     */
    async function buildUnbondWithCloseRewardTx(priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
  
      const user = wallet.publicKey
      const stakePda = getStakePda(user)
      const rewardPda = getRewardPda(user)
      const reflectionPda = getReflectionPda()
  
      const tx = new Transaction()
      await maybeAddPriorityFee(tx, priorityLevel)
  
      // close() - reward
      const ixClose = await rewardsProgram.methods
        .close()
        .accounts({
          reflection: reflectionPda,
          reward: rewardPda,
          authority: user,
        })
        .instruction()
  
      // unbond()
      const ixUnbond = await stakingProgram.methods
        .unbond()
        .accounts({
          stake: stakePda,
          reward: rewardPda,
          authority: user,
        })
        .instruction()
  
      tx.add(ixClose, ixUnbond)
      return tx
    }
  
    /**
     * buildWithdrawAndCloseTx
     *   - withdraw
     *   - close
     */
    async function buildWithdrawAndCloseTx(priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
  
      const user = wallet.publicKey
      const vault = getStakingVaultPda(user)
      const stakePda = getStakePda(user)
      const ata = await getAssociatedTokenAddress(mint, user)
  
      const tx = new Transaction()
      await maybeAddPriorityFee(tx, priorityLevel)
  
      // 1) withdraw
      const ixWithdraw = await stakingProgram.methods
        .withdraw()
        .accounts({
          user: ata,
          vault,
          stake: stakePda,
          authority: user,
        })
        .instruction()
  
      // 2) close
      const ixClose = await stakingProgram.methods
        .close()
        .accounts({
          user: ata,
          stake: stakePda,
          vault,
          authority: user,
        })
        .instruction()
  
      tx.add(ixWithdraw, ixClose)
      return tx
    }
  
/**
   * buildCancelUnbondAndEnterTx
   *   - cancelUnbond() (Staking)
   *   - enter() (Rewards)
   */
async function buildCancelUnbondAndEnterTx(priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
    if (!wallet.publicKey) throw new Error('Wallet not connected')

    const user = wallet.publicKey
    const vault = getStakingVaultPda(user)
    const stakePda = getStakePda(user)
    const reflection = getReflectionPda()
    const reward = getRewardPda(user)

    const tx = new Transaction()
    await maybeAddPriorityFee(tx, priorityLevel)

    // 1) CancelUnbond (staking)
    const cancelUnbondIx = await stakingProgram.methods
      .cancelUnbond()
      .accounts({
        vault,
        stake: stakePda,
        authority: user,
      })
      .instruction()

    // 2) Enter (rewards)
    const enterIx = await rewardsProgram.methods
      .enter()
      .accounts({
        reflection,
        stake: stakePda,
        reward,
        authority: user,
        systemProgram: web3.SystemProgram.programId,
      })
      .instruction()

    tx.add(cancelUnbondIx, enterIx)
    return tx
  }

  /**
   * buildClaimTx
   *   - Single-instruction transaction: claim()
   */
  async function buildClaimTx(priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
    if (!wallet.publicKey) throw new Error('Wallet not connected')

    const user = wallet.publicKey
    const reflection = getReflectionPda()
    const reward = getRewardPda(user)
    const stakePda = getStakePda(user)
    const vault = getRewardsVaultPda()
    const ata = await getAssociatedTokenAddress(mint, user)

    const tx = new Transaction()
    await maybeAddPriorityFee(tx, priorityLevel)

    const claimIx = await rewardsProgram.methods
      .claim()
      .accounts({
        user: ata,
        vault,
        reflection,
        reward,
        stake: stakePda,
      })
      .instruction()

    tx.add(claimIx)
    return tx
  }
  
    // --------------------------------------------------------------------------------
    // Example of a Single-Instr Build (like buildWithdrawTx) 
    // (not strictly requested, but for reference)
    // --------------------------------------------------------------------------------
  
    async function buildWithdrawTx(priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
      if (!wallet.publicKey) throw new Error('Wallet not connected')
  
      const user = wallet.publicKey
      const vault = getStakingVaultPda(user)
      const stakePda = getStakePda(user)
      const ata = await getAssociatedTokenAddress(mint, user)
  
      const tx = new Transaction()
      await maybeAddPriorityFee(tx, priorityLevel)
  
      const ix = await stakingProgram.methods
        .withdraw()
        .accounts({
          user: ata,
          vault,
          stake: stakePda,
          authority: user,
        })
        .instruction()
  
      tx.add(ix)
      return tx
    }
/**
 * signAndSendTxWeb3
 *
 * 1) Sets feePayer + recentBlockhash on `tx`.
 * 2) Sends the transaction via `connection.sendTransaction`.
 * 3) Polls `getSignatureStatuses` in a loop to check confirmation.
 *
 * @param tx The transaction to send
 * @returns The transaction signature once confirmed
 * @throws If not confirmed after `maxRetries`
 */
 async function signAndSendTxWeb3(
  tx: Transaction,
  maxRetries = 30,
  intervalMs = 2000
): Promise<string> {
  // 1) Fee payer
  tx.feePayer = signerKeypair.publicKey;

  // 2) Optionally set a recent blockhash
  const { blockhash } = await config.connection.getLatestBlockhash("finalized");
  tx.recentBlockhash = blockhash;

  // 3) Send the transaction to the network
  const signature = await config.connection.sendTransaction(tx, [signerKeypair], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  // 4) Poll in a loop until we see the transaction is confirmed/finalized
  for (let i = 0; i < maxRetries; i++) {
    const statuses = await connection.getSignatureStatuses([signature]);
    const status: SignatureStatus | null | undefined = statuses.value[0];
    console.log(`Attempt ${i + 1}:`, status);
    if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
      // Confirmed on-chain, return signature
      return signature;
    }

    // Not yet confirmed, wait a bit, then check again
    await sleep(intervalMs);
  }

  // If we exit the loop, we never saw it confirmed
  throw new Error(
    `Transaction was not confirmed after ${maxRetries} attempts. Signature: ${signature}`
  );
}

/** A small helper to sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * buildSPLsendTx
 *
 * Builds a transaction that:
 *  1) (If needed) Creates the recipient’s ATA
 *  2) Transfers `amount` tokens of the client's `mint` from the user’s ATA to the recipient’s ATA
 *  3) (Optionally) Adds a priority fee instruction if `priorityLevel > 0`
 *
 * @param destinationPubkey - The recipient's Solana address
 * @param amount - Number of tokens to send in base units (e.g. if mint has 6 decimals, 1 => 0.000001)
 * @param priorityLevel - If > 0, sets compute unit price for priority fees
 * @returns A Transaction that must be signed & sent externally
 */
async function buildSPLsendTx(
  destinationPubkey: PublicKey,
  amount: number,
  priorityLevel: HeliusPriorityLevel
): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected")
  }

  // 1) Create a new transaction
  const tx = new Transaction()

  // 2) Optionally prepend a priority fee
  await maybeAddPriorityFee(tx, priorityLevel)

  // 3) Derive "from" ATA and "to" ATA addresses
  const fromUser = wallet.publicKey
  const fromATA = await getAssociatedTokenAddress(mint, fromUser)
  const toATA = await getAssociatedTokenAddress(mint, destinationPubkey)

  // 4) Check if the recipient's ATA already exists on-chain
  const toATAInfo = await config.connection.getAccountInfo(toATA)
  if (!toATAInfo) {
    // Build an instruction to create the ATA for the recipient
    const createAtaIx = createAssociatedTokenAccountInstruction(
      fromUser,           // payer
      toATA,              // the ATA to create
      destinationPubkey,  // owner of the new ATA
      mint,               // token mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    tx.add(createAtaIx)
  }

  // 5) Create a transfer instruction from your user’s ATA -> recipient's ATA
  const transferIx = createTransferInstruction(
    fromATA,
    toATA,
    fromUser,
    BigInt(amount)
  )
  tx.add(transferIx)

  // 6) Return the unsigned transaction
  return tx
}

async function buildUnlockVesting(programId: PublicKey, seedWord: Buffer | Uint8Array, priorityLevel: HeliusPriorityLevel): Promise<Transaction> {
  if (!wallet.publicKey) throw new Error('Wallet not connected')

  const user = wallet.publicKey
  const tx = new Transaction()
  await maybeAddPriorityFee(tx, priorityLevel)

  const ix = await unlock(config.connection ,programId, seedWord, mint)
  // Return the unsigned transaction
  tx.add(...ix)
  return tx

}
  
    // --------------------------------------------------------------------------------
    // "Read"/Helper Methods (unchanged)
    // --------------------------------------------------------------------------------
  
    async function getStakes(wallet: Wallet): Promise<any[]> {
        if (!wallet.publicKey) {
          throw new Error('Wallet not connected')
        }
        const user = wallet.publicKey
        const stakePubkey = getStakePda(user) // Ensure getStakePda is accessible here
    
        const stakeAccountInfo = await provider.connection.getAccountInfo(stakePubkey)
        if (stakeAccountInfo === null) {
          console.log('No stake account found for user:', user.toBase58())
          return []
        }
    
        const stakeAccount = stakingProgram.account.stakeAccount.coder.accounts.decode(
          'StakeAccount',
          stakeAccountInfo.data,
        )
    
        // stakeAccount might have fields as BN or strings, convert them:
        // Ensure numeric fields are converted to numbers
        const amount = Number(stakeAccount.amount)
        const duration = Number(stakeAccount.duration)
        const timeUnbond = Number(stakeAccount.timeUnbond)
        const xsoar = Number(stakeAccount.xsoar)
        console.log('stakeAccount: ', stakeAccount)
    
        // Return the stake info as an array (since multiple stakes could be returned in future)
        return [
          {
            stake: stakePubkey.toBase58(),
            amount,
            duration,
            timeUnbond,
            xsoar
            // include other fields if needed
          },
        ]
      }
      async function getClaimableAmount(wallet: Wallet): Promise<number> {
        if (!wallet.publicKey) {
          throw new Error('Wallet not connected')
        }
    
        const user = wallet.publicKey
        const reflectionPda = getReflectionPda()
        const rewardPda = getRewardPda(user)
    
        // Fetch the reflection account data
        const reflectionAccount = await rewardsProgram.account.reflectionAccount.fetch(reflectionPda)
        // reflectionAccount fields: { rate: u128, totalReflection: u128, totalXsoar: u128, ... }
    
        // Fetch the reward account data
        const rewardAccountInfo = await provider.connection.getAccountInfo(rewardPda)
        if (!rewardAccountInfo) {
          // No reward account means user not entered yet, so claimable = 0
          return 0
        }
    
        const rewardAccount = await rewardsProgram.account.rewardAccount.fetch(rewardPda)
        // rewardAccount fields: { reflection: u128, xsoar: u128, ... }
    
        const rate = BigInt(reflectionAccount.rate.toString()) // u128 as BigInt
        const userReflection = BigInt(rewardAccount.reflection.toString())
        const userXsoar = BigInt(rewardAccount.xsoar.toString())
    
        // Calculate the claimable amount using contract logic:
        // amount = (reflection / rate) - xsoar
        const userXsoarEquivalent = userReflection / rate
        let claimable = userXsoarEquivalent - userXsoar
    
        // If claimable <= 0, user has no rewards
        if (claimable <= 0n) {
          return 0
        }
    
        // Convert from raw (smallest unit) to SOAR:
        // SOAR token has 6 decimals, divide by 1,000,000
        const decimals = 6
        const divisor = 10 ** decimals
        const claimableSOAR = Number(claimable) / divisor
    
        return claimableSOAR
      }
  /**
 * Compute the required daily inflow in xSOAR for the desired APR.
 */
  function computeDailyInflowXsoar(totalXsoar: bigint, desiredAprPercent: number): bigint {
    if (desiredAprPercent <= 0 || desiredAprPercent > 100) {
      throw new Error("Invalid APR value. Ensure it's between 0 and 100.");
    }
    const annualRewardXsoar = (totalXsoar * BigInt(desiredAprPercent)) / BigInt(100);
    return annualRewardXsoar / BigInt(365);
  }

  /**
   * Calculate xSOAR for a given stake and duration.
   */
  function calculateXsoar(amount: number | bigint, durationDays: number): bigint {
    if (durationDays < 14 || durationDays > 365) {
      throw new Error("Duration out of range. It must be between 14 and 365 days.");
    }

    const durationSeconds = BigInt(durationDays * SECONDS_PER_DAY);
    const amountBig = BigInt(amount);

    const durationMultiplier = (durationSeconds * XSOAR_PRECISION) / XSOAR_DIV;
    const adjustedMultiplier = durationMultiplier + XSOAR_PRECISION;

    return (adjustedMultiplier * amountBig) / XSOAR_PRECISION;
  }
  
  function calculateMultiplier(
    amount: number | bigint,
    durationDays: number
  ): number {
    // 1) Basic duration check
    if (durationDays < 14 || durationDays > 365) {
      throw new Error("Duration out of range. It must be between 14 and 365 days.");
    }
  
    // 2) Compute xsoar 
    const xsoar: bigint = calculateXsoar(amount, durationDays);
  
    // 3) Convert amount to bigint for arithmetic
    const bigAmount = BigInt(amount);
  
    // 4) Difference = xsoar - amount
    const difference = xsoar - bigAmount;
  
    // If there's no difference or it's negative, no multiplier
    if (difference <= 0n) {
      return 1.0;
    }
  
    // 5) ratio = (difference / amount)
    //    We cast to `Number` for comparison.
    const ratio = Number(difference) / Number(bigAmount);
  
    return Number((1.0 + ratio).toFixed(2));
  }
  

  
   /**
   * Calculate the user's daily reward in SOAR.
   */
   function calculateDailyReward(
    userXsoar: bigint,
    totalXsoar: bigint,
    dailyInflowXsoar: bigint,
  ): number {
    if (totalXsoar <= BigInt(0) || userXsoar <= BigInt(0) || dailyInflowXsoar <= BigInt(0)) {
      return 0;
    }

    const userShare = Number(userXsoar) / Number(totalXsoar);
    const userDailyXsoar = userShare * Number(dailyInflowXsoar);
    return userDailyXsoar;
  }

  /**
   * Calculate the user's APY in SOAR terms.
   */
  function calculateUserApy(dailyReward: number, amount: number): string {
    if (amount <= 0 || dailyReward <= 0) {
      return "0.00%";
    }

    const apy = (dailyReward / amount) * 365 * 100;
    return `${apy.toFixed(2)}%`;
  }



  /**
 * Fetch total xSOAR from the reflection account and compute user's daily reward and APY.
 *
 * @param {number} amount - The user's staked amount in smallest units.
 * @param {number} durationDays - The staking duration in days.
 * @returns {Promise<{ userDailyReward: number; userApy: string }>}
 */
  async function getDailyRewardAndApy(
    amount: number,
    durationDays: number
  ): Promise<{ userDailyReward: number; userApy: string, userMultiplier: string }> {
    try {
      // Hardcoded values
      const desiredAprPercent = 35; // Fixed desired APR
      const decimals = 6; // SOAR has 6 decimals

      // Fetch reflection account data dynamically
      const reflectionPda = getReflectionPda();
      const reflectionAccount = await rewardsProgram.account.reflectionAccount.fetch(reflectionPda);
      const totalXsoar = BigInt(reflectionAccount.totalXsoar.toString());

      if (totalXsoar <= BigInt(0)) {
        throw new Error("Invalid total xSOAR fetched from the reflection account.");
      }

      // Compute daily inflow xSOAR based on desired APR
      const dailyInflowXsoar = computeDailyInflowXsoar(totalXsoar, desiredAprPercent);

      // Calculate user's xSOAR
      const userXsoar = calculateXsoar(amount, durationDays);
      console.log('userXsoar', userXsoar)
      const userMultiplier = BigInt(userXsoar).toString();

      // Calculate the user's daily reward in SOAR
      const userDailyReward = calculateDailyReward(userXsoar, totalXsoar, dailyInflowXsoar);

      // Calculate the user's APY in SOAR terms
      const userApy = calculateUserApy(userDailyReward / Math.pow(10, decimals), amount / Math.pow(10, decimals));
      console.log("User Daily Reward:", userDailyReward);
      console.log("User APY:", userApy);
      return {
        userDailyReward,
        userApy,
        userMultiplier
      };
    } catch (error) {
      console.error("Error in getDailyRewardAndApy:", error);
      throw error;
    }
  }
  
    // --------------------------------------------------------------------------------
    // Return the client object
    // --------------------------------------------------------------------------------
    return {
      // init
      init,
  
      // Build transaction methods (multi-instruction flows)
      buildStakeAndEnterTx,
      buildAddStakeAndSyncTx,
      buildClaimAndStakeTx,
      buildUnbondWithCloseRewardTx,
      buildWithdrawAndCloseTx,
      buildWithdrawTx, // example single-instr
      buildCancelUnbondAndEnterTx,
      buildClaimTx,

       // new methods
      signAndSendTxWeb3,
      buildSPLsendTx,
      buildUnlockVesting,
  
      // Read/Helper methods
      getStakes,
      getClaimableAmount,
      getDailyRewardAndApy,
      computeDailyInflowXsoar,
      calculateXsoar,
      calculateDailyReward,
      calculateUserApy,
      calculateMultiplier,
  
      // PDAs
      getReflectionPda,
      getRewardPda,
      getStakePda,
      getStakingVaultPda,
      getRewardsVaultPda,
      getStakingStakePda,
    }
  }
  

  // 1) Load your local keypair (Node environment example)
const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync('/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json', 'utf-8'))
    )
  )
  
  // 2) Create a Solana Connection 
  const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed')
  
  // 3) Build your config object
  const solanaClientConfig = {
    connection,
    rewardsProgramId: 'EbGAsCqfiFx5K8zvP3dXn5jsX7yojw4tgLZxuENmqTEc',  // Example
    stakingProgramId: 'BKxuAERUTNYEiMuLwz6tSDtrt1tCjhFkHbUBeuVvXBrz',    // Example
    mint: '9359LVZJs8bf2FXcTdHvwcMnvg2ZCf6DUZ5ABDcJKx52',                // Example
  }
   const wallet = new Wallet(walletKeypair)
  // 4) Create the client
  const client = createSolanaClient(solanaClientConfig, wallet, walletKeypair, "https://gennifer-ksidql-fast-mainnet.helius-rpc.com")
  
  // 5) Initialize the client (fetches IDLs, sets up programs)
  ;(async () => {
    try {
      await client.init()
      console.log('Client initialized')
  
      // 6) Build a transaction (non-signing). 
      //    For example, 'buildAddStakeAndSyncTx' with 100 tokens + priority fee of 5000 microLamports.
      const PROGRAM_ID = new PublicKey('CChTq6PthWU82YZkbveA3WDf7s97BWhBK4Vx9bmsT743');
const SEED_WORD = Buffer.from('8699764640650598342289961132526',"utf8");
const MINT_ADDRESS = new PublicKey('9359LVZJs8bf2FXcTdHvwcMnvg2ZCf6DUZ5ABDcJKx52');
      const tx = await client.buildUnlockVesting(PROGRAM_ID, SEED_WORD, 10)
      console.log('Transaction built:', tx)
    const dailyRewardAndApy = await client.getDailyRewardAndApy(100, 30);
    const xsoar = client.calculateXsoar(19000000, 30);
    console.log(xsoar)
    console.log('Daily Reward and APY:', dailyRewardAndApy);
      // 7) Sign & send the transaction. 
      //    We'll create an AnchorProvider with the same connection & wallet, then do sendAndConfirm
      const provider = new AnchorProvider(connection, wallet, {
        preflightCommitment: 'confirmed',
      })

  const destinationPubkey = new PublicKey('4zDR65qBnjjDqXjMs3fFjPzoxyJdMsihttAJi4cXDdGc')
  // Build a basic SPL token transfer of 100 base units with 5000 micro-lamports priority fee
  const priorityLevel: HeliusPriorityLevel = "Low";
  const txspl = await client.buildSPLsendTx(destinationPubkey, 1, priorityLevel)
  

  
  // Calculate the total transaction costs
  const { totalCostSOL } = await calculateTotalTransactionCost(
    txspl,
    connection
  );  
  console.log('Total transaction cost in SOL:', totalCostSOL);
  // Sign & send




 
  //const solanaClient = createSolanaWeb3Client(connection, walletKeypair);
  const signature = await client.signAndSendTxWeb3(txspl);
  console.log('Transaction sent:', signature);
  


     } catch (err) {
       console.error('Error initializing or sending tx:', err)
     }
  })()