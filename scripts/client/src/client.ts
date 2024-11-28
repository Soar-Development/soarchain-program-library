import {
    AnchorProvider,
    Idl,
    Program,
    setProvider,
    web3,
    Wallet,
    BN,
  } from '@coral-xyz/anchor';
  import { PublicKey, Keypair } from '@solana/web3.js';
  import * as fs from 'fs';
  import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes/index.js';
  // @ts-ignore
  import { SoachainRewards } from '../target/types/soachain_rewards';
  // @ts-ignore
  import { SoachainStaking } from '../target/types/soachain_staking';
  import { getAssociatedTokenAddress } from '@solana/spl-token';
  
  class SolanaClient {
    private provider: AnchorProvider;
    private rewardsProgram: Program<SoachainRewards>;
    private stakingProgram: Program<SoachainStaking>;
    private wallet: Wallet;
    private mint: PublicKey;
  
    constructor(walletPath: string) {
      // Load wallet keypair
      const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
      );
      this.wallet = new Wallet(walletKeypair);
  
      // Set up the provider
      const rpcUrl =
        process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
      const connection = new web3.Connection(rpcUrl, 'confirmed');
      this.provider = new AnchorProvider(connection, this.wallet, {
        preflightCommitment: 'confirmed',
      });
      setProvider(this.provider);
  
      // Initialize mint
      this.mint = new PublicKey(
        '413HxKyXfZhYscc5Bq7nHoWPc28ZMV7HXMSSuEVX1TB6'
      );
    }
  
    public async init() {
      await this.loadPrograms();
    }
  
    private async loadPrograms() {
      const rewardsProgramId = new PublicKey(
        'GZ4oyosaMgWF92RtNhm9d2226WUna2chSJ6qDuniRiFd'
      );
      const stakingProgramId = new PublicKey(
        'HjmYWcRm6At1ptF5MuxSqaC9EKZwnA7bbLYviQfDhWCK'
      );
  
      const rewardsIdl = (await Program.fetchIdl(
        rewardsProgramId,
        this.provider
      )) as Idl;
      const stakingIdl = (await Program.fetchIdl(
        stakingProgramId,
        this.provider
      )) as Idl;
  
      this.rewardsProgram = new Program(
        rewardsIdl,
        rewardsProgramId,
        this.provider
      ) as unknown as Program<SoachainRewards>;
      this.stakingProgram = new Program(
        stakingIdl,
        stakingProgramId,
        this.provider
      ) as unknown as Program<SoachainStaking>;
    }
  
    // Helper methods for PDAs
    private getReflectionPda(): PublicKey {
      const [reflection] = PublicKey.findProgramAddressSync(
        [utf8.encode('reflection')],
        this.rewardsProgram.programId
      );
      return reflection;
    }
  
    private getRewardPda(user: PublicKey): PublicKey {
      const [reward] = PublicKey.findProgramAddressSync(
        [utf8.encode('reward'), user.toBuffer()],
        this.rewardsProgram.programId
      );
      return reward;
    }
  
    private getStakePda(user: PublicKey): PublicKey {
      const [stake] = PublicKey.findProgramAddressSync(
        [utf8.encode('stake'), this.mint.toBuffer(), user.toBuffer()],
        this.stakingProgram.programId
      );
      return stake;
    }
  
    private getStakingVaultPda(user: PublicKey): PublicKey {
      const [vault] = PublicKey.findProgramAddressSync(
        [utf8.encode('vault'), this.mint.toBuffer(), user.toBuffer()],
        this.stakingProgram.programId
      );
      return vault;
    }
  
    private getRewardsVaultPda(): PublicKey {
      const [vault] = PublicKey.findProgramAddressSync(
        [utf8.encode('vault'), this.mint.toBuffer()],
        this.rewardsProgram.programId
      );
      return vault;
    }
    private getStakingStakePda(user: PublicKey): PublicKey {
        const [stake] = PublicKey.findProgramAddressSync(
          [utf8.encode('stake'), this.mint.toBuffer(), user.toBuffer()],
          this.stakingProgram.programId
        );
        return stake;
      }

      public async stake(amount: number, duration: number) {
        const user = this.wallet.publicKey;
        const vault = this.getStakingVaultPda(user);
        const stake = this.getStakingStakePda(user);
        const ata = await getAssociatedTokenAddress(this.mint, user);
    
        console.log('Staking tokens:');
        console.log('User:', user.toBase58());
        console.log('Vault:', vault.toBase58());
        console.log('Stake:', stake.toBase58());
        console.log('ATA:', ata.toBase58());
    
        const tx = await this.stakingProgram.methods
          .stake(new BN(amount), new BN(duration))
          .accounts({
            mint: this.mint,
            user: ata,
            vault,
            stake,
            authority: user,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
    
        console.log(`Transaction signature: ${tx}`);
      }    
  
    public async claimRewards() {
      const user = this.wallet.publicKey;
      const reflection = this.getReflectionPda();
      const reward = this.getRewardPda(user);
      const stake = this.getStakePda(user);
      const vault = this.getRewardsVaultPda();
  
      console.log('Claiming rewards for user:', user.toBase58());
      console.log('Reflection account:', reflection.toBase58());
      console.log('Reward account:', reward.toBase58());
      console.log('Stake account:', stake.toBase58());
      const ata = await getAssociatedTokenAddress(this.mint, user);

      const tx = await this.rewardsProgram.methods
        .claim()
        .accounts({
          user: ata,
          vault,
          reflection,
          reward,
          stake,
          mint: this.mint,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async syncReflection() {
      const user = this.wallet.publicKey;
      const reward = this.getRewardPda(user);
      const stake = this.getStakePda(user);
      const reflection = this.getReflectionPda();
  
      const tx = await this.rewardsProgram.methods
        .sync()
        .accounts({
          reward,
          stake,
          reflection,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async addStake(amount: number) {
      const user = this.wallet.publicKey;
      const vault = this.getStakingVaultPda(user);
      const stake = this.getStakePda(user);
      const ata = await getAssociatedTokenAddress(this.mint, user);
  
      const tx = await this.stakingProgram.methods
        .addStake(new BN(amount))
        .accounts({
          user: ata,
          vault,
          stake,
          authority: user,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async withdraw() {
      const user = this.wallet.publicKey;
      const vault = this.getStakingVaultPda(user);
      const stake = this.getStakePda(user);
      const ata = await getAssociatedTokenAddress(this.mint, user);
  
      const tx = await this.stakingProgram.methods
        .withdraw()
        .accounts({
          user: ata,
          vault,
          stake,
          authority: user,
          mint: this.mint,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async unbond() {
      const user = this.wallet.publicKey;
      const stake = this.getStakePda(user);
      const reward = this.getRewardPda(user);
  
      const tx = await this.stakingProgram.methods
        .unbond()
        .accounts({
          stake,
          reward,
          authority: user,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async cancelUnbond() {
      const user = this.wallet.publicKey;
      const vault = this.getStakingVaultPda(user);
      const stake = this.getStakePda(user);
  
      const tx = await this.stakingProgram.methods
        .cancelUnbond()
        .accounts({
          vault,
          stake,
          authority: user,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }
  
    public async extend(duration: number) {
      const user = this.wallet.publicKey;
      const stake = this.getStakePda(user);
  
      const tx = await this.stakingProgram.methods
        .extend(new BN(duration))
        .accounts({
          stake,
          authority: user,
        })
        .rpc();
  
      console.log(`Transaction signature: ${tx}`);
    }

    public async enter() {
        const authority = this.wallet.publicKey;
        const reflection = this.getReflectionPda();
        const stake = this.getStakingStakePda(authority); // Stake PDA from staking program
        const reward = this.getRewardPda(authority);
    
        console.log('Entering rewards program:');
        console.log('Authority:', authority.toBase58());
        console.log('Reflection:', reflection.toBase58());
        console.log('Stake:', stake.toBase58());
        console.log('Reward:', reward.toBase58());
    
        const tx = await this.rewardsProgram.methods
          .enter()
          .accounts({
            reflection,
            stake,
            reward,
            authority,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
    
        console.log(`Transaction signature: ${tx}`);
      }
  }

  
  
  // Usage example
  (async () => {
    const walletPath = '/home/alp/.config/solana/id.json';
    const client = new SolanaClient(walletPath);
    await client.init();
  
    //await client.stake(1000, 1209600); // Amount and duration
    console.log('Staked tokens');

    await client.enter();
    console.log('Entered rewards program');
  
    // Uncomment other methods as needed
    // await client.syncReflection();
    // console.log('Synced reflection');
    // await client.addStake(1000);
    // console.log('Added stake');
    // await client.withdraw();
    // console.log('Withdrawn');
    // await client.unbond();
    // console.log('Unbonded');
    // await client.cancelUnbond();
    // console.log('Cancelled unbond');
    // await client.extend(3600);
    // console.log('Extended stake');
  })().catch(console.error);
  