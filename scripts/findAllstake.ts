import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
// @ts-ignore
import { SoarchainStaking } from '../target/types/soarchain_staking';
import { BN } from '@project-serum/anchor';

type StakeAccount = {
  amount: BN;
  authority: PublicKey;
  duration: BN;
  timeUnbond: BN;
  vault: PublicKey;
  vaultBump: number;
  xsoar: BN;
};

async function main() {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://mainnet.helius-rpc.com/?api-key=9a2e3c8d-e9f7-424e-a48b-2952da9a4df3';
  const walletPath = process.env.ANCHOR_WALLET || '/home/alp/.config/solana/id.json';

  // Load wallet keypair
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new Wallet(walletKeypair);
  console.log('Wallet loaded:', wallet.publicKey.toBase58());

  // Set up the provider
  const connection = new web3.Connection(rpcUrl, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
  setProvider(provider);

  // Initialize the program
  const programId = new PublicKey('BKxuAERUTNYEiMuLwz6tSDtrt1tCjhFkHbUBeuVvXBrz');
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider) as unknown as Program<SoarchainStaking>;

  console.log('Fetching staking accounts...');
  const allStakes = await program.account.stakeAccount.all();
  console.log(`Found ${allStakes.length} staking accounts.`);

  // Initialize an array to hold the stake account details
  const stakeAccounts = [];
  let totalAmount = new BN(0);
  let totalXsoar = new BN(0);

  // Process and display each stake account
  allStakes.forEach((stake) => {
    const account = stake.account as StakeAccount;
    const accountDetails = {
      publicKey: stake.publicKey.toBase58(),
      amount: account.amount.toString(),
      authority: account.authority.toBase58(),
      duration: account.duration.toString(),
      timeUnbond: account.timeUnbond.toString(),
      vault: account.vault.toBase58(),
      vaultBump: account.vaultBump,
      xsoar: account.xsoar.toString(),
    };

    // Add the account details to the array
    stakeAccounts.push(accountDetails);

    // Sum up the amounts
    totalAmount = totalAmount.add(account.amount);
    totalXsoar = totalXsoar.add(account.xsoar);
  });

  // Sort the stake accounts by amount in descending order
  stakeAccounts.sort((a, b) => {
    const amountA = new BN(a.amount);
    const amountB = new BN(b.amount);
    return amountB.cmp(amountA);
  });

  // Write the stake account details to a JSON file
  fs.writeFileSync('stakeAccounts.json', JSON.stringify(stakeAccounts, null, 2));
  console.log('Stake account details written to stakeAccounts.json');

  // Display the total amount
  console.log('Total Amount:', totalAmount.toString());
  console.log('Total XSOAR:', totalXsoar.toString());
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error('Error:', err));