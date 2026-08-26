/**
 * Password Breach Check using HaveIBeenPwned API
 * Uses k-anonymity: only sends first 5 characters of SHA-1 hash
 * Never sends the full password or full hash
 */

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export interface BreachCheckResult {
  isBreached: boolean;
  count: number;
  error?: string;
}

/**
 * Check if a password has been found in known data breaches
 * Uses the HaveIBeenPwned API with k-anonymity (range search)
 * @param password - The password to check
 * @returns Object with isBreached status and breach count
 */
export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  try {
    // Generate SHA-1 hash of the password
    const hash = await sha1(password);
    
    // Split hash into prefix (first 5 chars) and suffix (rest)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    // Query HaveIBeenPwned API with only the prefix (k-anonymity)
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Adds padding to prevent response size analysis
      },
      signal: AbortSignal.timeout(8000),
    });
    
    if (!response.ok) {
      throw new Error('Failed to check password breach status');
    }
    
    const text = await response.text();
    
    // Parse response - each line is "SUFFIX:COUNT"
    const lines = text.split('\n');
    
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        return {
          isBreached: true,
          count,
        };
      }
    }
    
    // Password not found in breaches
    return {
      isBreached: false,
      count: 0,
    };
  } catch (error) {
    console.error('Password breach check failed:', error);
    // Return error but don't block signup
    return {
      isBreached: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
