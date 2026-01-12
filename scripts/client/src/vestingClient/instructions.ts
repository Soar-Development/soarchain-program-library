import { PublicKey, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';

export function createUnlockInstruction(
  vestingProgramId: PublicKey,
  tokenProgramId: PublicKey,
  clockSysvarId: PublicKey,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  destinationTokenAccountKey: PublicKey,
  seeds: Array<Buffer | Uint8Array>,
): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from(Int8Array.from([2]).buffer),
    Buffer.concat(seeds),
  ]);

  const keys = [
    {
      pubkey: tokenProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: clockSysvarId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: vestingTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: destinationTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function createChangeDestinationInstruction(
  vestingProgramId: PublicKey,
  vestingAccountKey: PublicKey,
  currentDestinationTokenAccountOwner: PublicKey,
  currentDestinationTokenAccount: PublicKey,
  targetDestinationTokenAccount: PublicKey,
  seeds: Array<Buffer | Uint8Array>,
): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from(Int8Array.from([3]).buffer),
    Buffer.concat(seeds),
  ]);

  const keys = [
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: currentDestinationTokenAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: currentDestinationTokenAccountOwner,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: targetDestinationTokenAccount,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}