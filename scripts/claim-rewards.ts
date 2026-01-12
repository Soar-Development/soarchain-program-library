import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
import { PublicKey, Keypair } from '@solana/web3.js';
import { pda } from '../tests/utils';
import * as fs from 'fs';
// @ts-ignore
import { SoachainRewards } from '../target/types/soachain_rewards';
import { getAssociatedTokenAddress } from '@solana/spl-token';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';

  // Check if ANCHOR_WALLET is set, otherwise throw an error
  const walletPath = "/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json";


  // Load wallet keypair
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  const wallet = new Wallet(walletKeypair);


  // Set up the provider
  const connection = new web3.Connection(rpcUrl, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
  setProvider(provider);

  // Setup JS program
  const programId = new PublicKey('D2gfyTxuyFxTXyw8yfBTVN1ZqmPpUvnvgZN6BopDF89v');
  const mint = new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP');
  const stakeprogramId = new PublicKey('3okSkAJndz63yQxgx7qQWDiTpS2jv4G7yQjFSJHvnbUW'); // Replace with your program ID

  // Fetch IDL with the provider
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;

  // Instantiate the program with the provider
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainRewards>;

  // Define the accounts
  const user = wallet.publicKey;
  const [reflection] = PublicKey.findProgramAddressSync(
    [utf8.encode('reflection')],
    programId
  );
  console.log('Reflection account:', reflection.toBase58());

  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), user.toBuffer()],
    programId
  );
  console.log('Reward account:', reward.toBase58());

  const [stake] = PublicKey.findProgramAddressSync(
    [utf8.encode('stake'), mint.toBuffer(), user.toBuffer()],
    stakeprogramId
  );
  console.log('Stake account:', stake);





  const [vault] = PublicKey.findProgramAddressSync( [mint.toBuffer()], programId)
console.log('Vault account:', vault.toBase58());
  console.log('Stake account:', stake.toBase58());
  const ata = await getAssociatedTokenAddress(mint, user);
  console.log('Associated token account:', ata.toBase58());
  // Create the claim transaction
 const vaultUsed = await pda([mint.toBuffer()], programId);
  console.log('Vault accountUSED:', vaultUsed.toBase58());
  const tx = await program.methods
    .claim()
    .accounts({
      user: ata,
      vault: vault,
      reflection,
      reward,
      stake,
        })
    .rpc();

  console.log(`Transaction signature: ${tx}`);
  console.log(`User account: ${user.toBase58()}`);
  console.log(`Vault account: ${await pda([mint.toBuffer()], programId)}`);
  console.log(`Reflection account: ${reflection.toBase58()}`);
  console.log(`Reward account: ${reward.toBase58()}`);
  console.log(`Stake account: ${stake.toBase58()}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));