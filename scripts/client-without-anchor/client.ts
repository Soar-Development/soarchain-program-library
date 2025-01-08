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
import { Buffer } from 'buffer'; 

  // ----------------------------------------------------------------
// Constants for xSOAR calculation
// ----------------------------------------------------------------
const SECONDS_PER_DAY = 24 * 60 * 60;
const DURATION_MAX = 365 * SECONDS_PER_DAY;  // 1 year
const XSOAR_PRECISION = BigInt(10 ** 15);    // 1e15
const DURATION_MAX_BIG = BigInt(DURATION_MAX);
const XSOAR_DIV = (4n * DURATION_MAX_BIG) / 12n; // 0.25 growth per month
// ----------------------------------------------------------------
// Staking Account Schema
// ----------------------------------------------------------------
class StakeAccount {
  amount: bigint | number;
  authority: Uint8Array; 
  duration: bigint | number;
  timeUnbond: bigint | number;
  vault: Uint8Array; 
  vaultBump: number;
  xsoar: Uint8Array;

  constructor(args: {
    amount: bigint | number;
    authority: Uint8Array;
    duration: bigint | number;
    timeUnbond: bigint | number;
    vault: Uint8Array;
    vaultBump: number;
    xsoar: Uint8Array;
  }) {
    Object.assign(this, args);
  }
}

const stakeAccountSchema = new Map([
  [
    StakeAccount,
    {
      kind: 'struct',
      fields: [
        ['amount', 'u64'],
        ['authority', [32]],
        ['duration', 'u64'],
        ['timeUnbond', 'u64'],
        ['vault', [32]],
        ['vaultBump', 'u8'],
        ['xsoar', [16]], // 16 bytes -> manual bigint conversion
      ],
    },
  ],
]);

// ----------------------------------------------------------------
// Reflection Account Schema
// ----------------------------------------------------------------
class ReflectionAccount {
  rate: Uint8Array;
  totalReflection: Uint8Array;
  totalXsoar: Uint8Array;
  vault: Uint8Array;
  vaultBump: number;

  constructor(args: {
    rate: Uint8Array;
    totalReflection: Uint8Array;
    totalXsoar: Uint8Array;
    vault: Uint8Array;
    vaultBump: number;
  }) {
    Object.assign(this, args);
  }
}

const reflectionAccountSchema = new Map([
  [
    ReflectionAccount,
    {
      kind: 'struct',
      fields: [
        ['rate', [16]],
        ['totalReflection', [16]],
        ['totalXsoar', [16]],
        ['vault', [32]],
        ['vaultBump', 'u8'],
      ],
    },
  ],
]);


// ----------------------------------------------------------------
// RewardAccount Account Schema
// ----------------------------------------------------------------
class RewardAccount {
  authority: Uint8Array;   // We'll convert this to PublicKey
  bump: number;            // u8
  reflection: Uint8Array;  // 16 bytes -> we manually convert to bigint
  xsoar: Uint8Array;       // 16 bytes -> we manually convert to bigint

  constructor(args: {
    authority: Uint8Array;
    bump: number;
    reflection: Uint8Array;
    xsoar: Uint8Array;
  }) {
    Object.assign(this, args);
  }
}

const rewardAccountSchema = new Map([
  [
    RewardAccount,
    {
      kind: 'struct',
      fields: [
        ['authority', [32]],    // 32 bytes
        ['bump', 'u8'],         // 1 byte
        ['reflection', [16]],   // 16 bytes
        ['xsoar', [16]],        // 16 bytes
      ],
    },
  ],
]);


// ----------------------------------------------------------------
// Instruction Schemas (Stake, AddStake, Extend, etc.)
// ----------------------------------------------------------------
class StakeInstruction {
  amount: bigint;
  duration: bigint;
  constructor({ amount, duration }: { amount: bigint; duration: bigint }) {
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
        ['duration', 'u128'], // adjust to match on-chain
      ],
    },
  ],
]);

class AddStakeInstruction {
  amount: bigint;
  constructor({ amount }: { amount: bigint }) {
    this.amount = amount;
  }
}

const addStakeInstructionSchema = new Map([
  [
    AddStakeInstruction,
    {
      kind: 'struct',
      fields: [['amount', 'u64']],
    },
  ],
]);

class ExtendInstruction {
  duration: bigint;
  constructor({ duration }: { duration: bigint }) {
    this.duration = duration;
  }
}
const extendInstructionSchema = new Map([
  [
    ExtendInstruction,
    {
      kind: 'struct',
      fields: [['duration', 'u64']],
    },
  ],
]);

class SlashInstruction {
  amount: bigint;
  constructor({ amount }: { amount: bigint }) {
    this.amount = amount;
  }
}
const slashInstructionSchema = new Map([
  [
    SlashInstruction,
    {
      kind: 'struct',
      fields: [['amount', 'u64']],
    },
  ],
]);

class AddFundsInstruction {
  amount: bigint;
  constructor({ amount }: { amount: bigint }) {
    this.amount = amount;
  }
}
const addFundsInstructionSchema = new Map([
  [
    AddFundsInstruction,
    {
      kind: 'struct',
      fields: [['amount', 'u64']],
    },
  ],
]);

// ----------------------------------------------------------------
// Main SolanaClient Class
// ----------------------------------------------------------------
class SolanaClient {
  private connection: Connection;
  private wallet: Keypair;
  private mint: PublicKey;
  private rewardsProgramId: PublicKey;
  private stakingProgramId: PublicKey;

  constructor(config: {
    rpcUrl: string;
    walletPath: string;
    rewardsProgramId: string;
    stakingProgramId: string;
    mint: string;
  }) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(config.walletPath, 'utf-8')))
    );
    this.mint = new PublicKey(config.mint);
    this.rewardsProgramId = new PublicKey(config.rewardsProgramId);
    this.stakingProgramId = new PublicKey(config.stakingProgramId);
  }

  // ----------------------------------------------------------------
  // PDA Helpers
  // ----------------------------------------------------------------
  private async getReflectionPda(): Promise<PublicKey> {
    const [reflection] = PublicKey.findProgramAddressSync(
      [Buffer.from('reflection')],
      this.rewardsProgramId
    );
    return reflection;
  }

  private async getRewardPda(user: PublicKey): Promise<PublicKey> {
    const [reward] = PublicKey.findProgramAddressSync(
      [Buffer.from('reward'), user.toBuffer()],
      this.rewardsProgramId
    );
    return reward;
  }

  private async getStakePda(user: PublicKey): Promise<PublicKey> {
    const [stake] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake'), this.mint.toBuffer(), user.toBuffer()],
      this.stakingProgramId
    );
    return stake;
  }

  private async getStakingVaultPda(user: PublicKey): Promise<PublicKey> {
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), this.mint.toBuffer(), user.toBuffer()],
      this.stakingProgramId
    );
    return vault;
  }

  private async getRewardsVaultPda(): Promise<PublicKey> {
    const [vault] = PublicKey.findProgramAddressSync(
      [this.mint.toBuffer()],
      this.rewardsProgramId
    );
    return vault;
  }


  // ----------------------------------------------------------------
  // Utility: Send Transaction
  // ----------------------------------------------------------------
  private async sendTransaction(instruction: TransactionInstruction) {
    const transaction = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet]
    );
    console.log('Transaction signature:', signature);
    return signature;
  }

  // ----------------------------------------------------------------
  //                        Staking Instructions
  // ----------------------------------------------------------------
  public async stake(amount: number, duration: number) {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const stakePda = await this.getStakePda(user);
    const ata = await getAssociatedTokenAddress(this.mint, user);

    console.log('Staking tokens:');
    console.log('User:', user.toBase58());
    console.log('Vault:', vault.toBase58());
    console.log('Stake:', stakePda.toBase58());
    console.log('ATA:', ata.toBase58());

    const stakeDiscriminator = Buffer.from([206, 176, 202, 18, 200, 209, 179, 108]);

    const instructionData = Buffer.concat([
      stakeDiscriminator,
      borsh.serialize(
        stakeInstructionSchema,
        new StakeInstruction({ amount: BigInt(amount), duration: BigInt(duration) })
      ),
    ]);

    const stakeIx = new TransactionInstruction({
      keys: [
        { pubkey: this.mint, isSigner: false, isWritable: false },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: instructionData,
    });

    await this.sendTransaction(stakeIx);
  }

  public async addStake(amount: number) {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const stakePda = await this.getStakePda(user);
    const ata = await getAssociatedTokenAddress(this.mint, user);

    const addStakeDiscriminator = Buffer.from([58, 135, 189, 105, 160, 120, 165, 224]);
    const instructionData = Buffer.concat([
      addStakeDiscriminator,
      borsh.serialize(
        addStakeInstructionSchema,
        new AddStakeInstruction({ amount: BigInt(amount) })
      ),
    ]);

    const addStakeIx = new TransactionInstruction({
      keys: [
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: instructionData,
    });

    await this.sendTransaction(addStakeIx);
  }

  public async extend(duration: number) {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);

    const extendDiscriminator = Buffer.from([0x45, 0x78, 0x74, 0x64, 0xab, 0xcd, 0xef, 0x01]);
    const instructionData = Buffer.concat([
      extendDiscriminator,
      borsh.serialize(
        extendInstructionSchema,
        new ExtendInstruction({ duration: BigInt(duration) })
      ),
    ]);

    const extendIx = new TransactionInstruction({
      keys: [
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: instructionData,
    });

    await this.sendTransaction(extendIx);
  }

  public async unbond() {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);
    const rewardPda = await this.getRewardPda(user);

    const unbondDiscriminator = Buffer.from([151, 129, 36, 46, 102, 195, 111, 122]);
    const unbondIx = new TransactionInstruction({
      keys: [
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: rewardPda, isSigner: false, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: true },
      ],
      programId: this.stakingProgramId,
      data: unbondDiscriminator,
    });

    await this.sendTransaction(unbondIx);
  }

  public async cancelUnbond() {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);
    const vault = await this.getStakingVaultPda(user);

    const cancelUnbondDiscriminator = Buffer.from([31, 195, 15, 13, 60, 233, 214, 208]);
    const cancelUnbondIx = new TransactionInstruction({
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: cancelUnbondDiscriminator,
    });

    await this.sendTransaction(cancelUnbondIx);
  }

  public async withdraw() {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const stakePda = await this.getStakePda(user);
    const userAta = await getAssociatedTokenAddress(this.mint, user);

    const withdrawDiscriminator = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);
    const withdrawIx = new TransactionInstruction({
      keys: [
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: withdrawDiscriminator,
    });

    await this.sendTransaction(withdrawIx);
  }

  public async closeStaking() {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);
    const vault = await this.getStakingVaultPda(user);

    const closeDiscriminator = Buffer.from([0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22]);
    const closeIx = new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: false, isWritable: true },
        { pubkey: stakePda, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.stakingProgramId,
      data: closeDiscriminator,
    });

    await this.sendTransaction(closeIx);
  }

  // ----------------------------------------------------------------
  //                        Rewards Instructions
  // ----------------------------------------------------------------
  public async enter() {
    const authority = this.wallet.publicKey;
    const reflection = await this.getReflectionPda();
    const stake = await this.getStakePda(authority);
    const reward = await this.getRewardPda(authority);

    console.log('Entering rewards program:');
    console.log('Authority:', authority.toBase58());
    console.log('Reflection:', (await reflection).toBase58());
    console.log('Stake:', (await stake).toBase58());
    console.log('Reward:', (await reward).toBase58());

    const enterDiscriminator = Buffer.from([139, 49, 209, 114, 88, 91, 77, 134]);
    const instructionData = enterDiscriminator;

    const enterInstruction = new TransactionInstruction({
      keys: [
        { pubkey: reflection, isSigner: false, isWritable: true },
        { pubkey: stake, isSigner: false, isWritable: true },
        { pubkey: reward, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.rewardsProgramId,
      data: instructionData,
    });

    await this.sendTransaction(enterInstruction);
  }

  public async claim() {
    const authority = this.wallet.publicKey;
    const stake = await this.getStakePda(authority);
    const reward = await this.getRewardPda(authority);
    const reflection = await this.getReflectionPda();
    const vault = await this.getRewardsVaultPda();
    const userAta = await getAssociatedTokenAddress(this.mint, authority);

    const claimDiscriminator = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
    const claimIx = new TransactionInstruction({
      keys: [
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: reflection, isSigner: false, isWritable: true },
        { pubkey: reward, isSigner: false, isWritable: true },
        { pubkey: stake, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.rewardsProgramId,
      data: claimDiscriminator,
    });
    await this.sendTransaction(claimIx);
  }

  public async syncReflection() {
    const user = this.wallet.publicKey;
    const reward = await this.getRewardPda(user);
    const stake = await this.getStakePda(user);
    const reflection = await this.getReflectionPda();

    const syncReflectionDiscriminator = Buffer.from([4, 219, 40, 164, 21, 157, 189, 88]);
    const syncInstruction = new TransactionInstruction({
      keys: [
        { pubkey: reward, isSigner: false, isWritable: true },
        { pubkey: stake, isSigner: false, isWritable: false },
        { pubkey: reflection, isSigner: false, isWritable: true },
      ],
      programId: this.rewardsProgramId,
      data: syncReflectionDiscriminator,
    });
    await this.sendTransaction(syncInstruction);
  }

  public async closeReward() {
    const user = this.wallet.publicKey;
    const reflection = await this.getReflectionPda();
    const reward = await this.getRewardPda(user);

    const closeDiscriminator = Buffer.from([98, 165, 201, 177, 108, 65, 206, 96]);
    const closeRewardIx = new TransactionInstruction({
      keys: [
        { pubkey: reflection, isSigner: false, isWritable: true },
        { pubkey: reward, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
      ],
      programId: this.rewardsProgramId,
      data: closeDiscriminator,
    });

    const signature = await this.sendTransaction(closeRewardIx);
    console.log('Close Reward Account Tx Signature:', signature);
    return signature;
  }

  // ----------------------------------------------------------------
  //                Query Staking, Reflection and Reward PDA's
  // ----------------------------------------------------------------
  public async queryStakingAccount() {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);

    console.log('Querying staking account:');
    console.log('User:', user.toBase58());
    console.log('Stake PDA:', stakePda.toBase58());

    const stakeAccountInfo = await this.connection.getAccountInfo(stakePda);
    if (!stakeAccountInfo) {
      console.log('Stake account not found');
      return null;
    }
    console.log('Account data length:', stakeAccountInfo.data.length);

    try {
      // Skip 8-byte anchor discriminator
      const rawData = stakeAccountInfo.data.slice(8);

      const stakeAccount = borsh.deserializeUnchecked(
        stakeAccountSchema,
        StakeAccount,
        rawData
      ) as StakeAccount;

      // Convert the authority + vault to Pubkey
      const authorityPubkey = new PublicKey(stakeAccount.authority);
      const vaultPubkey = new PublicKey(stakeAccount.vault);

      // Convert xsoar to bigint
      const xsoarBigint = this.bytesToBigInt(stakeAccount.xsoar as Uint8Array, true);

      const details = {
        amount: stakeAccount.amount.toString(),
        authority: authorityPubkey.toBase58(),
        duration: stakeAccount.duration.toString(),
        timeUnbond: stakeAccount.timeUnbond.toString(),
        vault: vaultPubkey.toBase58(),
        vaultBump: stakeAccount.vaultBump,
        xsoar: xsoarBigint.toString(),
      };
      console.log('Staking Account:', details);
      return details;
    } catch (error) {
      console.error('Deserialization error:', error);
      console.log('Raw account data:', stakeAccountInfo.data.toString('hex'));
      return null;
    }
  }

  public async queryReflectionAccount(): Promise<null | {
    rate: string;
    totalReflection: string;
    totalXsoar: string;
    vault: string;
    vaultBump: number;
  }> {
    const reflectionPda = await this.getReflectionPda();
    const accountInfo = await this.connection.getAccountInfo(reflectionPda);
    if (!accountInfo) {
      console.log('Reflection account not found.');
      return null;
    }
    console.log('Reflection account data length:', accountInfo.data.length);

    try {
      // Skip 8-byte anchor discriminator
      const rawData = accountInfo.data.slice(8);

      // Deserialize
      const reflectionAccount = borsh.deserializeUnchecked(
        reflectionAccountSchema,
        ReflectionAccount,
        rawData
      ) as ReflectionAccount;

      // Convert 16-byte fields to BigInt
      const rate = this.bytesToBigInt(reflectionAccount.rate);
      const totalReflection = this.bytesToBigInt(reflectionAccount.totalReflection);
      const totalXsoar = this.bytesToBigInt(reflectionAccount.totalXsoar);

      const vaultPubkey = new PublicKey(reflectionAccount.vault);

      const details = {
        rate: rate.toString(),
        totalReflection: totalReflection.toString(),
        totalXsoar: totalXsoar.toString(),
        vault: vaultPubkey.toBase58(),
        vaultBump: reflectionAccount.vaultBump,
      };
      console.log('Reflection Account:', details);
      return details;
    } catch (err) {
      console.error('Deserialization error:', err);
      console.log('Raw data (hex):', accountInfo.data.toString('hex'));
      return null;
    }
  }

  public async queryRewardAccount(user: PublicKey): Promise<null | {
    authority: string;       // base58 string
    bump: number;
    reflection: string;      // reflection in string form
    xsoar: string;           // xsoar in string form
  }> {
    // 1) Derive the Reward PDA
    const rewardPda = await this.getRewardPda(user);
  
    // 2) Fetch the account info
    const rewardAccountInfo = await this.connection.getAccountInfo(rewardPda);
    if (!rewardAccountInfo) {
      console.log('Reward account not found for user:', user.toBase58());
      return null;
    }
    console.log('Reward account data length:', rewardAccountInfo.data.length);
  
    try {
      // 3) Slice off the first 8 bytes for the Anchor discriminator
      const rawData = rewardAccountInfo.data.slice(8);
  
      // 4) Deserialize with Borsh
      const rewardAccount = borsh.deserializeUnchecked(
        rewardAccountSchema,
        RewardAccount,
        rawData
      ) as RewardAccount;
  
      // Convert fields
      const authorityPubkey = new PublicKey(rewardAccount.authority);
      const reflectionBigInt = this.bytesToBigInt(rewardAccount.reflection as Uint8Array, true);
      const xsoarBigInt = this.bytesToBigInt(rewardAccount.xsoar as Uint8Array, true);
  
      // 5) Return as an object
      const details = {
        authority: authorityPubkey.toBase58(),
        bump: rewardAccount.bump,
        reflection: reflectionBigInt.toString(),
        xsoar: xsoarBigInt.toString(),
      };
      console.log('Reward Account:', details);
      return details;
    } catch (err) {
      console.error('Reward account deserialization error:', err);
      console.log('Raw data (hex):', rewardAccountInfo.data.toString('hex'));
      return null;
    }
  }
  

  // ----------------------------------------------------------------
  // Helper: 16 raw bytes -> BigInt (little-endian)
  // ----------------------------------------------------------------
  private bytesToBigInt(bytes: Uint8Array, littleEndian = true): bigint {
    let hex = Buffer.from(bytes).toString('hex');
    if (littleEndian) {
      hex = hex.match(/../g)!.reverse().join('');
    }
    return BigInt(`0x${hex}`);
  }

  // ----------------------------------------------------------------
  //    Combined Instructions (Add Stake + Sync, Claim + Stake, etc.)
  // ----------------------------------------------------------------
  public async addStakeAndSync(amount: number) {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const stake = await this.getStakePda(user);
    const ata = await getAssociatedTokenAddress(this.mint, user);
    const reward = await this.getRewardPda(user);
    const reflection = await this.getReflectionPda();

    console.log('Adding stake + syncing reflection');
    console.log('User:', user.toBase58());
    console.log('Vault:', vault.toBase58());
    console.log('Stake:', stake.toBase58());
    console.log('ATA:', ata.toBase58());
    console.log('Reward:', reward.toBase58());
    console.log('Reflection:', reflection.toBase58());

    try {
      const transaction = new Transaction();

      // Add Stake
      const addStakeIx = new TransactionInstruction({
        keys: [
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: stake, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.stakingProgramId,
        data: Buffer.concat([
          Buffer.from([58, 135, 189, 105, 160, 120, 165, 224]),
          borsh.serialize(
            addStakeInstructionSchema,
            new AddStakeInstruction({ amount: BigInt(amount) })
          ),
        ]),
      });
      transaction.add(addStakeIx);

      // Sync Reflection
      const syncReflectionIx = new TransactionInstruction({
        keys: [
          { pubkey: reward, isSigner: false, isWritable: true },
          { pubkey: stake, isSigner: false, isWritable: false },
          { pubkey: reflection, isSigner: false, isWritable: true },
        ],
        programId: this.rewardsProgramId,
        data: Buffer.from([4, 219, 40, 164, 21, 157, 189, 88]),
      });
      transaction.add(syncReflectionIx);

      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Add Stake + Sync Tx Sig:', signature);
      return signature;
    } catch (error) {
      console.error('Error in addStakeAndSync:', error);
      throw error;
    }
  }

  public async stakeAndEnter(amount: number, duration: number) {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const stakePda = await this.getStakePda(user);
    const ata = await getAssociatedTokenAddress(this.mint, user);
    const reflection = await this.getReflectionPda();
    const reward = await this.getRewardPda(user);

    console.log('Staking + entering rewards:');
    console.log('User:', user.toBase58());
    console.log('Vault:', vault.toBase58());
    console.log('Stake:', stakePda.toBase58());
    console.log('ATA:', ata.toBase58());
    console.log('Reflection:', reflection.toBase58());
    console.log('Reward:', reward.toBase58());

    try {
      const transaction = new Transaction();

      // Stake
      const stakeIx = new TransactionInstruction({
        keys: [
          { pubkey: this.mint, isSigner: false, isWritable: false },
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: this.stakingProgramId,
        data: Buffer.concat([
          Buffer.from([206, 176, 202, 18, 200, 209, 179, 108]),
          borsh.serialize(
            stakeInstructionSchema,
            new StakeInstruction({ amount: BigInt(amount), duration: BigInt(duration) })
          ),
        ]),
      });
      transaction.add(stakeIx);

      // Enter
      const enterIx = new TransactionInstruction({
        keys: [
          { pubkey: reflection, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: reward, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.rewardsProgramId,
        data: Buffer.from([139, 49, 209, 114, 88, 91, 77, 134]),
      });
      transaction.add(enterIx);

      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Stake + Enter Tx Sig:', signature);
      return signature;
    } catch (error) {
      console.error('Error in stakeAndEnter:', error);
      throw error;
    }
  }

  public async claimStakeAndSync(amountToAdd: number) {
    const user = this.wallet.publicKey;
    const vault = await this.getStakingVaultPda(user);
    const rewardsVault = await this.getRewardsVaultPda();
    const stakePda = await this.getStakePda(user);
    const reflection = await this.getReflectionPda();
    const reward = await this.getRewardPda(user);
    const ata = await getAssociatedTokenAddress(this.mint, user);

    console.log('Claiming + adding stake + syncing reflection:');
    console.log('User:', user.toBase58());
    console.log('Vault:', vault.toBase58());
    console.log('Stake:', stakePda.toBase58());
    console.log('Reflection:', reflection.toBase58());
    console.log('Reward:', reward.toBase58());
    console.log('ATA:', ata.toBase58());

    try {
      const transaction = new Transaction();

      // 1) Claim
      const claimDiscriminator = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
      const claimIx = new TransactionInstruction({
        keys: [
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: rewardsVault, isSigner: false, isWritable: true },
          { pubkey: reflection, isSigner: false, isWritable: true },
          { pubkey: reward, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: false },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.rewardsProgramId,
        data: claimDiscriminator,
      });
      transaction.add(claimIx);

      // 2) Add Stake
      const addStakeIx = new TransactionInstruction({
        keys: [
          { pubkey: ata, isSigner: false, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: this.stakingProgramId,
        data: Buffer.concat([
          Buffer.from([58, 135, 189, 105, 160, 120, 165, 224]),
          borsh.serialize(
            addStakeInstructionSchema,
            new AddStakeInstruction({ amount: BigInt(amountToAdd) })
          ),
        ]),
      });
      transaction.add(addStakeIx);

      // 3) Sync Reflection
      const syncReflectionIx = new TransactionInstruction({
        keys: [
          { pubkey: reward, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: false },
          { pubkey: reflection, isSigner: false, isWritable: true },
        ],
        programId: this.rewardsProgramId,
        data: Buffer.from([4, 219, 40, 164, 21, 157, 189, 88]),
      });
      transaction.add(syncReflectionIx);

      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Claim + Add Stake + Sync Tx Sig:', signature);
      return signature;
    } catch (error) {
      console.error('Error in claimStakeAndSync:', error);
      throw error;
    }
  }

  public async unbondWithCloseReward() {
    const user = this.wallet.publicKey;
    const stake = await this.getStakePda(user);
    const reward = await this.getRewardPda(user);
    const reflection = await this.getReflectionPda();

    console.log('Preparing to unbond + possibly close reward:');
    console.log('User:', user.toBase58());
    console.log('Stake:', stake.toBase58());
    console.log('Reward:', reward.toBase58());
    console.log('Reflection:', reflection.toBase58());

    try {
      const rewardAccountInfo = await this.connection.getAccountInfo(reward);
      const transaction = new Transaction();

      // If reward account exists, close it first
      if (rewardAccountInfo !== null) {
        console.log('Reward account exists. Closing it before unbonding.');
        const closeRewardIx = new TransactionInstruction({
          keys: [
            { pubkey: reflection, isSigner: false, isWritable: true },
            { pubkey: reward, isSigner: false, isWritable: true },
            { pubkey: user, isSigner: true, isWritable: false },
          ],
          programId: this.rewardsProgramId,
          data: Buffer.from([98, 165, 201, 177, 108, 65, 206, 96]),
        });
        transaction.add(closeRewardIx);
      }

      // Then unbond
      const unbondIx = new TransactionInstruction({
        keys: [
          { pubkey: stake, isSigner: false, isWritable: true },
          { pubkey: reward, isSigner: false, isWritable: false },
          { pubkey: user, isSigner: true, isWritable: true },
        ],
        programId: this.stakingProgramId,
        data: Buffer.from([151, 129, 36, 46, 102, 195, 111, 122]),
      });
      transaction.add(unbondIx);

      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Unbond + Close Reward Tx Sig:', signature);
      return signature;
    } catch (error) {
      console.error('Error in unbondWithCloseReward:', error);
      throw error;
    }
  }

  public async cancelUnbondWithRewardEnter() {
    const user = this.wallet.publicKey;
    const stakePda = await this.getStakePda(user);
    const vault = await this.getStakingVaultPda(user);
    const reflection = await this.getReflectionPda();
    const reward = await this.getRewardPda(user);

    console.log('Cancel unbond + enter rewards:');
    console.log('User:', user.toBase58());
    console.log('Stake:', stakePda.toBase58());
    console.log('Vault:', vault.toBase58());
    console.log('Reflection:', reflection.toBase58());
    console.log('Reward:', reward.toBase58());

    try {
      const transaction = new Transaction();

      // 1) Cancel Unbond
      const cancelUnbondDiscriminator = Buffer.from([31, 195, 15, 13, 60, 233, 214, 208]);
      const cancelUnbondIx = new TransactionInstruction({
        keys: [
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: false },
        ],
        programId: this.stakingProgramId,
        data: cancelUnbondDiscriminator,
      });
      transaction.add(cancelUnbondIx);

      // 2) Enter Rewards
      const enterIx = new TransactionInstruction({
        keys: [
          { pubkey: reflection, isSigner: false, isWritable: true },
          { pubkey: stakePda, isSigner: false, isWritable: true },
          { pubkey: reward, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.rewardsProgramId,
        data: Buffer.from([139, 49, 209, 114, 88, 91, 77, 134]),
      });
      transaction.add(enterIx);

      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      console.log('Cancel Unbond + Enter Rewards Tx Sig:', signature);
      return signature;
    } catch (error) {
      console.error('Error in cancelUnbondWithRewardEnter:', error);
      throw error;
    }
  }




// ----------------------------------------------------------------
// 1) getClaimableAmount
//    Compute user's claimable amount in SOAR
// ----------------------------------------------------------------


public async getClaimableAmount(): Promise<number> {
  if (!this.wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const user = this.wallet.publicKey;
  // reflection account
  const reflectionData = await this.queryReflectionAccount();
  if (!reflectionData) {
    return 0;
  }

  // reward account
  const rewardData = await this.queryRewardAccount(user);
  if (!rewardData) {
    return 0;
  }

  const rate = BigInt(reflectionData.rate);
  const userReflection = BigInt(rewardData.reflection);
  const userXsoar = BigInt(rewardData.xsoar);

  const userXsoarEquivalent = userReflection / rate;
  let claimable = userXsoarEquivalent - userXsoar;
  if (claimable <= 0n) {
    return 0;
  }

  // Convert to Soar (6 decimals)
  const decimals = 6;
  return Number(claimable) / 10 ** decimals;
}

// ----------------------------------------------------------------
// 2) computeDailyInflowXsoar
//    Suppose you have a desired APR in [0..100], generate daily inflow
// ----------------------------------------------------------------
public async computeDailyInflowXsoar(totalXsoar: bigint, desiredAprPercent: number): Promise<bigint> {
  if (desiredAprPercent <= 0 || desiredAprPercent > 100) {
    throw new Error("Invalid APR value. Must be between 0 and 100.");
  }
  // annualRewardXsoar = totalXsoar * (APR/100)
  const annualRewardXsoar = (totalXsoar * BigInt(desiredAprPercent)) / 100n;
  // daily = annual / 365
  return annualRewardXsoar / 365n;
}

// ----------------------------------------------------------------
// 3) calculateXsoar
//    On-chain formula for xSOAR from stake + duration
// ----------------------------------------------------------------
public async calculateXsoar(amount: number | bigint, durationDays: number): Promise<bigint> {
  if (durationDays < 14 || durationDays > 365) {
    throw new Error("Duration out of range. Must be 14..365 days.");
  }
  const durationSeconds = BigInt(durationDays * SECONDS_PER_DAY);
  const amountBig = BigInt(amount);

  // durationMultiplier = (durationSeconds * XSOAR_PRECISION) / XSOAR_DIV
  const durationMultiplier = (durationSeconds * XSOAR_PRECISION) / XSOAR_DIV;
  const adjustedMultiplier = durationMultiplier + XSOAR_PRECISION; // base + bonus

  // final xsoar = (adjustedMultiplier * amount) / XSOAR_PRECISION
  return (adjustedMultiplier * amountBig) / XSOAR_PRECISION;
}

// ----------------------------------------------------------------
// 4) calculateDailyReward
//    userDailyReward = userShare * dailyInflow
//    where userShare = userXsoar / totalXsoar
// ----------------------------------------------------------------
public async calculateDailyReward(
  userXsoar: bigint,
  totalXsoar: bigint,
  dailyInflowXsoar: bigint
): Promise<number> {
  if (totalXsoar <= 0n || userXsoar <= 0n || dailyInflowXsoar <= 0n) {
    return 0;
  }
  const userShare = Number(userXsoar) / Number(totalXsoar);
  const userDailyXsoar = userShare * Number(dailyInflowXsoar);
  return userDailyXsoar;
}

// ----------------------------------------------------------------
// 5) calculateUserApy
//    APY = (dailyReward / amountInSoar) * 365 * 100
// ----------------------------------------------------------------
public async calculateUserApy(dailyReward: number, amountInSoar: number): Promise<string> {
  if (amountInSoar <= 0 || dailyReward <= 0) {
    return "0.00%";
  }
  const apy = (dailyReward / amountInSoar) * 365 * 100;
  return `${apy.toFixed(2)}%`;
}

// ----------------------------------------------------------------
// 6) getDailyRewardAndApy
// ----------------------------------------------------------------
/**
 * Compute user’s daily reward + APY from the reflection's totalXsoar + user’s xsoar.
 * @param amount - user’s staked amount in smallest units
 * @param durationDays - user’s chosen staking duration
 * @param desiredAprPercent - e.g., 35
 * @returns Promise<{ userDailyReward: number; userApy: string }>
 */
public async getDailyRewardAndApy(
  amount: number,
  durationDays: number,
  desiredAprPercent = 35
): Promise<{ userDailyReward: number; userApy: string }> {
  // 1) Query reflection (Borsh-based) to get totalXsoar
  const reflectionData = await this.queryReflectionAccount();
  if (!reflectionData) {
    throw new Error("No reflection account found.");
  }
  const totalXsoar = BigInt(reflectionData.totalXsoar);

  if (totalXsoar <= 0n) {
    throw new Error("Invalid total xSOAR from reflection account.");
  }

  // 2) Compute daily inflow based on desired APR
  const dailyInflowXsoar = await this.computeDailyInflowXsoar(totalXsoar, desiredAprPercent);

  // 3) Calculate user’s xSOAR from amount + duration
  const userXsoar = await this.calculateXsoar(amount, durationDays);

  // 4) Calculate user’s daily reward (in xSOAR units)
  const userDailyXsoar = await this.calculateDailyReward(userXsoar, totalXsoar, dailyInflowXsoar);

  // 5) Convert userDailyXsoar from raw to "SOAR" if your token has 6 decimals
  const decimals = 6; 
  const userDailyRewardInSoar = userDailyXsoar / 10 ** decimals;

  // 6) APY = (dailyRewardInSoar / userAmountInSoar) * 365 * 100
  const userAmountInSoar = amount / 10 ** decimals;
  const userApy = await this.calculateUserApy(userDailyRewardInSoar, userAmountInSoar);

  console.log("User Daily Reward:", userDailyRewardInSoar);
  console.log("User APY:", userApy);

  return {
    userDailyReward: userDailyXsoar,  // or userDailyRewardInSoar, up to you
    userApy,
  };
}

// ----------------------------------------------------------------
// 7) fetchStakingSummary
//    Example: call your REST endpoint for aggregated staking stats
// ----------------------------------------------------------------
public async fetchStakingSummary(): Promise<{
  totalStaked: number;
  totalStakers: number;
}> {
  try {
    const response = await fetch("https://api.view.soarchain.com/staking-summary");
    if (!response.ok) {
      throw new Error(`Error fetching staking summary: ${response.statusText}`);
    }
    const data: { total_staked: number; total_stakers: number; } = await response.json() as { total_staked: number; total_stakers: number; };
    return {
      totalStaked: data.total_staked,
      totalStakers: data.total_stakers,
    };
  } catch (error) {
    console.error("Error fetching staking summary:", error);
    throw error;
  }
}
}

// ----------------------------------------------------------------
// Example usage
// ----------------------------------------------------------------
(async () => {
  // Load config.json

// Define the configuration when initilazing the client
const config = {
  "rpcUrl": "https://api.devnet.solana.com",
  "walletPath": "/home/alp/.config/solana/id.json",
  "rewardsProgramId": "5WrZKawc9oMr59cwG6SaBsnbGe8eXmhCiZCFNL4CbVqs",
  "stakingProgramId": "2eSBhDe7FGLUJ3BgEV2ZWqAhJ8kb8u9NCiEYjoeAQDdR",
  "mint": "6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP"
}

  // Initialize client
  const client = new SolanaClient(config);

  // Uncomment or add your calls:
  // await client.stake(1000, 1209600);
  // await client.addStake(500);
  // await client.unbond();
  // await client.cancelUnbond();
  // await client.extend(3600);
  // await client.withdraw();
  // await client.closeStaking();
  // await client.enter();
  // await client.syncReflection();
  // await client.claim();
  // await client.closeReward();
  // await client.stakeAndEnter(1000, 1209600);
  // await client.addStakeAndSync(500);
  // await client.claimStakeAndSync(300);
  // await client.unbondWithCloseReward();
  // await client.cancelUnbondWithRewardEnter();

  // Query accounts
  //const stakeData = await client.queryStakingAccount();
  //const reflectionData = await client.queryReflectionAccount();
  //console.log('Final Stake Data:', stakeData);
  //console.log('Final Reflection Data:', reflectionData);
  const num = await client.getClaimableAmount();
  console.log(num);
  const apr = await client.getDailyRewardAndApy(1000, 15, 35);
  console.log(apr);
  const stakingSummary = await client.fetchStakingSummary();
  console.log('Staking Summary:', stakingSummary);

  const xsoar = await client.calculateXsoar(1000000, 15);
  console.log(xsoar);
})();

