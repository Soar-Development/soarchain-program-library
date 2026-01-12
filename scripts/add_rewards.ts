import { AnchorProvider, Idl, Program, setProvider, web3, Wallet, BN } from '@coral-xyz/anchor';
import { PublicKey, Keypair, ComputeBudgetProgram } from '@solana/web3.js';
import * as fs from 'fs';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { pda } from '../tests/utils';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://marthena-43qt7z-fast-mainnet.helius-rpc.com';

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
  const programId = new PublicKey('EbGAsCqfiFx5K8zvP3dXn5jsX7yojw4tgLZxuENmqTEc'); // Replace with your program ID
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;
  const program = new Program(idl, programId, provider);

  // Define the accounts
  const mint = new PublicKey('9359LVZJs8bf2FXcTdHvwcMnvg2ZCf6DUZ5ABDcJKx52'); 
  const user = wallet.publicKey;
  const [reflection] = PublicKey.findProgramAddressSync(
    [utf8.encode('reflection')],
    programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [mint.toBuffer()],
    programId
  );
  
  console.log('Vault account:', vault.toBase58()); 
  console.log('Reflection account:', reflection.toBase58());

  const ata = await getAssociatedTokenAddress(mint, user);
  console.log('Associated token account:', ata.toBase58());

  // Define the amount to add to the vault
  const amount = new BN(246677575108); // Replace with the amount you want to add

  // Create the addFunds instruction
  const addFundsInstruction = await program.methods
    .addFunds(amount)
    .accounts({
      user: ata, // Use the associated token account
      reflection,
      vault: await pda([mint.toBuffer()], programId),
      mint,
    })
    .instruction();

  // Create a transaction
  const transaction = new web3.Transaction();

  // Add a compute budget instruction to set a higher compute unit price (priority fee)
  // The value is in micro-lamports per compute unit. 
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 10000, // This sets the priority fee. 
    })
  );

  // Add the main program instruction
  transaction.add(addFundsInstruction);

  // Fetch the latest blockhash and set fee payer
  transaction.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send the transaction
  const signedTransaction = await provider.wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`Transaction signature: ${signature}`);
  console.log(`Reflection account: ${reflection.toBase58()}`);
  console.log(`Vault account: ${vault.toBase58()}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));
