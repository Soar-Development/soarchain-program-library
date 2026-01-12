import { utf8 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import { PublicKey } from '@solana/web3.js';
import { pda } from '../tests/utils';

async function main() {
  const pk = await pda(
    [
      utf8.encode('stake'),
      new PublicKey('6LYGMPnpZnCh4tPGDCdUREmig5SA5NPj2BssYhCerZcP').toBuffer(),//tokenmint
      new PublicKey("GUGN2H1TrTnPEn1vbofxdFArQY5rfJDn5HK3nYF6Pkm7").toBuffer(),//user
    ],
    new PublicKey('2eSBhDe7FGLUJ3BgEV2ZWqAhJ8kb8u9NCiEYjoeAQDdR'),//staking program
  );
  console.log(`https://explorer.solana.com/address/${pk}`);
}

console.log('Running client.');
main().then(() => console.log('Success'));
