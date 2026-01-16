import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const secretClient = new SecretManagerServiceClient();

/**
 * Generates a consistent secret ID for a user-specific API key.
 * Format: ELARA_USER_[UID]_[SERVICE]_KEY
 */
function getSecretId(userId: string, service: string): string {
  // Sanitize UID (Secret Manager IDs are restricted to certain characters)
  const sanitizedUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ELARA_USER_${sanitizedUid}_${service.toUpperCase()}_KEY`;
}

/**
 * Saves or updates a user-specific secret in Google Secret Manager.
 */
export async function saveUserSecret(userId: string, service: string, value: string) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const secretId = getSecretId(userId, service);
  const parent = `projects/${projectId}`;

  try {
    // 1. Check if secret exists
    try {
      await secretClient.getSecret({ name: `${parent}/secrets/${secretId}` });
    } catch (e: any) {
      // 2. Create secret if it doesn't exist
      if (e.code === 5) { // NOT_FOUND
        await secretClient.createSecret({
          parent,
          secretId,
          secret: { replication: { automatic: {} } },
        });
      } else {
        throw e;
      }
    }

    // 3. Add new version (the actual key value)
    await secretClient.addSecretVersion({
      parent: `${parent}/secrets/${secretId}`,
      payload: { data: Buffer.from(value, 'utf-8') },
    });

    return { success: true, secretId };
  } catch (error: any) {
    console.error(`Error saving secret ${secretId}:`, error);
    throw new Error(`Failed to store secret in Sovereign Vault: ${error.message}`);
  }
}

/**
 * Retrieves a user-specific secret from Google Secret Manager.
 */
export async function getUserSecret(userId: string, service: string): Promise<string | null> {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const secretId = getSecretId(userId, service);
  const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;

  try {
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    return payload || null;
  } catch (error: any) {
    // Return null if secret version is missing or inaccessible
    console.warn(`Could not access secret ${secretId}:`, error.message);
    return null;
  }
}
