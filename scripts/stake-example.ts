import { AnchorProvider, Idl, Program, setProvider, web3, Wallet, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

  // Check if ANCHOR_WALLET is set, otherwise throw an error
  const walletPath = "/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json"
  if (!walletPath) {
    throw new Error('ANCHOR_WALLET environment variable is not set.');
  }

  // Load wallet keypair
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new Wallet(walletKeypair);
  console.log('Wallet loaded.',wallet.publicKey.toBase58());
  // Set up the provider
  const connection = new web3.Connection(rpcUrl, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
  setProvider(provider);

  // Setup JS program
  const programId = new PublicKey('3okSkAJndz63yQxgx7qQWDiTpS2jv4G7yQjFSJHvnbUW'); // Replace with your program ID // config api = reward and stake
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider);

  // Define the accounts
  const mint = new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP'); // Replace with your mint public key
  const user = wallet.publicKey;
  console.log('User account:',user.toBase58());
  const [vault] =  PublicKey.findProgramAddressSync(
    [utf8.encode('vault'), mint.toBuffer(), user.toBuffer()],
    programId
  );
  const [stake] = PublicKey.findProgramAddressSync(
    [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
    programId
  );
console.log('Vault account:',vault.toBase58());
console.log('Stake account:',stake.toBase58());
  const ata = await getAssociatedTokenAddress(mint, user);
  console.log('Associated token account:',ata.toBase58());
  // Define the amount and duration
  const amount = new BN(1000); // Replace with the amount to stake
  const duration = new BN(1209600); // Replace with the duration in seconds

  // Create the stake transaction
  const tx = await program.methods
    .stake(amount, duration)
    .accounts({
        mint,
        user: ata, // Use the associated token account
        vault,
        stake,
        authority: user,
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