import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import { pda } from '../tests/utils';
import * as fs from 'fs';
// @ts-ignore
import { SoachainStaking } from '../target/types/soachain_staking';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';

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
  const programId = new PublicKey('BXX3hNwo3K7LyqzM3CZ8EtbuqYMtpjqJiPKnVkWnRY3w'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainStaking>;
  const programIdrewards = new PublicKey('2CPdjDSQgm33CjVCnUtWSjUwS7xbf7Dactwu2ft7t2pP');
  const mint = new PublicKey('2VMFGgtWFaz2mrHxLPvgYahgWNaVzMZaSvrMgE91rX8P'); // Replace with your mint public key

  // Define the accounts
  const user = wallet.publicKey;
  const [stake] = PublicKey.findProgramAddressSync(
    [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
    programId
  );
  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), user.toBuffer()],
    programIdrewards
  );
  console.log(`Stake account: ${stake.toBase58()}`);
  console.log(`Reward account: ${reward.toBase58()}`);

  // Create the unbond transaction
  const tx = await program.methods
    .unbond()
    .accounts({
      stake,
      reward,
      authority: user,
    })
    .rpc();

  console.log(`Transaction signature: ${tx}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));