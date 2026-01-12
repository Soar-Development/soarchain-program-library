import { AnchorProvider, Idl, Program, setProvider, Wallet, web3 } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { SoarchainRewards } from '../target/types/soarchain_rewards';
import * as fs from 'fs';

// Constants
const SECONDS_PER_DAY: number = 24 * 60 * 60; // 86,400 seconds
const DURATION_MIN: number = 14 * SECONDS_PER_DAY; // 2 weeks
const DURATION_MAX: number = 365 * SECONDS_PER_DAY; // 1 year
const XSOAR_PRECISION: bigint = BigInt(1e15); // 1e15
const XSOAR_DIV: bigint = BigInt((4 * DURATION_MAX) / 12); // 0.25 growth per month

// Environment setup
process.env.ANCHOR_WALLET = '/home/alp/.config/solana/id.json';

const rewardsProgramId = new PublicKey('EbGAsCqfiFx5K8zvP3dXn5jsX7yojw4tgLZxuENmqTEc');
const rpcUrl ='https://marthena-43qt7z-fast-mainnet.helius-rpc.com';
// Helper methods for PDAs
function getReflectionPda(): PublicKey {
  const seeds = [utf8.encode('reflection')];
  const [pda] = PublicKey.findProgramAddressSync(seeds, rewardsProgramId);
  return pda;
}

/**
 * Function to calculate xSOAR score.
 *
 * @param {number | bigint} amount - The amount staked.
 * @param {number | bigint} duration - The duration of the stake in days.
 * @param {number | bigint} [timeUnstake=0] - The time of unstake (optional, default is 0).
 * @returns {bigint} The calculated xSOAR score.
 */
function calculateXsoar(amount: number | bigint, duration: number | bigint, timeUnstake: number | bigint = 0): bigint {
  // Convert inputs to BigInt
  const amountBigInt = BigInt(amount);
  const durationBigInt = BigInt(duration);
  const timeUnstakeBigInt = BigInt(timeUnstake);

  // Check if the stake is unbonded
  if (timeUnstakeBigInt !== BigInt(0)) {
    return BigInt(0);
  }

  // Ensure duration is within allowed range
  if (durationBigInt < BigInt(DURATION_MIN) || durationBigInt > BigInt(DURATION_MAX)) {
    throw new Error("Duration is out of allowed range.");
  }

  // Calculate duration multiplier
  const durationMultiplier = (durationBigInt * XSOAR_PRECISION) / XSOAR_DIV;

  // Adjusted multiplier
  const adjustedMultiplier = durationMultiplier + XSOAR_PRECISION;

  // Calculate xSOAR
  const xsoar = (adjustedMultiplier * amountBigInt) / XSOAR_PRECISION;

  return xsoar;
}

/**
 * Compute the required daily inflow in xSOAR for the desired APR.
 *
 * @param {bigint} totalXsoar - The total xSOAR in the reflection pool.
 * @param {number} desiredAprPercent - The desired APR as a percentage.
 * @returns {bigint} The daily inflow in xSOAR units.
 */
function computeDailyInflowXsoar(totalXsoar: bigint, desiredAprPercent: number): bigint {
  // Calculate the total annual reward in xSOAR based on the desired APR
  const annualRewardXsoar = (totalXsoar * BigInt(desiredAprPercent)) / BigInt(100);

  // Divide the annual reward by 365 to get the daily inflow in xSOAR
  const dailyInflowXsoar = annualRewardXsoar / BigInt(365);

  return dailyInflowXsoar;
}

/**
 * Fetch the IDL and reflection account data.
 *
 * @param {AnchorProvider} provider - The Anchor provider.
 * @returns {Promise<{ program: Program<SoachainRewards>, reflectionAccount: any }>} The program and reflection account data.
 */
async function fetchIdlAndReflection(provider: AnchorProvider): Promise<{ program: Program<SoarchainRewards>, reflectionAccount: any }> {
  // Fetch the IDL
  const idl = await Program.fetchIdl(rewardsProgramId, provider);
  const program = new Program(idl as Idl, rewardsProgramId, provider) as unknown as Program<SoarchainRewards>;

  // Fetch the reflection account
  const reflectionPda = getReflectionPda();
  console.log('Reflection PDA:', reflectionPda.toBase58());
  const reflectionAccount = await program.account.reflectionAccount.fetch(reflectionPda);
  return { program, reflectionAccount };
}

// Example Usage
(async () => {
  try {
    // Set up the Anchor provider
    const connection = new Connection(rpcUrl, 'confirmed');
    const walletPath = process.env.ANCHOR_WALLET;
    const walletKeypair = web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );
    const wallet = new Wallet(walletKeypair);

    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });
    setProvider(provider);

    // Fetch the IDL and reflection account data
    const { program, reflectionAccount } = await fetchIdlAndReflection(provider);
    const totalXsoar = BigInt(reflectionAccount.totalXsoar.toString());

    // Define the desired APR
    const desiredAprPercent = 35;

    // Compute the required daily inflow
    const dailyInflowXsoar = computeDailyInflowXsoar(totalXsoar, desiredAprPercent);

    // Example stake amount and duration
    const stakeAmount: number = 1850000000; // Amount of tokens staked in smallest units
    const stakeDurationDays: number = 30; // Duration in days

    // Convert days to seconds
    const stakeDurationSeconds: number = stakeDurationDays * SECONDS_PER_DAY;

    // Call calculateXsoar
    const userXsoar = calculateXsoar(stakeAmount, stakeDurationSeconds);
    console.log(`User xSOAR: ${userXsoar.toString()}`);

    // Calculate user's share of the daily inflow with improved precision
    const userDailyInflowXsoar = (userXsoar * dailyInflowXsoar * XSOAR_PRECISION) / (totalXsoar * XSOAR_PRECISION);
    console.log(`User's daily inflow xSOAR: ${userDailyInflowXsoar.toString()}`);

    // Calculate user's APY
    const userAPY = (userDailyInflowXsoar * BigInt(365) * BigInt(100)) / BigInt(stakeAmount);
    console.log(`User's APY: ${userAPY.toString()}%`);

    console.log(`Total xSOAR: ${totalXsoar.toString()}`);
    console.log(`Desired APR: ${desiredAprPercent}%`);
    console.log(`Computed daily inflow xSOAR: ${dailyInflowXsoar.toString()}`);
  } catch (error) {
    console.error('Error:', error);
  }
})();