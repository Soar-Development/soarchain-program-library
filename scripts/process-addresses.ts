import * as fs from 'fs';
import * as path from 'path';

interface StakeAccount {
  publicKey: string;
  amount: string;
  authority: string;
  duration: string;
  timeUnbond: string;
  vault: string;
  vaultBump: number;
  xsoar: string;
}

interface AstirData {
  [key: string]: number | string;
  xsoar?: string;
  mini?: string;
}

interface ReputationResponse {
  reputation?: {
    pubKey: string;
    address: string;
    solAddress: string;
    score: string;
    rewardMultiplier: string;
    netEarnings: string;
    lastTimeChallenged: string;
    coolDownTolerance: string;
    type: string;
    stakedAmount: string;
    dprEarnings: string;
    earningsHistory: Array<{
      day: number;
      totalEarnings: string;
    }>;
  };
  code?: number;
  message?: string;
  details?: any[];
}

interface ProcessedResult {
  solanaAddress: string;
  astirAddress?: string;
  mini: boolean;
  hasStakeAccount: boolean;
  xsoarAmount?: string;
  reputationData?: ReputationResponse;
}

class AddressProcessor {
  private stakeAccounts: StakeAccount[] = [];
  private astirData: AstirData = {};
  private results: ProcessedResult[] = [];

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    try {
      // Load stake accounts
      const stakeAccountsPath = path.join(__dirname, '..', 'stakeAccounts.json');
      const stakeAccountsData = fs.readFileSync(stakeAccountsPath, 'utf8');
      this.stakeAccounts = JSON.parse(stakeAccountsData);

      // Load astir data
      const astirPath = path.join(__dirname, '..', 'astir-airdeop.json');
      const astirData = fs.readFileSync(astirPath, 'utf8');
      this.astirData = JSON.parse(astirData);

      console.log(`Loaded ${this.stakeAccounts.length} stake accounts`);
      console.log(`Loaded astir data with ${Object.keys(this.astirData).length - 2} addresses`); // -2 for xsoar and mini fields
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  private async checkReputation(solanaAddress: string): Promise<ReputationResponse> {
    try {
      const url = `https://rpc2.mainnet.soarchain.com/api/soarchain/poa/reputation/get_reputation_by_SolanaAddress/${solanaAddress}`;
      
      const response = await fetch(url);
      const data: ReputationResponse = await response.json();
      
      return data;
    } catch (error) {
      console.error(`Error checking reputation for ${solanaAddress}:`, error);
      return {
        code: 5,
        message: "Network error occurred",
        details: []
      };
    }
  }

  private findAddressesWith03SOAR(): string[] {
    // Find addresses that sent 0.3 SOAR tokens to the addresses in astir data
    // We need to look at stake accounts to find the authority (sender) addresses
    // that correspond to the recipients in astir data
    
    const addresses: string[] = [];
    const astirRecipients = new Set<string>();
    
    // Get all recipient addresses from astir data
    for (const [key, value] of Object.entries(this.astirData)) {
      if (key !== 'xsoar' && key !== 'mini' && typeof value === 'number') {
        astirRecipients.add(key);
      }
    }
    
    // Find stake accounts where the publicKey (recipient) is in astir data
    // The authority field contains the sender address
    for (const stakeAccount of this.stakeAccounts) {
      if (astirRecipients.has(stakeAccount.publicKey)) {
        addresses.push(stakeAccount.authority);
      }
    }
    
    console.log(`Found ${addresses.length} sender addresses that sent 0.3 SOAR to astir recipients`);
    return addresses;
  }

  private checkStakeAccount(solanaAddress: string): { hasStake: boolean; xsoarAmount?: string } {
    // Check if the address has a stake account in the JSON data
    const stakeAccount = this.stakeAccounts.find(account => account.authority === solanaAddress);
    
    if (stakeAccount) {
      return {
        hasStake: true,
        xsoarAmount: stakeAccount.xsoar
      };
    }
    
    return { hasStake: false };
  }

  private async processAddress(solanaAddress: string): Promise<ProcessedResult> {
    console.log(`Processing address: ${solanaAddress}`);
    
    // Check reputation
    const reputationData = await this.checkReputation(solanaAddress);
    
    // Determine mini status
    const mini = reputationData.reputation ? true : false;
    
    // Check stake account
    const stakeInfo = this.checkStakeAccount(solanaAddress);
    
    const result: ProcessedResult = {
      solanaAddress,
      mini,
      hasStakeAccount: stakeInfo.hasStake,
      xsoarAmount: stakeInfo.xsoarAmount,
      reputationData
    };

    // Add astir address if available (this would need to be mapped from reputation data)
    if (reputationData.reputation?.address) {
      result.astirAddress = reputationData.reputation.address;
    }

    return result;
  }

  public async processAllAddresses(): Promise<ProcessedResult[]> {
    console.log('Starting address processing...');
    
    const addressesToProcess = this.findAddressesWith03SOAR();
    console.log(`Found ${addressesToProcess.length} addresses to process`);
    
    // Process addresses with rate limiting to avoid overwhelming the API
    const batchSize = 5;
    const delay = 1000; // 1 second delay between batches
    
    for (let i = 0; i < addressesToProcess.length; i += batchSize) {
      const batch = addressesToProcess.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addressesToProcess.length / batchSize)}`);
      
      const batchPromises = batch.map(address => this.processAddress(address));
      const batchResults = await Promise.all(batchPromises);
      
      this.results.push(...batchResults);
      
      // Add delay between batches to be respectful to the API
      if (i + batchSize < addressesToProcess.length) {
        console.log(`Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return this.results;
  }

  public generateReport(): void {
    console.log('\n=== PROCESSING REPORT ===');
    console.log(`Total addresses processed: ${this.results.length}`);
    
    const miniCount = this.results.filter(r => r.mini).length;
    const stakeCount = this.results.filter(r => r.hasStakeAccount).length;
    
    console.log(`Addresses with mini status: ${miniCount}`);
    console.log(`Addresses with stake accounts: ${stakeCount}`);
    
    console.log('\n=== DETAILED RESULTS ===');
    this.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.solanaAddress}`);
      console.log(`   Mini: ${result.mini}`);
      console.log(`   Has Stake Account: ${result.hasStakeAccount}`);
      if (result.xsoarAmount) {
        console.log(`   xSOAR Amount: ${result.xsoarAmount}`);
      }
      if (result.astirAddress) {
        console.log(`   Astir Address: ${result.astirAddress}`);
      }
    });
  }

  public saveResults(filename: string = 'processed-addresses.json'): void {
    const outputPath = path.join(__dirname, filename);
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  }

  public generateSummaryReport(): void {
    const summary = {
      totalProcessed: this.results.length,
      miniStatus: {
        true: this.results.filter(r => r.mini).length,
        false: this.results.filter(r => !r.mini).length
      },
      stakeAccounts: {
        withStake: this.results.filter(r => r.hasStakeAccount).length,
        withoutStake: this.results.filter(r => !r.hasStakeAccount).length
      },
      totalXSOAR: this.results
        .filter(r => r.xsoarAmount)
        .reduce((sum, r) => sum + BigInt(r.xsoarAmount || '0'), BigInt(0))
        .toString(),
      results: this.results
    };

    const summaryPath = path.join(__dirname, 'address-processing-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Summary report saved to: ${summaryPath}`);
  }
}

// Main execution
async function main() {
  try {
    const processor = new AddressProcessor();
    
    console.log('Starting address processing...');
    await processor.processAllAddresses();
    
    processor.generateReport();
    processor.saveResults();
    processor.generateSummaryReport();
    
    console.log('\nProcessing completed successfully!');
  } catch (error) {
    console.error('Error during processing:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { AddressProcessor, ProcessedResult, ReputationResponse };
