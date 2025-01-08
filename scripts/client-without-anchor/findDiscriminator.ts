import crypto from 'crypto';

function getInstructionDiscriminator(instructionName) {
  // Format the string as "global:<instruction_name>"
  const input = `global:${instructionName}`;

  // Compute the SHA-256 hash
  const hash = crypto.createHash('sha256').update(input).digest();

  // Extract the first 8 bytes
  const discriminator = hash.slice(0, 8);

  // Return the discriminator as a buffer and array
  return {
    buffer: discriminator,
    array: Array.from(discriminator),
  };
}

const instructionName = 'unbond';
const { buffer, array } = getInstructionDiscriminator(instructionName);

console.log(`Discriminator for "${instructionName}":`, buffer.toString('hex'));
console.log(`As byte array:`, array);


