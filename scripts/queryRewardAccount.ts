import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
// @ts-ignore
import { SoachainRewards } from '../target/types/soachain_rewards';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';


  // Check if ANCHOR_WALLET is set, otherwise throw an error
  const walletPath = process.env.ANCHOR_WALLET || '/home/alp/.config/solana/id.json';
  if (!walletPath) {
    throw new Error('ANCHOR_WALLET environment variable is not set.');
  }

  // Load wallet keypair
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new Wallet(walletKeypair);
  console.log('Wallet loaded.', wallet.publicKey.toBase58());

  // Set up the provider
  const connection = new web3.Connection(rpcUrl, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
  setProvider(provider);

  // Setup JS program
  const programId = new PublicKey('5WrZKawc9oMr59cwG6SaBsnbGe8eXmhCiZCFNL4CbVqs'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainRewards>;

  // Define the reward account public key
  const rewardAccountPubkey = new PublicKey('GLoSiWymyhz7E8Dpc1iQdPAyEij7VFhCZV6vL75vjQvf');

  // Fetch the reward account data
  const rewardAccountInfo = await connection.getAccountInfo(rewardAccountPubkey);

  if (rewardAccountInfo === null) {
    console.log('Reward account not found');
    return;
  }

  // Decode the account data
  const rewardAccount = program.account.rewardAccount.coder.accounts.decode('RewardAccount', rewardAccountInfo.data);

  // Display the account details
  console.log('Reward Account:', rewardAccountPubkey.toBase58());
  console.log('Reward Account Details:', {
    authority: rewardAccount.authority.toBase58(),
    bump: rewardAccount.bump,
    reflection: rewardAccount.reflection.toString(),
    xsoar: rewardAccount.xsoar.toString(),
  });
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));