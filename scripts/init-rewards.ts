import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { PublicKey, Keypair } from '@solana/web3.js';
import { pda } from '../tests/utils';
import * as fs from 'fs';
// @ts-ignore
import { SoachainRewards } from '../target/types/soachain_rewards';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  // Check if ANCHOR_WALLET is set, otherwise throw an error
  const walletPath = "/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json"

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
  const programId = new PublicKey('5WrZKawc9oMr59cwG6SaBsnbGe8eXmhCiZCFNL4CbVqs');
  const mint = new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP');
  const [vault] = PublicKey.findProgramAddressSync(
    [mint.toBuffer()],
    programId)

    const [reflection] = PublicKey.findProgramAddressSync(
      [utf8.encode('reflection')],
      programId
    );
  // Fetch IDL with the provider
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;

  // Instantiate the program with the provider
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainRewards>;
  console.log('Program instantiated.',program);
  // Init vault
  const tx = await program.methods
    .init()
    .accounts({
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      vault: vault,
      reflection: reflection,
      mint,
    })
    .rpc();
  console.log(`https://explorer.solana.com/tx/${tx}`);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));

