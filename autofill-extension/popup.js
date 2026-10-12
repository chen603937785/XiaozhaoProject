(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const API = 'https://my88ai.com';
  let loggedIn = false, resumes = [], selectedId = '', mode = 'preserve', activeTabId = null, jobsRequest = 0;
  function message(text, good = false) {
    $('#message').textContent = text; $('#message').hidden = !text;
    $('#message').classList.toggle('success', good);
  }
  function request(payload) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, reply => {
      if (chrome.runtime.lastError) return reject(Error(chrome.runtime.lastError.message));
      if (reply?.status === 401) clearAccount();
      if (!reply?.ok) return reject(Error(reply?.data?.message || reply?.error || '请求失败'));
      resolve(reply.data);
    }));
  }
  async function api(path, options = {}) {
    const reply = await request({type: 'xiaomai-api', path, method: options.method || 'GET', body: options.body});
    if (reply?.code !== undefined && reply.code !== 200) {
      if (reply.code === 401) clearAccount();
      throw Error(reply.message || '请求失败');
    }
    return reply?.code === 200 ? reply.data : reply;
  }
  async function pageCommand(command) {
    if (!activeTabId) throw Error('请先打开一个网申网页');
    const state = await request({type: 'xiaomai-page-command', tabId: activeTabId, command});
    if (state?.error) throw Error(state.error);
    return state;
  }
  function website(url = API) { chrome.tabs.create({url}); }
  function info(title, text) {
    $('#info-title').textContent = title;
    $('#info-content').textContent = text;
    $('#info-dialog').showModal();
  }
  function closeMenus() {
    for (const id of ['resume', 'mode']) {
      $('#' + id + '-options').hidden = true;
      $('#' + id + '-select').setAttribute('aria-expanded', 'false');
    }
    $('#more-menu').hidden = true; $('#more-button').setAttribute('aria-expanded', 'false');
  }
  function toggleMenu(id) {
    const opening = $('#' + id + '-options').hidden;
    closeMenus(); $('#' + id + '-options').hidden = !opening;
    $('#' + id + '-select').setAttribute('aria-expanded', String(opening));
  }
  function clearAccount() {
    loggedIn = false; resumes = []; selectedId = ''; jobsRequest++;
    $('#user-name').textContent = '登录 / 注册'; $('#avatar').textContent = '麦';
    $('#vip-text').textContent = '开通会员'; $('#vip-tip').textContent = '升级 vip，立刻提速';
    $('#vip-tip').classList.remove('expiring');
    $('#jobs-list').replaceChildren(); $('#missing-summary').textContent = '登录后同步简历，填写时查看信息缺失提醒。';
    renderResumes();
  }
  function openLogin() { closeMenus(); $('#login-error').textContent = ''; $('#login-dialog').showModal(); }
  async function loadAccount() {
    const session = await api('session');
    if (!session.loggedIn) { clearAccount(); return; }
    loggedIn = true;
    if (session.phone) $('#phone').value = session.phone;
    const user = await api('/api/user/info');
    const name = user.nickname || (user.phone ? '用户' + user.phone.slice(-4) : '同学');
    $('#user-name').textContent = name; $('#avatar').textContent = name.slice(-1);
    const expires = String(user.vipExpire || '').slice(0, 10);
    const days = expires ? (new Date(expires + 'T23:59:59') - Date.now()) / 86400000 : Infinity;
    const vip = user.isVip && days >= 0;
    $('#vip-text').textContent = vip ? '续费会员' : '开通会员';
    $('#vip-tip').textContent = vip ? '您已是会员 · 到期时间：' + (expires || '已开通') : '升级 vip，立刻提速';
    $('#vip-tip').classList.toggle('expiring', vip && days < 7);
  }
  function renderResumes() {
    const current = resumes.find(r => String(r.id) === String(selectedId));
    $('#resume-label').textContent = current?.resumeName || (loggedIn ? '暂无简历，请前往官网创建' : '登录后选择简历');
    $('#resume-options').replaceChildren();
    for (const resume of resumes) {
      const button = document.createElement('button'); button.type = 'button';
      const selected = String(resume.id) === String(selectedId);
      button.classList.toggle('selected', selected); button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(selected));
      const name = document.createElement('span'); name.textContent = resume.resumeName || '默认模板简历';
      const check = document.createElement('span'); check.textContent = '✓'; button.append(name, check);
      button.onclick = async () => {
        try {
          const state = await pageCommand('state').catch(() => ({}));
          if (state.busy) throw Error('正在填写，请结束或停止后切换简历');
          selectedId = String(resume.id);
          await chrome.storage.local.set({selectedResumeId: selectedId});
          closeMenus(); renderResumes();
          await syncPage(); message('已切换当前简历', true);
        } catch (error) { message(error.message); }
      };
      $('#resume-options').append(button);
    }
  }
  async function syncPage() {
    const state = await pageCommand('state').catch(() => ({}));
    if (state.busy) throw Error('正在填写，请结束或停止后刷新简历');
    if (state.visible) await pageCommand('reload');
  }
  async function refreshResume(silent = false) {
    if (!loggedIn) { openLogin(); return; }
    const button = $('#refresh-resume'); button.disabled = true;
    try {
      const list = await api('/api/resumes'); resumes = Array.isArray(list) ? list : [];
      const current = resumes.find(r => String(r.id) === String(selectedId)) || resumes.find(r => r.isDefault) || resumes[0];
      selectedId = current ? String(current.id) : '';
      await chrome.storage.local.set({selectedResumeId: selectedId}); renderResumes();
      await syncPage();
      if (silent !== true || !resumes.length) message(resumes.length ? '简历已刷新，填写时将读取当前版本的最新数据' : '还没有简历，请在官网创建', !!resumes.length);
    } catch (error) { message('简历刷新失败：' + error.message); }
    finally { button.disabled = false; }
  }
  function renderMode() {
    $('#mode-label').textContent = mode === 'overwrite' ? '全部覆盖重填' : '仅填新增内容';
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected); button.setAttribute('aria-selected', String(selected));
    });
  }
  async function loadJobs() {
    const sequence = ++jobsRequest, box = $('#jobs-list');
    box.replaceChildren();
    if (!loggedIn) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '登录相同的小麦账号，同步你的关注岗位';
      const login = document.createElement('button'); login.className = 'primary-button'; login.textContent = '登录 / 注册'; login.onclick = openLogin;
      empty.append(login); box.append(empty); return;
    }
    box.textContent = '正在加载关注岗位…';
    try {
      const jobs = await api('/api/job-status/list');
      if (sequence !== jobsRequest) return;
      box.replaceChildren();
      if (!jobs?.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '暂无关注岗位，在手机或官网关注后可同步到这里。'; box.append(empty); return; }
      const stages = {FOLLOWED: '已关注', APPLIED: '已投递', WRITTEN: '笔试中', INTERVIEW: '面试中', OFFER: '已获 Offer', CLOSED: '已结束'};
      for (const job of jobs) {
        const card = document.createElement('article'); card.className = 'job-card';
        const title = document.createElement('h3'); title.textContent = job.companyName || '校招岗位';
        const positions = document.createElement('p'); positions.textContent = job.positions || '岗位信息待补充';
        const stage = document.createElement('small'); stage.textContent = stages[job.mainStatus] || '已关注';
        card.append(title, positions, stage);
        const url = job.applyUrl || job.noticeUrl;
        if (url && /^https?:\/\//i.test(url)) {
          const button = document.createElement('button'); button.textContent = job.applyUrl ? '去投递' : '查看公告';
          button.onclick = () => website(url); card.append(button);
        }
        box.append(card);
      }
    } catch (error) { if (sequence === jobsRequest) { box.textContent = '加载失败，请点击右上方“刷新”重试。'; message(error.message); } }
  }
  document.addEventListener('click', event => { if (!event.target.closest('.dropdown, #more-button, #more-menu')) closeMenus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });
  $('#resume-select').onclick = () => { if (!loggedIn) return openLogin(); if (resumes.length) toggleMenu('resume'); else message('暂无简历，请点击“修改简历”到官网创建'); };
  $('#mode-select').onclick = () => toggleMenu('mode');
  document.querySelectorAll('[data-mode]').forEach(button => button.onclick = async () => {
    mode = button.dataset.mode; await chrome.storage.local.set({fillMode: mode}); renderMode(); closeMenus();
  });
  $('#missing-reminder').onchange = () => chrome.storage.local.set({missingReminder: $('#missing-reminder').checked});
  for (const name of ['resume', 'jobs']) $('#' + name + '-tab').onclick = () => {
    closeMenus(); message('');
    for (const tab of ['resume', 'jobs']) {
      const selected = tab === name; $('#' + tab + '-tab').classList.toggle('active', selected);
      $('#' + tab + '-tab').setAttribute('aria-selected', String(selected)); $('#' + tab + '-page').hidden = !selected;
    }
    if (name === 'jobs') loadJobs();
  };
  $('#refresh-resume').onclick = refreshResume;
  $('#refresh-jobs').onclick = loadJobs;
  $('#edit-resume').onclick = () => { message('已打开官网，请进入“简历资料库”修改简历', true); website(); };
  $('#website').onclick = () => website(); $('#register').onclick = () => website();
  $('#user-name').onclick = () => loggedIn ? info('账号已同步', '插件使用与手机、电脑、客户端相同的小麦账号。\n修改昵称和会员管理请前往官网个人中心。') : openLogin();
  $('#vip-button').onclick = () => { website(); message('已打开官网，请进入个人中心开通或续费会员', true); };
  $('#more-button').onclick = () => { const opening = $('#more-menu').hidden; closeMenus(); $('#more-menu').hidden = !opening; $('#more-button').setAttribute('aria-expanded', String(opening)); };
  $('#logout').onclick = async () => { await api('logout'); clearAccount(); closeMenus(); await syncPage().catch(() => {}); message('已退出登录', true); };
  $('#login-close').onclick = () => { $('#password').value = ''; $('#login-dialog').close(); };
  $('#login-dialog').addEventListener('close', () => { $('#password').value = ''; });
  $('#login-form').onsubmit = async event => {
    event.preventDefault();
    const phone = $('#phone').value.trim(), password = $('#password').value;
    if (!/^1\d{10}$/.test(phone)) { $('#login-error').textContent = '请输入正确的 11 位手机号'; return; }
    if (!password) { $('#login-error').textContent = '请输入密码'; return; }
    $('#login-submit').disabled = true; $('#login-error').textContent = '';
    try {
      await api('/api/auth/password-login', {method: 'POST', body: {phone, password}});
      $('#login-dialog').close(); selectedId = ''; await chrome.storage.local.remove('selectedResumeId');
      await loadAccount(); await refreshResume();
    } catch (error) { $('#login-error').textContent = error.message; }
    finally { $('#password').value = ''; $('#login-submit').disabled = false; }
  };
  $('#mode-help').onclick = () => info('一键填入方式', '仅填新增内容：保留网页已有值，只填写空白字段。\n全部覆盖重填：使用当前简历覆盖可匹配字段，网页原值会被替换。\n\n两种方式均不会自动保存或提交，填写后请核对。');
  $('#help').onclick = () => info('使用帮助', '1. 登录相同的小麦账号，选择简历。\n2. 修改官网简历后，点击“刷新简历”。\n3. 在网申网页打开所需的简历模块。\n4. 打开悬浮操作框，点击“一键填入”。\n5. 核对填写结果，自行保存或提交。\n\n悬浮框顶部可拖动，右上角 × 可关闭。控件失败时，展开“控件调试”查看原因或导出报告。');
  $('#support').onclick = async () => {
    info('联系客服', '正在获取官方客服二维码…');
    try {
      const config = await api('/api/config');
      $('#info-content').textContent = config.customerQrImage ? '微信扫码联系官方客服' : '暂未配置客服二维码，请前往官网个人中心查看联系方式。';
      if (config.customerQrImage) {
        const url = new URL(config.customerQrImage, API);
        if (url.protocol !== 'https:') throw Error('客服图片地址无效');
        const image = document.createElement('img'); image.src = url.href; image.alt = '官方客服二维码'; $('#info-content').append(image);
      }
    } catch (error) { $('#info-content').textContent = '客服信息加载失败，请前往官网个人中心查看。'; }
  };
  $('#info-close').onclick = () => $('#info-dialog').close();
  $('#open-floating').onclick = async () => {
    const button = $('#open-floating'); button.disabled = true;
    try { await pageCommand('show'); message('悬浮操作框已打开，可拖动顶部调整位置', true); }
    catch (error) { message(error.message); }
    finally { button.disabled = false; }
  };
  (async () => {
    $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
    const stored = await chrome.storage.local.get(['selectedResumeId', 'fillMode', 'missingReminder']);
    selectedId = stored.selectedResumeId || ''; mode = stored.fillMode === 'overwrite' ? 'overwrite' : 'preserve'; renderMode();
    $('#missing-reminder').checked = stored.missingReminder !== false;
    const tabs = await chrome.tabs.query({active: true, currentWindow: true}); activeTabId = tabs[0]?.id;
    try {
      await loadAccount();
      if (loggedIn) await refreshResume(true);
      const state = await pageCommand('state').catch(() => ({}));
      if (state.missing?.length && $('#missing-reminder').checked) $('#missing-summary').textContent = '待补齐：' + state.missing.slice(0, 5).join('、') + (state.missing.length > 5 ? '等' : '');
      if (state.busy) message('网页正在填写，你可以关闭弹出页，悬浮框会继续运行', true);
    } catch (error) { message(error.message); }
  })().catch(error => message('初始化失败：' + error.message));
})();
