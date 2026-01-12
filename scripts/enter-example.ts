import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { publicKey } from '@metaplex-foundation/umi';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

  // Check if ANCHOR_WALLET is set, otherwise throw an error
  const walletPath = process.env.ANCHOR_WALLET || '/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json';
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
  const programId = new PublicKey('D2gfyTxuyFxTXyw8yfBTVN1ZqmPpUvnvgZN6BopDF89v'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider);
  const mint = new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP'); // Replace with your mint public key
  const authority = wallet.publicKey;

  const stakeprogramId = new PublicKey('3okSkAJndz63yQxgx7qQWDiTpS2jv4G7yQjFSJHvnbUW'); // Replace with your program ID

  const [reflection] =  PublicKey.findProgramAddressSync(
    [utf8.encode('reflection')],
    programId,
  );
  console.log('Reflection account:', reflection.toBase58());
  const [stake] =  PublicKey.findProgramAddressSync(
    [utf8.encode('stake'), mint.toBuffer(), authority.toBuffer()],
    stakeprogramId,
  );
 console.log('Stake account:', stake.toBase58());
 
  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), authority.toBuffer()],
    programId,
  );
console.log('Reward account:', reward.toBase58());
  // Define the accounts

  // Create the enter transaction
  const tx = await program.methods
    .enter()
    .accounts({
      reflection,
      stake,
      reward,
      authority,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log(`Transaction signature: ${tx}`);
  console.log(`Reflection account: ${reflection.toBase58()}`);
  console.log(`Stake account: ${stake.toBase58()}`);
  console.log(`Reward account: ${reward.toBase58()}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));