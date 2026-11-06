const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const os = require('node:os');
const root = path.resolve(__dirname, '../../..');
process.chdir(path.join(root, 'backend'));
const artifacts = path.join(root, 'frontend/test-results/e2e');
const fromBackend = createRequire(root + '/backend/package.json');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let database, backend, vite, chrome, socket, profile;
let backendApp;
const exceptions = [];
const apiResponses = [];
const observations = [];
const note = (text) => { observations.push(text); console.log('PASS: ' + text); };
let seq = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
(async () => {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.REQUIRE_ADMIN_MFA = 'true';
  process.env.ENABLE_PUBLIC_REGISTRATION = 'true';
  process.env.VITE_ENABLE_REGISTRATION = 'true';
  process.env.NODE_ENV = 'test';
  await fs.mkdir(artifacts, { recursive: true });
  const candidates = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  let chromePath;
  for (const candidate of candidates) { try { await fs.access(candidate); chromePath = candidate; break; } catch {} }
  if (!chromePath) throw new Error('Chrome/Chromium tidak ditemukan. Atur CHROME_PATH ke executable browser.');
  database = await fromBackend(root + '/backend/tests/helpers/database.js').createDatabase();
  const transaction = fromBackend(root + '/backend/src/shared/utils/transaction.js');
  const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric' }).format(new Date()));
  const credentials = await transaction(db => fromBackend(root + '/backend/database/seeds/demo.seed.js')(db, year));
  const accounts = Object.fromEntries(credentials.map(value => [value.email, value]));
  backend = createServer((req, res) => backendApp ? backendApp(req, res) : res.writeHead(503).end());
  backend.listen(0, 'localhost');
  await once(backend, 'listening');
  process.env.VITE_API_URL = `http://localhost:${backend.address().port}/api/v1`;
  const { createServer: createViteServer } = await import(pathToFileURL(root + '/frontend/node_modules/vite/dist/node/index.js'));
  vite = await createViteServer({ root: root + '/frontend', server: { host: 'localhost', port: 0, strictPort: true, open: false } });
  await vite.listen();
  const base = `http://localhost:${vite.httpServer.address().port}`;
  process.env.CORS_ORIGIN = base;
  const loggerPath = fromBackend.resolve('pino-http');
  fromBackend(loggerPath);
  require.cache[loggerPath].exports = () => (req, res, next) => { req.log = { error() {} }; next(); };
  backendApp = fromBackend(root + '/backend/src/app.js');
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-e2e-'));
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let endpoint;
  for (let i = 0; i < 150; i++) {
    try { const [port, url] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); endpoint = `ws://127.0.0.1:${port}${url}`; break; } catch { await sleep(100); }
  }
  if (!endpoint) throw new Error('Chrome debugging endpoint unavailable');
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onclose = () => { for (const entry of pending.values()) entry.reject(new Error('Browser closed')); pending.clear(); };
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const promise = pending.get(message.id); pending.delete(message.id);
      if (message.error) promise?.reject(new Error(message.error.message)); else promise?.resolve(message.result);
    }
    if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/v1/')) apiResponses.push({ path: new URL(message.params.response.url).pathname, status: message.params.response.status });
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  async function evaluate(expression) {
    const value = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (value.exceptionDetails) throw new Error('Browser evaluation failed: ' + (value.exceptionDetails.exception?.description?.split('\n')[0] || value.exceptionDetails.text));
    return value.result.value;
  }
  async function wait(expression, label, timeout = 25000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) { if (await evaluate(expression)) return; await sleep(100); }
    throw new Error('Timeout: ' + label + ' ' + await evaluate(`[...document.querySelectorAll('[role=alert]')].map(e => e.textContent).join(' | ')`));
  }
  async function fill(selector, value) {
    await wait(`!!document.querySelector(${JSON.stringify(selector)})`, 'field ' + selector);
    await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  }
  async function click(text, selector = 'button, a') {
    await wait(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e => e.textContent.includes(${JSON.stringify(text)}))`, 'action ' + text);
    await evaluate(`(() => { const item = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!item) throw new Error('Missing action'); item.click(); })()`);
  }
  async function submit(selector = 'form') { await evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`); }
  async function shot(name) {
    await sleep(350);
    const result = await call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, name + '.png'), Buffer.from(result.data, 'base64'));
  }
  async function signin(account, recovery) {
    await wait(`location.pathname === '/login' && !!document.querySelector('#email')`, 'login page');
    await fill('#email', account.email); await fill('#password', account.password);
    if (recovery) { await click('Akun Anda menggunakan MFA?'); await click('Recovery code'); await fill('#mfa-code', recovery); }
    await submit();
    await wait(`location.pathname !== '/login' && !!document.querySelector('.topbar')`, 'workspace login');
    if (await evaluate(`location.pathname !== '/'`)) await click('Ringkasan', '.sidebar a');
    await wait(`location.pathname === '/'`, 'workspace overview');
  }
  await call('Page.navigate', { url: base + '/' });
  await wait(`location.pathname === '/login' && !!document.querySelector('#email')`, 'anonymous guard');
  note('Anonymous workspace redirects to login');
  await shot('emp-login-desktop');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await shot('emp-login-mobile');
  if (await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Login mobile horizontal overflow');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await fill('#email', 'wrong'); await submit();
  await wait(`document.body.innerText.includes('alamat email yang valid')`, 'client validation');
  note('Client validates email before submission');
  const andi = accounts['andi@example.test'];
  await fill('#email', andi.email); await fill('#password', 'wrong-password'); await submit();
  await wait(`document.querySelector('[role=alert]')?.textContent.includes('salah')`, 'invalid credentials');
  note('Invalid credentials show backend error');
  await signin(andi);
  await wait(`!!document.querySelector('.data-table')`, 'employee dashboard API');
  if (await evaluate(`document.querySelector('.data-table').innerText.includes('Citra')`)) throw new Error('Cross-team data leaked');
  note('Employee dashboard loads real scoped data');
  await evaluate(`document.querySelector('.sidebar a[href="/employees"]').click()`);
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'employee scoped list');
  if (await evaluate(`document.body.innerText.includes('Tambah karyawan') || [...document.querySelectorAll('.data-table button')].some(e => e.textContent === 'Edit')`)) throw new Error('Employee write controls visible');
  await click('Ringkasan', '.sidebar a');
  await wait(`!!document.querySelector('.requests-panel .data-table')`, 'employee dashboard return');
  note('Employee role sees scoped list without create or edit actions');
  if (await evaluate(`!!document.querySelector('.sidebar a[href="/users"]')`)) throw new Error('Users menu visible to Employee');
  await call('Page.navigate', { url: base + '/users' });
  await wait(`document.body.innerText.includes('Halaman ini hanya tersedia untuk HRD/Admin.')`, 'users route role gate');
  await click('Kembali ke ringkasan');
  await wait(`!!document.querySelector('.requests-panel .data-table')`, 'dashboard after users gate');
  note('Employee cannot access Users menu or administration route');
  if (await evaluate(`!!document.querySelector('.sidebar a[href="/reports"]')`)) throw new Error('Reports menu visible to Employee');
  await call('Page.navigate', { url: base + '/reports' });
  await wait(`document.body.innerText.includes('Laporan hanya tersedia untuk HRD/Admin.')`, 'report role gate');
  await click('Kembali ke ringkasan'); await wait(`!!document.querySelector('.requests-panel .data-table')`, 'dashboard after report gate');
  note('Employee cannot access reports menu or administration page');

  await click('Jenis cuti', '.sidebar a');
  await wait(`document.body.innerText.includes('jenis cuti ditemukan')`, 'employee leave types read');
  if (await evaluate(`document.body.innerText.includes('Tambah jenis cuti') || !!document.querySelector('.data-table button')`)) throw new Error('Employee leave type write controls visible');
  await click('Ringkasan', '.sidebar a');
  await wait(`!!document.querySelector('.requests-panel .data-table')`, 'employee return after leave types');
  note('Employee can read leave types without write controls');
  await click('Hari libur', '.sidebar a');
  await wait(`document.body.innerText.includes('hari libur ditemukan')`, 'employee holidays read');
  if (await evaluate(`document.body.innerText.includes('Tambah hari libur') || !!document.querySelector('.data-table button')`)) throw new Error('Employee holiday write controls visible');
  await click('Ringkasan', '.sidebar a'); await wait(`!!document.querySelector('.requests-panel .data-table')`, 'return after holidays');
  note('Employee can read holidays without write controls');
  await click('Saldo cuti', '.sidebar a');
  await wait(`document.body.innerText.includes('saldo ditemukan')`, 'employee balances');
  if (await evaluate(`document.body.innerText.includes('Tetapkan saldo') || !!document.querySelector('.data-table button')`)) throw new Error('Employee balance write controls visible');
  if (await evaluate(`document.querySelectorAll('.data-table tbody tr').length !== 1`)) throw new Error('Employee balance scope');
  await click('Ringkasan', '.sidebar a'); await wait(`!!document.querySelector('.requests-panel .data-table')`, 'dashboard after balances');
  note('Employee reads own balance without write controls');
  await click('Pengajuan cuti', '.sidebar a');
  await wait(`document.body.innerText.includes('pengajuan ditemukan')`, 'leave request list');
  await click('Ajukan cuti');
  await wait(`!!document.querySelector('#request-type option:nth-child(2)')`, 'request type options');
  const requestType = await evaluate(`document.querySelector('#request-type option:nth-child(2)').value`);
  let leaveDate = new Date(Date.UTC(year, 11, 14));
  while ([0, 6].includes(leaveDate.getUTCDay())) leaveDate.setUTCDate(leaveDate.getUTCDate() + 1);
  const dateValue = leaveDate.toISOString().slice(0, 10);
  await fill('#request-type', requestType); await fill('#request-start', dateValue); await fill('#request-end', dateValue); await fill('#request-reason', 'QA leave request');
  await submit('.request-form');
  await wait(`location.pathname.startsWith('/leave-requests/') && !!document.querySelector('.request-details')`, 'request draft detail');
  await click('Edit draft');
  await fill('#request-reason', 'QA leave request updated'); await submit('.request-form');
  await wait(`document.body.innerText.includes('Draft berhasil diperbarui.')`, 'request draft update');
  await evaluate(`window.confirm = () => true`);
  await click('Submit pengajuan');
  await wait(`document.body.innerText.includes('Pengajuan berhasil dikirim.')`, 'request submission');
  if (await evaluate(`[...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Edit draft')`)) throw new Error('Submitted request editable');
  await click('Batalkan pengajuan');
  await wait(`document.body.innerText.includes('Pengajuan berhasil dibatalkan.')`, 'request cancellation');
  await click('Kembali', '.panel-header a');
  await fill('.request-filters select', 'Cancelled');
  await wait(`document.querySelector('.data-table tbody')?.textContent.includes('Dibatalkan')`, 'request status filter');
  await click('Ringkasan', '.sidebar a'); await wait(`!!document.querySelector('.requests-panel .data-table')`, 'dashboard after requests');
  note('Leave requests create, edit draft, submit, lock edit, cancel and status filter pass');
  await click('Pengajuan cuti', '.sidebar a'); await click('Ajukan cuti');
  await fill('#request-type', requestType); await fill('#request-start', dateValue); await fill('#request-end', dateValue); await fill('#request-reason', 'QA approval request');
  await submit('.request-form');
  await wait(`location.pathname.startsWith('/leave-requests/') && !!document.querySelector('.request-details')`, 'approval draft');
  const approvalRequestId = await evaluate(`location.pathname.split('/').pop()`);
  await click('Submit pengajuan'); await wait(`document.body.innerText.includes('Pengajuan berhasil dikirim.')`, 'approval request submit');
  await click('Ringkasan', '.sidebar a'); await wait(`!!document.querySelector('.requests-panel .data-table')`, 'dashboard before supervisor');







  if (await evaluate(`document.cookie.includes('hrd_session')`)) throw new Error('Session cookie readable');
  note('Session cookie is HttpOnly');
  await call('Page.reload');
  await wait(`!!document.querySelector('.data-table') && location.pathname === '/'`, 'restored session');
  note('Reload restores authenticated session');
  await click('Akun & session', '.sidebar a');
  await wait(`document.body.innerText.includes('Session ini')`, 'session page');
  note('Account page loads own session');
  await click('Keluar dari akun');
  await wait(`location.pathname === '/login'`, 'logout');
  note('Logout clears server session and returns to login');

  const supervisor = accounts['budi@example.test'];
  await signin(supervisor);
  await click('Persetujuan tim', '.sidebar a');
  await wait(`document.body.innerText.includes('pengajuan menunggu')`, 'supervisor pending list');
  await evaluate(`document.querySelector('a[href="/leave-requests/${approvalRequestId}"]').click()`);
  await wait(`!!document.querySelector('#approval-comment')`, 'approval detail');
  await click('Setujui pengajuan');
  await wait(`document.body.innerText.includes('Komentar keputusan wajib diisi.')`, 'required decision comment');
  const beforeBalance = await database.pool.query(`SELECT used_days::float8 AS used FROM "TB_LEAVE_BALANCES" b JOIN "TB_EMPLOYEES" e ON e.id=b.employee_id JOIN "TB_LEAVE_TYPES" t ON t.id=b.leave_type_id WHERE e.public_id=$1 AND t.public_id=$2 AND b.period_year=$3`, [andi.employee_id || (await database.pool.query(`SELECT e.public_id FROM "TB_EMPLOYEES" e JOIN "TB_USERS" u ON u.employee_id=e.id WHERE u.email=$1`, [andi.email])).rows[0].public_id, requestType, year]);
  await fill('#approval-comment', 'QA approved by supervisor'); await click('Setujui pengajuan');
  await fill('#security-password', supervisor.password); await submit('dialog form');
  await wait(`document.body.innerText.includes('Pengajuan berhasil disetujui.')`, 'approval success');
  const afterBalance = await database.pool.query(`SELECT used_days::float8 AS used FROM "TB_LEAVE_BALANCES" b JOIN "TB_USERS" u ON u.employee_id=b.employee_id JOIN "TB_LEAVE_TYPES" t ON t.id=b.leave_type_id WHERE u.email=$1 AND t.public_id=$2 AND b.period_year=$3`, [andi.email, requestType, year]);
  if (afterBalance.rows[0].used !== beforeBalance.rows[0].used + 1) throw new Error('Approval did not deduct one day');
  await wait(`document.querySelector('.request-approval')?.textContent.includes('QA approved by supervisor')`, 'approval history');
  await click('Kembali ke persetujuan tim');
  await wait(`[...document.querySelectorAll('.data-table tbody tr')].some(e => e.textContent.includes('Andi'))`, 'pending after approval');
  await evaluate(`(() => { const row = [...document.querySelectorAll('.data-table tbody tr')].find(e => e.textContent.includes('Andi')); row.querySelector('a').click(); })()`);
  await wait(`!!document.querySelector('#approval-comment')`, 'reject detail');
  await fill('#approval-comment', 'QA rejected by supervisor'); await click('Tolak pengajuan');
  await fill('#security-password', supervisor.password); await submit('dialog form');
  await wait(`document.body.innerText.includes('Pengajuan berhasil ditolak.')`, 'rejection success');
  await wait(`document.querySelector('.request-approval')?.textContent.includes('QA rejected by supervisor')`, 'rejection history');
  await click('Keluar dari akun'); await wait(`location.pathname === '/login'`, 'supervisor logout');
  note('Supervisor pending list, required comment, approve with balance deduction, reject and decision history pass');
  const admin = accounts['hrd.admin@example.test'];
  await signin(admin);
  await wait(`document.body.innerText.includes('Amankan akses admin Anda')`, 'MFA gate');
  note('Admin without verified MFA sees security gate');
  await click('Aktifkan MFA');
  await wait(`!!document.querySelector('#mfa-password')`, 'MFA password form');
  await fill('#mfa-password', admin.password); await submit();
  await wait(`!!document.querySelector('.secret-box code')`, 'MFA enrollment secret');
  const secret = await evaluate(`document.querySelector('.secret-box code').textContent`);
  const OTPAuth = fromBackend('otpauth');
  const otp = new OTPAuth.TOTP({ secret }).generate();
  await fill('#confirm-otp', otp); await submit();
  await wait(`document.querySelectorAll('.recovery-grid code').length === 8`, 'recovery codes');
  const codes = await evaluate(`[...document.querySelectorAll('.recovery-grid code')].map(e => e.textContent)`);
  note('MFA enrollment confirms and displays eight recovery codes once');
  await evaluate(`document.querySelector('.checkbox-label input').click()`);
  await click('Kembali ke login');
  await signin(admin, codes[0]);
  await wait(`!!document.querySelector('.data-table')`, 'admin dashboard after MFA');
  await click('Departemen', '.sidebar a');
  await wait(`document.body.innerText.includes('departemen ditemukan')`, 'department listing');
  await click('Tambah departemen');
  await fill('#department-code', 'qa'); await fill('#department-name', 'QA Department');
  await submit('.department-form');
  await wait(`document.body.innerText.includes('Departemen berhasil ditambahkan.')`, 'department create');
  await fill('#department-search', 'QA Department'); await submit('.department-search');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'department search');
  await click('Edit', '.data-table button');
  await fill('#department-name', 'QA Department Updated');
  await database.pool.query(`UPDATE "TB_SESSIONS" SET verified_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes'`);
  await submit('.department-form');
  await wait(`!!document.querySelector('dialog[open]')`, 'department recent auth gate');
  await click('Batal', 'dialog button');
  await wait(`!document.querySelector('dialog')`, 'cancel department reauth');
  if (await evaluate(`document.querySelector('#department-name').value !== 'QA Department Updated'`)) throw new Error('Department draft lost');
  await submit('.department-form');
  await fill('#security-password', admin.password);
  await fill('#security-factor', 'recovery'); await fill('#security-code', codes[5]);
  await submit('dialog form');
  await wait(`document.body.innerText.includes('Departemen berhasil diperbarui.')`, 'department edit after reauth');
  await wait(`document.querySelector('.data-table tbody')?.textContent.includes('QA Department Updated')`, 'department refreshed row');
  note('Department create, search, edit, expired verification, cancel preserving draft and MFA reauthentication pass');
  await evaluate(`document.querySelector('.sidebar a[href="/employees"]').click()`);
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 5`, 'employee list');
  await click('Detail', '.data-table a');
  await wait(`!!document.querySelector('.employee-details')`, 'employee detail');
  await click('Kembali', '.panel-header a');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 5`, 'employee list restored');
  await click('Tambah karyawan');
  await fill('#employee-nik', 'qa006');
  await fill('#employee-fullName', 'QA Employee');
  await fill('#employee-position', 'Analyst');
  await fill('#employee-joinDate', year + '-01-01');
  const departmentId = await evaluate(`document.querySelector('#employee-department option:nth-child(2)').value`);
  await fill('#employee-department', departmentId);
  await submit('.employee-form');
  await wait(`document.body.innerText.includes('Karyawan berhasil ditambahkan.')`, 'employee create');
  await fill('#employee-search', 'QA Employee'); await submit('.employee-filters');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'employee search');
  await click('Edit', '.data-table button');
  await fill('#employee-position', 'Senior Analyst');
  await database.pool.query(`UPDATE "TB_SESSIONS" SET verified_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes'`);
  await submit('.employee-form');
  await wait(`!!document.querySelector('dialog[open]')`, 'employee recent auth gate');
  await fill('#security-password', admin.password); await fill('#security-factor', 'recovery'); await fill('#security-code', codes[6]);
  await submit('dialog form');
  await wait(`document.body.innerText.includes('Karyawan berhasil diperbarui.')`, 'employee update');
  await wait(`document.querySelector('.data-table tbody')?.textContent.includes('Senior Analyst')`, 'employee updated row');
  note('Employee list, detail, create, search, update and MFA reauthentication pass');
  await evaluate(`document.querySelector('.sidebar a[href="/users"]').click()`);
  await wait(`document.body.innerText.includes('akun ditemukan')`, 'users list');
  await click('Tambah user');
  await fill('#user-email', 'qa.user@example.test');
  await fill('#user-password', 'QA-user-password-only-for-test-2026');
  await submit('.user-form');
  await wait(`document.body.innerText.includes('Akun berhasil dibuat.')`, 'user create');
  await fill('.user-filters input', 'qa.user@example.test'); await submit('.user-filters');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'user search');
  await click('Edit', '.data-table button');
  await fill('#user-role', 'Supervisor'); await submit('.user-form');
  await wait(`document.body.innerText.includes('Akun berhasil diperbarui.')`, 'user role update');
  await click('Profil karyawan', '.data-table button');
  await wait(`!document.querySelector('#user-employee').disabled`, 'employee link options');
  const employeeToLink = await evaluate(`[...document.querySelectorAll('#user-employee option')].find(e => e.textContent.includes('QA Employee')).value`);
  await fill('#user-employee', employeeToLink); await submit('.user-form');
  await fill('#security-password', admin.password); await fill('#security-factor', 'recovery'); await fill('#security-code', codes[7]); await submit('dialog form');
  await wait(`document.body.innerText.includes('Pengaitan profil berhasil diperbarui.')`, 'user employee link');
  await click('Nonaktifkan', '.data-table button');
  await fill('#security-password', admin.password); await fill('#security-factor', 'otp');
  const nowOtp = new OTPAuth.TOTP({ secret }).generate();
  if (nowOtp === otp) await sleep(31000 - Date.now() % 30000);
  await fill('#security-code', new OTPAuth.TOTP({ secret }).generate()); await submit('dialog form');
  await wait(`document.body.innerText.includes('Akun berhasil dinonaktifkan.')`, 'user deactivation');
  await wait(`!![...document.querySelectorAll('.data-table button')].find(e => e.textContent === 'Aktifkan')`, 'inactive user action');
  note('Users create, search, role edit, employee linking with MFA and deactivation pass');
  await click('Jenis cuti', '.sidebar a');
  await wait(`document.body.innerText.includes('jenis cuti ditemukan')`, 'leave types list');
  await click('Tambah jenis cuti');
  await fill('#leave-type-code', 'qa-leave'); await fill('#leave-type-name', 'QA Leave');
  await submit('.leave-type-form');
  await wait(`document.body.innerText.includes('Jenis cuti berhasil ditambahkan.')`, 'leave type create');
  await fill('.leave-type-filters input', 'QA Leave'); await submit('.leave-type-filters');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'leave type search');
  await click('Edit', '.data-table button'); await fill('#leave-type-name', 'QA Leave Updated');
  await submit('.leave-type-form');
  await wait(`document.body.innerText.includes('Jenis cuti berhasil diperbarui.')`, 'leave type edit');
  await click('Edit', '.data-table button');
  await evaluate(`document.querySelector('input[name="isActive"]').click()`);
  await submit('.leave-type-form');
  await wait(`document.body.innerText.includes('Jenis cuti berhasil diperbarui.') && !document.querySelector('.leave-type-form')`, 'leave type deactivate');
  await fill('.leave-type-filters select', 'true');
  await wait(`document.body.innerText.includes('Tidak ada jenis cuti yang sesuai')`, 'leave type active filter');
  await fill('.leave-type-filters select', 'false');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'leave type inactive filter');
  note('Leave types create, search, edit, deactivate and status filters pass');
  await click('Hari libur', '.sidebar a');
  await wait(`document.body.innerText.includes('hari libur ditemukan')`, 'holidays list');
  for (const offset of [0, 1]) {
    await click('Tambah hari libur');
    await fill('#holiday-date', (year + offset) + '-12-30'); await fill('#holiday-name', 'QA Holiday ' + offset);
    await submit('.holiday-form');
    await wait(`document.body.innerText.includes('Hari libur berhasil ditambahkan.') && !document.querySelector('.holiday-form')`, 'holiday create');
  }
  await fill('.holiday-filters input[type=search]', 'QA Holiday');
  await fill('.holiday-filters input[type=number]', String(year)); await submit('.holiday-filters');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1 && document.querySelector('.data-table tbody').textContent.includes('QA Holiday 0')`, 'holiday year filter');
  await click('Edit', '.data-table button'); await fill('#holiday-name', 'QA Holiday Updated');
  await evaluate(`document.querySelector('input[name="isActive"]').click()`); await submit('.holiday-form');
  await wait(`document.body.innerText.includes('Hari libur berhasil diperbarui.') && !document.querySelector('.holiday-form')`, 'holiday edit');
  await fill('.holiday-filters select', 'true');
  await wait(`document.body.innerText.includes('Tidak ada hari libur yang sesuai')`, 'holiday active filter');
  await fill('.holiday-filters select', 'false');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'holiday inactive filter');
  await fill('.holiday-filters select', '');
  await fill('.holiday-filters input[type=number]', String(year + 1)); await submit('.holiday-filters');
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1 && document.querySelector('.data-table tbody').textContent.includes('QA Holiday 1')`, 'holiday next year filter');
  note('Holidays create across years, search, edit, deactivate and combined year/status pagination filters pass');
  await click('Saldo cuti', '.sidebar a');
  await wait(`document.body.innerText.includes('saldo ditemukan')`, 'balances list');
  await click('Tetapkan saldo');
  await wait(`!!document.querySelector('#balance-employee')`, 'balance form');
  const balanceEmployee = await evaluate(`[...document.querySelectorAll('#balance-employee option')].find(e => e.textContent.includes('QA Employee')).value`);
  const balanceType = await evaluate(`document.querySelector('#balance-type option:nth-child(2)').value`);
  await fill('#balance-employee', balanceEmployee); await fill('#balance-type', balanceType);
  await fill('#balance-year', String(year)); await fill('#balance-entitlement', '12.5');
  await submit('.balance-form');
  await wait(`document.body.innerText.includes('Hak cuti berhasil ditetapkan.')`, 'set balance');
  await fill('.balance-filters select', balanceEmployee);
  await wait(`document.querySelectorAll('.data-table tbody tr').length === 1`, 'employee balance filter');
  await click('Atur saldo', '.data-table button');
  await fill('#balance-entitlement', '15'); await submit('.balance-form');
  await wait(`document.body.innerText.includes('Hak cuti berhasil ditetapkan.') && !document.querySelector('.balance-form')`, 'update entitlement');
  await wait(`document.querySelector('.data-table tbody').textContent.includes('15')`, 'balance refreshed');
  note('Leave balances set fractional entitlement, employee filter and update pass');
  await click('Laporan', '.sidebar a');
  await wait(`!!document.querySelector('#report-start')`, 'report page');
  await fill('#report-start', year + '-01-01'); await fill('#report-end', year + '-12-31'); await submit('.report-filters');
  await wait(`!!document.querySelector('.reports-page .data-table tbody')`, 'report data');
  if (!await evaluate(`document.querySelector('.data-table tbody').textContent.includes('Eko')`)) throw new Error('Approved leave report missing employee');
  await fill('#report-start', (year - 2) + '-01-01'); await submit('.report-filters');
  await wait(`document.body.innerText.includes('Rentang tanggal harus berurutan')`, 'report range validation');
  await fill('#report-start', year + '-01-01'); await submit('.report-filters');
  const reportDownloadDirectory = path.join(profile, 'downloads');
  await fs.mkdir(reportDownloadDirectory);
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: reportDownloadDirectory });
  await database.pool.query(`UPDATE "TB_SESSIONS" SET verified_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes'`);
  await click('Ekspor CSV');
  await wait(`!!document.querySelector('dialog[open]')`, 'report export reauth');
  await fill('#security-password', admin.password); await fill('#security-factor', 'otp');
  await sleep(31000 - Date.now() % 30000);
  await fill('#security-code', new OTPAuth.TOTP({ secret }).generate()); await submit('dialog form');
  await wait(`document.body.innerText.includes('File CSV telah dikirim')`, 'report download');
  let csvFile;
  for (let attempt = 0; attempt < 50; attempt++) {
    csvFile = (await fs.readdir(reportDownloadDirectory)).find(name => name.endsWith('.csv'));
    if (csvFile) break;
    await sleep(100);
  }
  if (!csvFile) throw new Error('CSV file not downloaded');
  const csvContent = await fs.readFile(path.join(reportDownloadDirectory, csvFile), 'utf8');
  if (!csvContent.includes('used_days') || !csvContent.includes('Eko')) throw new Error('CSV content missing data');
  note('Reports render approved leave, validate date range, reauthenticate expired session and download real CSV');






  await click('Ringkasan', '.sidebar a');
  await wait(`!!document.querySelector('.requests-panel .data-table')`, 'return dashboard');
  await shot('emp-dashboard-desktop');
  note('Recovery-code login unlocks real admin dashboard');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await shot('emp-dashboard-mobile');
  if (await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error('Dashboard mobile horizontal overflow');
  await evaluate(`document.querySelector('[aria-label="Buka navigasi"]').click()`);
  await wait(`document.querySelector('.sidebar').classList.contains('mobile-open')`, 'mobile menu');
  await click('Akun & session', '.sidebar a');
  await wait(`location.pathname === '/account' && !document.querySelector('.sidebar').classList.contains('mobile-open')`, 'mobile navigation');
  note('Mobile layout and navigation work without horizontal page overflow');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await wait(`document.body.innerText.includes('Session ini')`, 'account sessions');
  await shot('emp-account-desktop');
  await click('Keluar dari semua session');
  await wait(`!!document.querySelector('dialog[open]')`, 'reauth dialog');
  await fill('#security-password', admin.password); await fill('#security-factor', 'recovery'); await fill('#security-code', codes[1]);
  await submit('dialog form');
  await wait(`location.pathname === '/login'`, 'logout all');
  note('Reauthentication rotates CSRF and logout-all revokes access');
  await signin(admin, codes[2]);
  await click('Akun & session', '.sidebar a');
  await wait(`document.body.innerText.includes('Session ini')`, 'password account page');
  await click('Ubah password');
  await fill('#security-password', admin.password);
  const updatedPassword = randomBytes(20).toString('hex');
  await fill('#new-password', updatedPassword); await fill('#new-password-confirm', updatedPassword);
  await fill('#security-factor', 'recovery'); await fill('#security-code', codes[3]); await submit('dialog form');
  await wait(`location.pathname === '/login' && document.body.innerText.includes('Password berhasil diubah')`, 'password change');
  await signin({ ...admin, password: updatedPassword }, codes[4]);
  await wait(`!!document.querySelector('.data-table')`, 'login with changed password');
  note('Password change revokes session; new password and MFA can log in');
  if (exceptions.length) throw new Error('Browser runtime exceptions: ' + exceptions.length);
  await fs.writeFile(path.join(artifacts, 'summary.json'), JSON.stringify({ passed: observations.length, observations, runtimeExceptions: exceptions.length }, null, 2));
  console.log(JSON.stringify({ passed: observations.length, observations, screenshots: ['emp-login-desktop.png','emp-login-mobile.png','emp-dashboard-desktop.png','emp-dashboard-mobile.png','emp-account-desktop.png'], runtimeExceptions: exceptions.length }, null, 2));
})().catch(error => { console.error('Browser QA failed:', error.message, JSON.stringify(apiResponses.slice(-8))); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  if (chrome && chrome.exitCode === null) { chrome.kill('SIGTERM'); await Promise.race([once(chrome, 'exit'), sleep(2000)]).catch(() => {}); }
  if (vite) await vite.close();
  if (backend) await new Promise(resolve => backend.close(resolve));
  if (database) await database.cleanup();
  if (profile) await fs.rm(profile, { recursive: true, force: true });
});
