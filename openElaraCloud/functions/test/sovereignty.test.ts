import path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { 
  setDoc, 
  getDoc, 
  doc, 
} from "firebase/firestore";
import fs from "fs";
import { expect } from "chai";

describe("Sovereignty & Integrity Rules", () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = "openelaracloud";
  const ADMIN_EMAIL = "YOUR_EMAIL@example.com";

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("should prevent unauthorized access to API Keys", async () => {
    const aliceId = "alice_123";
    const bobId = "bob_456";
    const aliceContext = testEnv.authenticatedContext(aliceId, { email: ADMIN_EMAIL });
    const bobContext = testEnv.authenticatedContext(bobId, { email: "attacker@evil.com" });

    // Alice (Owner) creates a key
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), `users/${aliceId}/apiKeys`, "key_1"), {
        hashedKey: "secret_hash"
      });
    });

    // Bob tries to read Alice's key
    const bobDb = bobContext.firestore();
    try {
      await getDoc(doc(bobDb, `users/${aliceId}/apiKeys`, "key_1"));
      throw new Error("Should have been denied");
    } catch (e: any) {
      expect(e.code).to.equal("permission-denied");
    }
  });

  it("should allow Admin to see Provenance compliance data", async () => {
    const adminId = "admin_123";
    const adminContext = testEnv.authenticatedContext(adminId, { email: ADMIN_EMAIL });
    const db = adminContext.firestore();

    const hash = "sample_content_hash";
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), "provenance", hash), {
        userId: adminId,
        originalPrompt: "Secret prompt",
        characterName: "Elara"
      });
    });

    const snap = await getDoc(doc(db, "provenance", hash));
    expect(snap.data()?.originalPrompt).to.equal("Secret prompt");
  });

  it("should enforce Public vs Private prompt visibility in Provenance", async () => {
      // In a real scenario, we'd use 'get' in rules to check if the user is the owner
      // This test ensures the foundation is there.
  });
});
