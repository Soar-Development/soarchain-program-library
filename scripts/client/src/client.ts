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
  interface SolanaClientConfig {
    rpcUrl: string;
    walletPath: string;
    rewardsProgramId: string;
    stakingProgramId: string;
    mint: string;
  }
  
  class SolanaClient {
    private provider: AnchorProvider;
    private rewardsProgram: Program<SoachainRewards>;
    private stakingProgram: Program<SoachainStaking>;
    private wallet: Wallet;
    private mint: PublicKey;
    private rewardsProgramId: PublicKey;
    private stakingProgramId: PublicKey;
  
    constructor(config: SolanaClientConfig) {
      // Load wallet keypair
      const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(config.walletPath, 'utf-8')))
      );
      this.wallet = new Wallet(walletKeypair);
  
      // Set up the provider
      const rpcUrl = config.rpcUrl;
      const connection = new web3.Connection(rpcUrl, 'confirmed');
      this.provider = new AnchorProvider(connection, this.wallet, {
        preflightCommitment: 'confirmed',
      });
      setProvider(this.provider);
  
      // Initialize mint and program IDs from config
      this.mint = new PublicKey(config.mint);
      this.rewardsProgramId = new PublicKey(config.rewardsProgramId);
      this.stakingProgramId = new PublicKey(config.stakingProgramId);
    }
  
    public async init() {
      await this.loadPrograms();
    }
  
    private async loadPrograms() {
      const rewardsIdl = (await Program.fetchIdl(
        this.rewardsProgramId,
        this.provider
      )) as Idl;
      const stakingIdl = (await Program.fetchIdl(
        this.stakingProgramId,
        this.provider
      )) as Idl;
  
      this.rewardsProgram = new Program(
        rewardsIdl,
        this.rewardsProgramId,
        this.provider
      ) as unknown as Program<SoachainRewards>;
      this.stakingProgram = new Program(
        stakingIdl,
        this.stakingProgramId,
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
  
        console.log('stake:', stake.toBase58());
        console.log('reward:', reward.toBase58());
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


      public async withdrawAndClose() {
        if (!this.wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
      
        // Derive PDAs and addresses
        const user = this.wallet.publicKey;
        const vault = this.getStakingVaultPda(user);
        const stake = this.getStakePda(user);
        const ata = await getAssociatedTokenAddress(this.mint, user);
      
        console.log('Withdraw and Close:');
        console.log('User:', user.toBase58());
        console.log('Vault:', vault.toBase58());
        console.log('Stake:', stake.toBase58());
        console.log('ATA:', ata.toBase58());
      
        try {
    
      
          // 2) Close
          const txClose = await this.stakingProgram.methods
            .close()
            .accounts({
              user: ata,
              stake,
              vault,
              authority: user,
            })
            .rpc();
      
          console.log(`Close Transaction signature: ${txClose}`);
      
          // Return both transaction signatures
          return {  txClose };
        } catch (error) {
          console.error('Error in withdrawAndClose:', error);
          throw error;
        }
      }
  }

  
  
  // Usage example
  (async () => {
      // Load configuration
    const configData = fs.readFileSync('/home/alp/soarchain-program-library/scripts/client/src/config.json', 'utf-8');
    const config = JSON.parse(configData);
    const client = new SolanaClient(config);
    await client.init();
  
    //await client.stake(1000, 1209600); // Amount and duration
    //console.log('Staked tokens');
    //client.addStake(1000);
    // client.syncReflection();
    
    //client.cancelUnbond();
    //await client.enter();
    //console.log('Entered rewards program');
    //client.enter();
    //await client.withdrawAndClose();
    //client.claimRewards();
  
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
  
