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

interface MatchedResult {
  solanaAddress: string;
  xsoarAmount: string;
  hasStakeAccount: boolean;
}

async function matchStakingWithAddresses() {
  try {
    // Load data
    const stakeAccountsPath = path.join(__dirname, '..', 'stakeAccounts.json');
    const astirPath = path.join(__dirname, '..', 'astir-airdeop.json');
    
    const stakeAccounts: StakeAccount[] = JSON.parse(fs.readFileSync(stakeAccountsPath, 'utf8'));
    const astirData: AstirData = JSON.parse(fs.readFileSync(astirPath, 'utf8'));
    
    console.log(`Loaded ${stakeAccounts.length} stake accounts`);
    console.log(`Loaded astir data with ${Object.keys(astirData).length - 2} addresses`);
    
    const results: MatchedResult[] = [];
    
    // Process each address from astir data
    for (const [address, amount] of Object.entries(astirData)) {
      if (address === 'xsoar' || address === 'mini') continue;
      
      // Find stake account for this address
      const stakeAccount = stakeAccounts.find(account => account.authority === address);
      
      const result: MatchedResult = {
        solanaAddress: address,
        xsoarAmount: stakeAccount ? stakeAccount.xsoar : '0',
        hasStakeAccount: !!stakeAccount
      };
      
      results.push(result);
    }
    
    // Save results
    const outputPath = path.join(__dirname, 'matched-staking.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\nResults saved to: ${outputPath}`);
    console.log(`Processed ${results.length} addresses`);
    console.log(`Found stake accounts for ${results.filter(r => r.hasStakeAccount).length} addresses`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

matchStakingWithAddresses();


