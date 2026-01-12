type ReflectionAccount = {
    rate: bigint;       // Reflection rate
  };
  
  type RewardAccount = {
    reflection: bigint; // User's accumulated reflection
    xsoar: bigint;      // User's staked xsoar
  };
  
  /**
   * Calculate claimable SOAR for a user to match contract logic exactly.
   *
   * @param rate - The current reflection rate from the ReflectionAccount.
   * @param reflection - The user's reflection from the RewardAccount.
   * @param xsoar - The user's staked xsoar from the RewardAccount.
   * @param decimals - Number of decimal places of the token (6 in your case).
   * @returns Claimable amount in SOAR as a floating-point number.
   */
  function calculateClaimableSOAR(
    rate: bigint,
    reflection: bigint,
    xsoar: bigint,
    decimals: number = 6
  ): number {
    // Reproduce the contract's integer math:
    // amount = (reflection / rate) - xsoar
    const userXsoarEquivalent = reflection / rate;
    let claimable = userXsoarEquivalent - xsoar;
  
    if (claimable <= 0n) {
      // If claimable <= 0, the user can't claim anything
      return 0;
    }
  
    // Convert from raw (microSOAR) to SOAR
    const divisor = BigInt(10 ** decimals);
    const claimableSOAR = Number(claimable) / Number(divisor);
  
    return claimableSOAR;
  }
  
  // Example Usage:
  const rate = 854286415328114337n;           // from ReflectionAccount
  const reflection = 271410468926968708852277796n; // from RewardAccount
  const xsoar = 1115068n;                        // from RewardAccount
  const decimals = 6;                            // Your token's decimals
  
  const claimable = calculateClaimableSOAR(rate, reflection, xsoar, decimals);
  console.log(`Claimable Amount: ${claimable.toFixed(6)} SOAR`);
  