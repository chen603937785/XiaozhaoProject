const API = 'https://my88ai.com';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'xiaomai-page-command') {
    (async () => {
      try {
        if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('popup.html')))
          throw new Error('无效请求来源');
        if (!['state', 'show', 'hide', 'reload'].includes(message.command) || !Number.isInteger(message.tabId))
          throw new Error('无效页面操作');
        try {
          const reply = await chrome.tabs.sendMessage(message.tabId, {type: 'xiaomai-panel-command', command: message.command});
          sendResponse({ok: true, data: reply});
        } catch (_) {
          if (message.command === 'state' || message.command === 'hide') {
            sendResponse({ok: true, data: {visible: false, busy: false}}); return;
          }
          await inject(message.tabId);
          const reply = await chrome.tabs.sendMessage(message.tabId, {type: 'xiaomai-panel-command', command: message.command});
          sendResponse({ok: true, data: reply});
        }
      } catch (_) { sendResponse({ok: false, error: '此页面无法使用悬浮框，请打开正常的网申网页后重试'}); }
    })();
    return true;
  }
  if (message?.type !== 'xiaomai-api') return false;
  (async () => {
    try {
      if (sender.id !== chrome.runtime.id) throw new Error('无效请求来源');
      if (message.path === 'session') {
        const stored = await chrome.storage.local.get(['token', 'phone']);
        sendResponse({ok: true, data: {loggedIn: !!stored.token, phone: stored.phone || ''}});
        return;
      }
      if (message.path === 'logout') {
        await chrome.storage.local.remove(['token', 'phone']);
        sendResponse({ok: true, data: {loggedIn: false}});
        return;
      }
      const login = message.path === '/api/auth/password-login' && message.method === 'POST';
      const read = (/^\/api\/resumes(?:\/\d+)?$/.test(message.path)
        || ['/api/resume-schema', '/api/user/info', '/api/job-status/list', '/api/config'].includes(message.path))
        && (!message.method || message.method === 'GET');
      if (!login && !read) throw new Error('不支持的接口');
      const init = {
        method: message.method || 'GET',
        headers: {'Content-Type': 'application/json'},
        signal: AbortSignal.timeout(15000),
        credentials: 'omit'
      };
      if (!login && message.path !== '/api/config') {
        const stored = await chrome.storage.local.get('token');
        if (!stored.token) throw new Error('请先登录小麦账号');
        init.headers.Authorization = 'Bearer ' + stored.token;
      }
      if (message.body !== undefined) init.body = JSON.stringify(message.body);
      const response = await fetch(API + message.path, init);
      const data = await response.json();
      if (data.code === 401 || response.status === 401) await chrome.storage.local.remove(['token', 'phone']);
      if (login && data.code === 200 && data.data?.token) {
        await chrome.storage.local.set({token: data.data.token, phone: message.body.phone});
        // 账号凭证留在扩展后台，页面面板只需要登录结果。
        data.data = {loggedIn: true};
      }
      sendResponse({ok: response.ok, status: response.status, data});
    } catch (error) {
      sendResponse({ok: false, status: 0, error: String(error?.message || error)});
    }
  })();
  return true;
});

async function inject(tabId) {
  await chrome.scripting.insertCSS({target: {tabId}, files: ['panel.css']});
  await chrome.scripting.executeScript({target: {tabId}, world: 'MAIN', files: ['network-hook.js']});
  await chrome.scripting.executeScript({target: {tabId}, files: ['vendor/ai-helpers.js', 'vendor/custom-controls.js', 'vendor/control-adapters.js', 'vendor/field-scan.js', 'controls.js', 'wintalent-controls.js', 'phoenix-controls.js', 'engine.js', 'resume-schema.js', 'fields.js', 'content.js']});
}
