import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { hashPassword } from '../server/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const credsFile = path.resolve(__dirname, '../server/.admin_credentials.json');

const args = process.argv.slice(2);
let username = args[0];
let password = args[1];

async function run() {
  if (!username || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

    if (!username) {
      const inputUser = await ask('Enter Admin Username (default: admin): ');
      username = inputUser.trim() || 'admin';
    }
    if (!password) {
      const inputPass = await ask('Enter New Password: ');
      password = inputPass.trim();
    }
    rl.close();
  }

  if (!password) {
    console.error('Error: Password cannot be empty.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const data = {
    username,
    passwordHash,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(credsFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  console.log(`\n✓ Administrator credentials successfully updated!`);
  console.log(`  Username:      ${username}`);
  console.log(`  Password:      [HIDDEN]`);
  console.log(`  Password Hash: ${passwordHash.slice(0, 28)}... (scrypt)`);
  console.log(`  Storage:       server/.admin_credentials.json\n`);
}

run().catch(console.error);

