import 'dotenv/config';
import { pool } from './index.js';

async function main() {
  console.log('Seed script is ready. Create the first superadmin through a one-time secure bootstrap command before pilot launch.');
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
