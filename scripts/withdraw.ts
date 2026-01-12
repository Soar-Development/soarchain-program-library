import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import { pda } from '../tests/utils';
import * as fs from 'fs';
import { getAssociatedTokenAddress } from '@solana/spl-token';

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
  const programId = new PublicKey('HjmYWcRm6At1ptF5MuxSqaC9EKZwnA7bbLYviQfDhWCK'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider);

  // Define the accounts
  const mint = new PublicKey('93gXNAHBstYJr5LJgsjjHwnCYohvoDz27bA4T76PsRpm'); // Replace with your mint public key
  const user = wallet.publicKey;
  const [vault] = PublicKey.findProgramAddressSync(
    [utf8.encode('vault'), mint.toBuffer(), user.toBuffer()],
    programId
  );
  const [stake] = PublicKey.findProgramAddressSync(
    [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
    programId
  );

  const ata = await getAssociatedTokenAddress(mint, user);
  console.log('Associated token account:', ata.toBase58());

  // Create the withdraw transaction
  const tx = await program.methods
    .withdraw()
    .accounts({
      user: ata, // Use the associated token account
      vault,
      stake,
      authority: user,
      mint,
    })
    .rpc();

  console.log(`Transaction signature: ${tx}`);
  console.log(`Vault account: ${vault.toBase58()}`);
  console.log(`Stake account: ${stake.toBase58()}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));