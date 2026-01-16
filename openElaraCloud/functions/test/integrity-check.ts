import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('Sovereign Integrity Audit', () => {
  it('should verify that no Private Keys exist in the frontend source', () => {
    const signingLibPath = path.resolve(__dirname, '../../src/lib/signing.ts');
    const privateKeyTerm = 'ELARA_SIGNING_PRIVATE_KEY';
    
    const signingLib = fs.readFileSync(signingLibPath, 'utf8');
    expect(signingLib).to.not.contain(privateKeyTerm + ' = "');
  });

  it('should verify that the frontend is using a placeholder or valid Public Key SPKI', () => {
    const signingLibPath = path.resolve(__dirname, '../../src/lib/signing.ts');
    const signingLib = fs.readFileSync(signingLibPath, 'utf8');
    const hasPlaceholder = signingLib.includes('REPLACE_WITH_PUBLIC_KEY_SPKI');
    const hasKey = /const ELARA_PUBLIC_KEY_SPKI = "[A-Za-z0-9+/= \\n]+"/.test(signingLib);
    
    expect(hasPlaceholder || hasKey, "Must have valid Public Key format or placeholder").to.be.true;
  });
});
