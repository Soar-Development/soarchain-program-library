import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    sendAndConfirmTransaction,
    SYSVAR_RENT_PUBKEY,
  } from '@solana/web3.js';
  import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
  } from '@solana/spl-token';
  import * as borsh from 'borsh';
  import * as fs from 'fs';
  
  // Stake Instruction Class and Schema
  class StakeInstruction {
    amount: bigint;
    duration: bigint;
  
    constructor({ amount, duration }) {
      this.amount = amount;
      this.duration = duration;
    }
  }
  
  const stakeInstructionSchema = new Map([
    [
      StakeInstruction,
      {
        kind: 'struct',
        fields: [
          ['amount', 'u64'],
          ['duration', 'u128'],
        ],
      },
    ],
  ]);
  
  async function main() {
    // Connection setup
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
    // Load wallet keypair
    const walletPath = "/home/alp/.config/solana/soarMN9ky6JHALASZPNEmg4yUVP34g25gSULxvHBXPX.json";
    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );
    const walletPublicKey = walletKeypair.publicKey;
  
    console.log('Wallet loaded:', walletPublicKey.toBase58());
  
    // Program ID and Mint Address
    const programId = new PublicKey('3okSkAJndz63yQxgx7qQWDiTpS2jv4G7yQjFSJHvnbUW');
    const mint = new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP');
  
    // Derive PDAs
    const [vaultPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('vault'), mint.toBuffer(), walletPublicKey.toBuffer()],
      programId
    );
    const [stakePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('stake'), mint.toBuffer(), walletPublicKey.toBuffer()],
      programId
    );
  
    console.log('Vault PDA:', vaultPDA.toBase58());
    console.log('Stake PDA:', stakePDA.toBase58());
  
    // Get Associated Token Account
    const userATA = await getAssociatedTokenAddress(mint, walletPublicKey);
  
    // Define amount and duration
    const amount = BigInt(1000); // u64
    const duration = BigInt(1209600); // u128
  
    // Add Instruction Discriminator (first 8 bytes of sha256("global:stake"))
    const stakeDiscriminator = Buffer.from([206,176,202,18,200,209,179,108]);
  
    // Serialize the instruction data
    const stakeInstructionData = Buffer.concat([
      stakeDiscriminator,
      borsh.serialize(
        stakeInstructionSchema,
        new StakeInstruction({ amount, duration })
      ),
    ]);
  
    // Create transaction instruction
    const stakeInstruction = new TransactionInstruction({
      keys: [
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: stakePDA, isSigner: false, isWritable: true },
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId,
      data: stakeInstructionData,
    });
  
    // Create and send transaction
    const transaction = new Transaction().add(stakeInstruction);
    const signature = await sendAndConfirmTransaction(connection, transaction, [walletKeypair]);
  
    console.log('Transaction signature:', signature);
  }
  
  main().catch((err) => {
    console.error('Error:', err);
  });
  