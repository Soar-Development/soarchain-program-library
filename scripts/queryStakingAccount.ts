import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
// @ts-ignore
import { SoachainStaking } from '../target/types/soachain_staking';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.mainnet-beta.solana.com';

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
  const programId = new PublicKey('BKxuAERUTNYEiMuLwz6tSDtrt1tCjhFkHbUBeuVvXBrz'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainStaking>;

  // Define the stake account public key
  const stakeAccountPubkey = new PublicKey('Fx2QU4SSqAzJApKbvwzHbwmUVeQqxxdE6MeVxbphTGzj');

  // Fetch the stake account data
  const stakeAccountInfo = await connection.getAccountInfo(stakeAccountPubkey);

  if (stakeAccountInfo === null) {
    console.log('Stake account not found');
    return;
  }

  // Decode the account data
  const stakeAccount = program.account.stakeAccount.coder.accounts.decode('StakeAccount', stakeAccountInfo.data);
 const allStakes = await program.account.stakeAccount.all();
  // Display the account details
  console.log('Stake Account:', stakeAccountPubkey.toBase58());
  console.log('Stake Account Details:', {
    amount: stakeAccount.amount.toString(),
    authority: stakeAccount.authority.toBase58(),
    duration: stakeAccount.duration.toString(),
    timeUnbond: stakeAccount.timeUnbond.toString(),
    vault: stakeAccount.vault.toBase58(),
    vaultBump: stakeAccount.vaultBump,
    xsoar: stakeAccount.xsoar.toString(),
  });
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));