/**
 * Calculate the user's daily possible reward.
 *
 * @param {number | bigint} userXsoar - The user's staked xsoar.
 * @param {number | bigint} totalXsoar - The total xsoar in the reflection pool.
 * @param {number | bigint} dailyInflowXsoar - The daily inflow into the reflection vault (in xsoar units).
 * @param {number} decimals - The number of decimals your token uses (e.g., 6 for SOAR).
 * @returns {number} The user's daily possible reward in the main token unit.
 */
function calculateDailyPossibleReward(
    userXsoar: number | bigint,
    totalXsoar: number | bigint,
    dailyInflowXsoar: number | bigint,
    decimals: number,
  ): number {
    if (totalXsoar === 0 || userXsoar === 0 || dailyInflowXsoar === 0) {
      return 0;
    }
  
    // Convert inputs to BigInt if they aren't already
    const userXsoarBig = BigInt(userXsoar);
    const totalXsoarBig = BigInt(totalXsoar);
    const dailyInflowXsoarBig = BigInt(dailyInflowXsoar);
  
    // Calculate user's share of the pool
    const userShare = Number(userXsoarBig) / Number(totalXsoarBig);
  
    // Calculate user's daily rewards in xsoar units
    const userDailyXsoar = userShare * Number(dailyInflowXsoarBig);
  
    // Convert from xsoar (smallest unit) to main token unit
    const divisor = 10 ** decimals;
    const userDailyReward = userDailyXsoar / divisor;
  
    return userDailyReward;
  }

  /**
 * Calculate the Annual Percentage Rate (APR) for a user.
 *
 * @param {number} dailyReward - The user's daily reward in the main token unit.
 * @param {number} stakedAmount - The user's staked amount in the main token unit.
 * @returns {number} The APR as a percentage.
 */
function calculateApr(dailyReward: number, stakedAmount: number): number {
  if (stakedAmount === 0 || dailyReward === 0) {
    return 0;
  }

  // Calculate APR
  const apr = (dailyReward / stakedAmount) * 365 * 100; // Annualized percentage

  return apr;
}

const userXsoar = 10_000_000_000;     // 10,000 SOAR in xSOAR
const totalXsoar = 1_000_000_000_000; // 1,000,000 SOAR in xSOAR
const dailyInflowXsoar = 3_000_000_000; // 3,000 SOAR daily
const decimalss = 6;           // SOAR token uses 6 decimals
  
  // Calculate daily possible reward
  const dailyReward = calculateDailyPossibleReward(userXsoar, totalXsoar, dailyInflowXsoar, decimalss);
  
  // Calculate staked amount in SOAR
  const stakedAmount = userXsoar / 10 ** decimalss; // Convert xSOAR to SOAR
  
  // Calculate APR
  const apr = calculateApr(dailyReward, stakedAmount);
  
  console.log(`User's daily possible reward: ${dailyReward.toFixed(6)} SOAR`);
  console.log(`User's APR: ${apr.toFixed(2)}%`);