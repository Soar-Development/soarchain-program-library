import * as fs from 'fs';
import * as path from 'path';

interface AddressData {
  amount: number;
  xsoar: string;
  mini: string;
}

interface AstirData {
  [key: string]: AddressData;
}

function analyzeXSOAR() {
  try {
    // Load the refactored JSON
    const astirPath = path.join(__dirname, '..', 'astir-airdrop.json');
    const astirData: AstirData = JSON.parse(fs.readFileSync(astirPath, 'utf8'));
    
    console.log('🔍 Analyzing xSOAR amounts...\n');
    
    // Extract xSOAR amounts and convert to numbers
    const xsoarAmounts: { address: string; xsoar: bigint; original: string }[] = [];
    
    for (const [address, data] of Object.entries(astirData)) {
      const xsoarStr = data.xsoar;
      if (xsoarStr && xsoarStr !== '') {
        const xsoarBigInt = BigInt(xsoarStr);
        xsoarAmounts.push({
          address,
          xsoar: xsoarBigInt,
          original: xsoarStr
        });
      }
    }
    
    console.log(`📊 Found ${xsoarAmounts.length} addresses with xSOAR amounts`);
    console.log(`📊 Total addresses in data: ${Object.keys(astirData).length}\n`);
    
    if (xsoarAmounts.length === 0) {
      console.log('❌ No xSOAR amounts found!');
      return;
    }
    
    // Sort by xSOAR amount (descending)
    xsoarAmounts.sort((a, b) => {
      if (a.xsoar > b.xsoar) return -1;
      if (a.xsoar < b.xsoar) return 1;
      return 0;
    });
    
    // Find maximum
    const maxXSOAR = xsoarAmounts[0];
    console.log('🏆 MAXIMUM xSOAR:');
    console.log(`   Address: ${maxXSOAR.address}`);
    console.log(`   xSOAR Amount: ${maxXSOAR.original}`);
    console.log(`   Amount (readable): ${formatNumber(maxXSOAR.original)}\n`);
    
    // Calculate median
    const sortedAmounts = xsoarAmounts.map(item => item.xsoar);
    const median = calculateMedian(sortedAmounts);
    
    console.log('📈 MEDIAN xSOAR:');
    console.log(`   Median: ${median.toString()}`);
    console.log(`   Median (readable): ${formatNumber(median.toString())}\n`);
    
    // Show top 5
    console.log('🥇 TOP 5 xSOAR HOLDERS:');
    xsoarAmounts.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.address}: ${formatNumber(item.original)}`);
    });
    
    // Show statistics
    const totalXSOAR = xsoarAmounts.reduce((sum, item) => sum + item.xsoar, BigInt(0));
    const average = totalXSOAR / BigInt(xsoarAmounts.length);
    
    console.log('\n📊 STATISTICS:');
    console.log(`   Total xSOAR: ${formatNumber(totalXSOAR.toString())}`);
    console.log(`   Average xSOAR: ${formatNumber(average.toString())}`);
    console.log(`   Addresses with xSOAR: ${xsoarAmounts.length}`);
    console.log(`   Addresses without xSOAR: ${Object.keys(astirData).length - xsoarAmounts.length}`);
    
  } catch (error) {
    console.error('❌ Error analyzing xSOAR:', error);
  }
}

function calculateMedian(sortedAmounts: bigint[]): bigint {
  const length = sortedAmounts.length;
  if (length % 2 === 0) {
    // Even number of elements - average of two middle values
    const mid1 = sortedAmounts[length / 2 - 1];
    const mid2 = sortedAmounts[length / 2];
    return (mid1 + mid2) / BigInt(2);
  } else {
    // Odd number of elements - middle value
    return sortedAmounts[Math.floor(length / 2)];
  }
}

function formatNumber(numStr: string): string {
  const num = BigInt(numStr);
  if (num === BigInt(0)) return '0';
  
  // Convert to readable format (assuming 6 decimal places for SOAR)
  const divisor = BigInt(1000000); // 10^6
  const wholePart = num / divisor;
  const decimalPart = num % divisor;
  
  if (decimalPart === BigInt(0)) {
    return wholePart.toString();
  } else {
    const decimalStr = decimalPart.toString().padStart(6, '0');
    return `${wholePart.toString()}.${decimalStr}`;
  }
}

// Run the analysis
analyzeXSOAR();

