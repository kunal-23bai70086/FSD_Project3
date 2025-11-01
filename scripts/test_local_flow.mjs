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

  // For auth, attempt register until success
  const unique = Date.now();
  const regPayload = { username: `local_${unique}`, email: `local_${unique}@example.com`, password: 'password' };
  let authUser;
  try {
    authUser = await waitForAuthRegister('http://localhost:4004/auth/register', regPayload, 15000);
    console.log('Auth register created:', authUser);
  } catch (e) {
    console.error('Auth service did not become ready in time:', e.message);
    userProc.kill(); postProc.kill(); commentProc.kill(); authProc.kill();
    await mongod.stop();
    process.exit(1);
  }

  // Login to get token
  const loginRes = await axios.post('http://localhost:4004/auth/login', { email: regPayload.email, password: regPayload.password });
  const token = loginRes.data.token;
  console.log('Obtained JWT token');

  // Use token to create a post (protected)
  console.log('\n-- Testing data flow with JWT-protected endpoints --');
  const results = [];

  try {
    const pCreate = await axios.post('http://localhost:4002/posts', { userId: authUser.id, title: 'FlowPost', content: 'FlowContent' }, { headers: { Authorization: `Bearer ${token}` } });
    results.push({ op: 'post-create', status: pCreate.status, data: pCreate.data });
    const postId = pCreate.data._id || pCreate.data.id;

    const cCreate = await axios.post('http://localhost:4003/comments', { userId: authUser.id, postId, text: 'Nice flow' }, { headers: { Authorization: `Bearer ${token}` } });
    results.push({ op: 'comment-create', status: cCreate.status, data: cCreate.data });

    const postRead = await axios.get(`http://localhost:4002/posts/${postId}`);
    results.push({ op: 'post-read', status: postRead.status, data: postRead.data });

    const commentsList = await axios.get('http://localhost:4003/comments');
    results.push({ op: 'comment-list', status: commentsList.status, count: Array.isArray(commentsList.data) ? commentsList.data.length : null });

  } catch (err) {
    console.error('Flow test error:', err.response ? err.response.data : err.message);
  }

  console.log('\n-- Flow Results --');
  console.table(results.map(r => ({ op: r.op, status: r.status, info: r.count || (r.data && r.data._id) || '' })));

  // cleanup
  userProc.kill(); postProc.kill(); commentProc.kill(); authProc.kill();
  await mongod.stop();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
