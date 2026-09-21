import { getEnrollmentSetup, getActiveTOTPSecret } from '../server/auth.js';
import { generateTOTPCode, generateOtpAuthUri } from '../server/totp.js';

async function run() {
  const activeSecret = getActiveTOTPSecret();
  let secret = activeSecret;
  let uri = '';

  if (activeSecret) {
    uri = generateOtpAuthUri('Resident', 'The Urbana', activeSecret);
  } else {
    const setup = await getEnrollmentSetup();
    secret = setup.secret;
    uri = setup.uri;
  }

  const currentCode = generateTOTPCode(secret);

  console.log('\n============================================================');
  console.log('       THE URBANA — TOTP AUTHENTICATOR SETUP');
  console.log('============================================================\n');

  try {
    const qrcode = await import('qrcode-terminal');
    console.log('Scan this QR code with Google Authenticator or Microsoft Authenticator:\n');
    qrcode.default.generate(uri, { small: true });
  } catch (err) {
    console.log('Note: Install qrcode-terminal for in-terminal QR code rendering.');
  }

  console.log('\n------------------------------------------------------------');
  console.log('MANUAL ENTRY KEY (if you cannot scan the QR code):');
  console.log(`Secret Key:   ${secret}`);
  console.log(`Account Name: Resident`);
  console.log(`Issuer:       The Urbana`);
  console.log(`Time Step:    30 seconds (Time-based / TOTP)`);
  console.log(`Digits:       6`);
  console.log('------------------------------------------------------------');
  console.log(`Provisioning URI: ${uri}`);
  console.log('------------------------------------------------------------');
  console.log(`Live 6-Digit Code right now:  [ ${currentCode} ]`);
  console.log('============================================================\n');
  console.log('Web-based enrollment interface: http://localhost:3000/admin/setup\n');
}

run().catch((err) => {
  console.error('Failed to run TOTP setup:', err);
  process.exit(1);
});
