import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
// @ts-ignore
import { SoachainRewards } from '../target/types/soachain_rewards';

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
  const programId = new PublicKey('2CPdjDSQgm33CjVCnUtWSjUwS7xbf7Dactwu2ft7t2pP'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainRewards>;

  // Define the accounts
  const user = wallet.publicKey;
  const [reflection] = PublicKey.findProgramAddressSync(
    [utf8.encode('reflection')],
    programId
  );
  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), user.toBuffer()],
    programId
  );

  // Create the close transaction
  const tx = await program.methods
    .close()
    .accounts({
      reflection,
      reward,
      authority: user,
    })
    .rpc();

  console.log(`Transaction signature: ${tx}`);
  console.log(`Reflection account: ${reflection.toBase58()}`);
  console.log(`Reward account: ${reward.toBase58()}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));