import { spawn } from 'child_process';
import axios from 'axios';
import { MongoMemoryServer } from 'mongodb-memory-server';

const ROOT = process.cwd();

function startService(scriptPath, env) {
  const child = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (d) => process.stdout.write(`[svc ${env.PORT}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[svc ${env.PORT} ERR] ${d}`));

  return child;
}

async function waitFor(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await axios.get(url, { timeout: 1000 });
      if (r.status < 500) return true;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function waitForAuthRegister(url, payload, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await axios.post(url, payload, { timeout: 2000 });
      if (r.status === 201) return r.data;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Auth register did not become available in time');
}

async function run() {
  console.log('Starting in-memory MongoDB...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  console.log('MongoDB URI:', uri);

  const userScript = `${ROOT.replace(/\\/g, '/')}/services/user-service/src/index.js`;
  const postScript = `${ROOT.replace(/\\/g, '/')}/services/post-service/src/index.js`;
  const commentScript = `${ROOT.replace(/\\/g, '/')}/services/comment-service/src/index.js`;
  const authScript = `${ROOT.replace(/\\/g, '/')}/services/auth-service/src/index.js`;

  const userEnv = { MONGO_URI: uri, PORT: '4001' };
  const postEnv = { MONGO_URI: uri, PORT: '4002', USER_SERVICE_URL: 'http://localhost:4001/users' };
  const commentEnv = { MONGO_URI: uri, PORT: '4003', USER_SERVICE_URL: 'http://localhost:4001/users', POST_SERVICE_URL: 'http://localhost:4002/posts' };
  const authEnv = { MONGO_URI: uri, PORT: '4004', JWT_SECRET: 'supersecretkey' };

  console.log('Spawning services...');
  const userProc = startService(userScript, userEnv);
  const postProc = startService(postScript, postEnv);
  const commentProc = startService(commentScript, commentEnv);
  const authProc = startService(authScript, authEnv);

  console.log('Waiting for services to be ready...');
  const okUser = await waitFor('http://localhost:4001/');
  const okPost = await waitFor('http://localhost:4002/');
  const okComment = await waitFor('http://localhost:4003/');

  if (!okUser || !okPost || !okComment) {
    console.error('User/Post/Comment service did not start in time');
    userProc.kill(); postProc.kill(); commentProc.kill(); authProc.kill();
    await mongod.stop();
    process.exit(1);
  }

  // Register regular user
  const unique = Date.now();
  const userPayload = { username: `user_${unique}`, email: `user_${unique}@example.com`, password: 'password' };
  const adminPayload = { username: `admin_${unique}`, email: `admin_${unique}@example.com`, password: 'password', role: 'admin' };

  let regUser, regAdmin;
  try {
    regUser = await waitForAuthRegister('http://localhost:4004/auth/register', userPayload, 15000);
    regAdmin = await waitForAuthRegister('http://localhost:4004/auth/register', adminPayload, 15000);
    console.log('Registered user and admin');
  } catch (e) {
    console.error('Auth service register failed:', e.message);
    userProc.kill(); postProc.kill(); commentProc.kill(); authProc.kill();
    await mongod.stop();
    process.exit(1);
  }

  const loginUser = await axios.post('http://localhost:4004/auth/login', { email: userPayload.email, password: userPayload.password });
  const loginAdmin = await axios.post('http://localhost:4004/auth/login', { email: adminPayload.email, password: adminPayload.password });
  const tokenUser = loginUser.data.token;
  const tokenAdmin = loginAdmin.data.token;

  console.log('\n-- RBAC Tests --');
  const results = [];

  // 1) Regular user tries to GET /posts (admin-only)
  try {
    await axios.get('http://localhost:4002/posts', { headers: { Authorization: `Bearer ${tokenUser}` } });
    results.push({ test: 'user-can-list-posts', allowed: true });
  } catch (err) {
    results.push({ test: 'user-can-list-posts', allowed: false, status: err.response ? err.response.status : 'ERR' });
  }

  // 2) Admin tries to GET /posts
  try {
    const r = await axios.get('http://localhost:4002/posts', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    results.push({ test: 'admin-can-list-posts', allowed: r.status === 200 });
  } catch (err) {
    results.push({ test: 'admin-can-list-posts', allowed: false, status: err.response ? err.response.status : 'ERR' });
  }

  // 3) Regular user can create a post
  try {
    const r = await axios.post('http://localhost:4002/posts', { userId: regUser.id, title: 'UserPost', content: 'by user' }, { headers: { Authorization: `Bearer ${tokenUser}` } });
    results.push({ test: 'user-create-post', allowed: r.status === 201, id: r.data._id || r.data.id });
  } catch (err) {
    results.push({ test: 'user-create-post', allowed: false, status: err.response ? err.response.status : 'ERR' });
  }

  // 4) Admin can create a post
  try {
    const r = await axios.post('http://localhost:4002/posts', { userId: regAdmin.id, title: 'AdminPost', content: 'by admin' }, { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    results.push({ test: 'admin-create-post', allowed: r.status === 201, id: r.data._id || r.data.id });
  } catch (err) {
    results.push({ test: 'admin-create-post', allowed: false, status: err.response ? err.response.status : 'ERR' });
  }

  console.log('\n-- Results --');
  console.table(results);

  // cleanup
  userProc.kill(); postProc.kill(); commentProc.kill(); authProc.kill();
  await mongod.stop();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
