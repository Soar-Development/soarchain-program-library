import { AnchorProvider, Idl, Program, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { PublicKey, Keypair } from '@solana/web3.js';
import { pda } from '../tests/utils';
import * as fs from 'fs';
// @ts-ignore
import { SoachainRewards } from '../target/types/soachain_rewards';

async function main() {
  // Check if ANCHOR_PROVIDER_URL is set, otherwise use a default value
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';

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
  const programId = new PublicKey('GZ4oyosaMgWF92RtNhm9d2226WUna2chSJ6qDuniRiFd');
  const mint = new PublicKey('413HxKyXfZhYscc5Bq7nHoWPc28ZMV7HXMSSuEVX1TB6');

  // Fetch IDL with the provider
  const idl = (await Program.fetchIdl(programId, provider)) as Idl;

  // Instantiate the program with the provider
  const program = new Program(idl, programId, provider) as unknown as Program<SoachainRewards>;

  // Calculate PDAs for reflection and vault accounts
  const reflectionPda = await pda([utf8.encode('reflection')], programId);
  const vaultPda = await pda([mint.toBuffer()], programId);

  // Fetch account information
  const reflectionAccount = await connection.getAccountInfo(reflectionPda);
  const vaultAccount = await connection.getAccountInfo(vaultPda);

  // fetch rewards account
  const [reward] = PublicKey.findProgramAddressSync(
    [utf8.encode('reward'), wallet.publicKey.toBuffer()],
    programId
  );
  const rewardAccount = await connection.getAccountInfo(reward);


  // Display account information
  console.log('Reflection Account:', reflectionPda.toBase58());
  console.log('Reflection Account Info:', reflectionAccount);

  console.log('Vault Account:', vaultPda.toBase58());
  console.log('Vault Account Info:', vaultAccount);

  console.log('Reward Account:', reward.toBase58());
  console.log('Reward Account Info:', rewardAccount);
}

console.log('Running client.');
main()
  .then(() => console.log('Success'))
  .catch((err) => console.error(err));