process.env.ANCHOR_WALLET = '/home/alp/.config/solana/id.json';

import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { SoarchainRewards } from '../target/types/soarchain_rewards';

const rewardsProgramId = new PublicKey('EbGAsCqfiFx5K8zvP3dXn5jsX7yojw4tgLZxuENmqTEc'); 
const rpcUrl = 'https://mainnet.helius-rpc.com/?api-key=9a2e3c8d-e9f7-424e-a48b-2952da9a4df3'; 

// Set up the connection and provider
const connection = new web3.Connection(rpcUrl, 'confirmed');
const provider = new AnchorProvider(connection, Wallet.local(), { preflightCommitment: 'confirmed' });
setProvider(provider);

// Helper methods for PDAs
function getReflectionPda(): PublicKey {
  const [reflection] = PublicKey.findProgramAddressSync([utf8.encode('reflection')], rewardsProgramId);
  return reflection;
}

function getRewardPda(user: PublicKey): PublicKey {
  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), user.toBuffer()],
    rewardsProgramId,
  );
  return reward;
}

// Main function to get claimable amount
async function getClaimableAmount(walletAddress: string, rewardsProgram: Program<SoarchainRewards>): Promise<number> {
  const user = new PublicKey(walletAddress);
  const reflectionPda = getReflectionPda();
  const rewardPda = getRewardPda(user);

  // Fetch the reflection account data
  const reflectionAccount = await rewardsProgram.account.reflectionAccount.fetch(reflectionPda);
  // reflectionAccount fields: { rate: u128, totalReflection: u128, totalXsoar: u128, ... }

  // Fetch the reward account data
  const rewardAccountInfo = await provider.connection.getAccountInfo(rewardPda);
  if (!rewardAccountInfo) {
    // No reward account means user not entered yet, so claimable = 0
    return 0;
  }

  const rewardAccount = await rewardsProgram.account.rewardAccount.fetch(rewardPda);
  // rewardAccount fields: { reflection: u128, xsoar: u128, ... }

  const rate = BigInt(reflectionAccount.rate.toString()); // u128 as BigInt
  const userReflection = BigInt(rewardAccount.reflection.toString());
  const userXsoar = BigInt(rewardAccount.xsoar.toString());

  // Calculate the claimable amount using contract logic:
  // amount = (reflection / rate) - xsoar
  const userXsoarEquivalent = userReflection / rate;
  let claimable = userXsoarEquivalent - userXsoar;

  // If claimable <= 0, user has no rewards
  if (claimable <= 0n) {
    return 0;
  }

  // Convert from raw (smallest unit) to SOAR:
  // SOAR token has 6 decimals, divide by 1,000,000
  const decimals = 6;
  const divisor = 10 ** decimals;
  const claimableSOAR = Number(claimable) / divisor;

  return claimableSOAR;
}

// Initialize the rewards program
async function initializeRewardsProgram() {
  const idl = (await Program.fetchIdl(rewardsProgramId, provider)) as Idl;
  const rewardsProgram = new Program(idl, rewardsProgramId, provider) as unknown as Program<SoarchainRewards>;

  // Example usage
  const walletAddress = 'Ays6XakbxBpx2zX1AWCfNhu6Deg5G81SnouKCqqv5daw'; // Replace with the user's wallet address
  getClaimableAmount(walletAddress, rewardsProgram)
    .then((claimableAmount) => {
      console.log(`Claimable amount: ${claimableAmount.toFixed(6)} SOAR`);
    })
    .catch((err) => {
      console.error(`Error: ${err.message}`);
    });
}

initializeRewardsProgram()
  .then(() => console.log('Rewards program initialized.'))
  .catch((err) => console.error(`Initialization error: ${err.message}`));