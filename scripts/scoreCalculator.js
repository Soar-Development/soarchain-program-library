// Constants
const SECONDS_PER_DAY = 24 * 60 * 60; // 86,400 seconds
const DURATION_MIN = 14 * SECONDS_PER_DAY; // 2 weeks
const DURATION_MAX = 365 * SECONDS_PER_DAY; // 1 year
const XSOAR_PRECISION = BigInt(1e15); // 1e15
const XSOAR_DIV = BigInt((4 * DURATION_MAX) / 12); // 0.25 growth per month

// Function to calculate xSOAR score
function calculateXsoar(amount, duration, timeUnstake = 0) {
  // Convert inputs to BigInt
  amount = BigInt(amount);
  duration = BigInt(duration);
  timeUnstake = BigInt(timeUnstake);

  // Check if the stake is unbonded
  if (timeUnstake !== BigInt(0)) {
    return BigInt(0);
  }

  // Ensure duration is within allowed range
  if (duration < BigInt(DURATION_MIN) || duration > BigInt(DURATION_MAX)) {
    throw new Error("Duration is out of allowed range.");
  }

  // Calculate duration multiplier
  const durationMultiplier = (duration * XSOAR_PRECISION) / XSOAR_DIV;

  // Adjusted multiplier
  const adjustedMultiplier = durationMultiplier + XSOAR_PRECISION;

  // Calculate xSOAR
  const xsoar = (adjustedMultiplier * amount) / XSOAR_PRECISION;

  return xsoar;
}

// Example usage
const amount = 100n; // Amount of tokens staked
const durationDays = 14; // Duration in days
const duration = BigInt(durationDays * SECONDS_PER_DAY); // Convert days to seconds
const timeUnstake = 0n; // 0 means the stake is active

try {
  const xsoarScore = calculateXsoar(amount, duration, timeUnstake);
  console.log(`xSOAR Score: ${xsoarScore.toString()}`);
} catch (error) {
  console.error(error.message);
}
