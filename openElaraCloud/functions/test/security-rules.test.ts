import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { 
  setDoc, 
  getDoc, 
  doc, 
  collection, 
  getDocs 
} from "firebase/firestore";
import fs from "fs";
import { expect } from "chai";

describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = "openelaracloud";

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
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

  it("should allow a user to read their own profile", async () => {
    const aliceId = "alice_123";
    const aliceContext = testEnv.authenticatedContext(aliceId);
    const db = aliceContext.firestore();
    
    // Setup: Admin creates user
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "users", aliceId), {
        email: "alice@example.com",
        isInviteOnly: true,
        userId: aliceId
      });
    });

    const setup = doc(db, "users", aliceId);
    await getDoc(setup);
  });

  it("should deny a user from reading another user's profile", async () => {
    const aliceId = "alice_123";
    const bobId = "bob_456";
    const aliceContext = testEnv.authenticatedContext(aliceId);
    const db = aliceContext.firestore();

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "users", bobId), {
        email: "bob@example.com",
        userId: bobId
      });
    });

    const bobDoc = doc(db, "users", bobId);
    try {
      await getDoc(bobDoc);
      throw new Error("Should have been denied");
    } catch (e: any) {
      expect(e.code).to.equal("permission-denied");
    }
  });

  it("should enforce storage quota logic (simulated)", async () => {
    const aliceId = "alice_123";
    const aliceContext = testEnv.authenticatedContext(aliceId);
    const db = aliceContext.firestore();

    const usageDoc = doc(db, "usage", aliceId);
    
    // This expects a rule: allow write: if request.resource.data.bytes < get(/.../users/$(auth.uid)).data.storageQuota
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), "users", aliceId), {
        storageQuota: 1000
      });
    });

    try {
      await setDoc(usageDoc, { bytes: 2000 });
      throw new Error("Should have been denied due to quota");
    } catch (e: any) {
      expect(e.code).to.equal("permission-denied");
    }
  });
});
