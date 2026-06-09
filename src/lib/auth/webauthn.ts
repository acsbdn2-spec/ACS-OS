// WebAuthn (biometric login) — browser-side helpers
// Stores credentials in webauthn_credentials table via API routes

export async function registerBiometric(userId: string): Promise<boolean> {
  try {
    // 1. Get challenge from server
    const challengeRes = await fetch('/api/auth/webauthn/challenge', { method: 'POST' })
    const { challenge, rpId } = await challengeRes.json()

    // 2. Create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: base64ToBuffer(challenge),
        rp: { id: rpId, name: 'ACS·OS' },
        user: {
          id: new TextEncoder().encode(userId),
          name: userId,
          displayName: 'ACS User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential

    const response = credential.response as AuthenticatorAttestationResponse

    // 3. Save to server
    const saveRes = await fetch('/api/auth/webauthn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: bufferToBase64(credential.rawId),
        publicKey: bufferToBase64(response.getPublicKey()!),
        deviceName: navigator.userAgent.slice(0, 80),
      }),
    })

    return saveRes.ok
  } catch {
    return false
  }
}

export async function loginWithBiometric(): Promise<boolean> {
  try {
    // 1. Get challenge
    const challengeRes = await fetch('/api/auth/webauthn/challenge', { method: 'POST' })
    const { challenge, rpId, credentialIds } = await challengeRes.json()

    // 2. Get assertion
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: base64ToBuffer(challenge),
        rpId,
        allowCredentials: credentialIds.map((id: string) => ({
          id: base64ToBuffer(id),
          type: 'public-key',
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential

    const response = assertion.response as AuthenticatorAssertionResponse

    // 3. Verify and issue session
    const verifyRes = await fetch('/api/auth/webauthn/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: bufferToBase64(assertion.rawId),
        authenticatorData: bufferToBase64(response.authenticatorData),
        clientDataJSON: bufferToBase64(response.clientDataJSON),
        signature: bufferToBase64(response.signature),
      }),
    })

    return verifyRes.ok
  } catch {
    return false
  }
}

export function isBiometricAvailable(): boolean {
  return typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
}

// Utils
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
