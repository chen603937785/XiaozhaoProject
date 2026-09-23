// 网页版和 API 同源部署；桌面版继续访问线上域名。
const BASE_URL = import.meta.env.VITE_CAMPUS_WEB === 'true' ? '' : 'https://my88ai.com';

export function getToken() {
  return localStorage.getItem('token') || '';
}
export function setToken(token) {
  localStorage.setItem('token', token);
}
export function clearToken() {
  localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE_URL + path, { ...options, headers });
  const json = await res.json();
  if (json.code !== 200) throw new Error(json.message || '请求失败');
  return json.data;
}

function get(path) { return request(path); }
function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
}
function del(path) { return request(path, { method: 'DELETE' }); }
function put(path, body) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
}

// 筛选项字典（含省-市二级结构）
export function fetchMeta() {
  return get('/api/meta/filters');
}

// 岗位列表（分页 + 筛选）
export function fetchJobs(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return get(`/api/jobs?${qs}`);
}

export function fetchCompanies(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return get(`/api/companies?${qs}`);
}

// 登录 / 注册
export function register(phone, password, promo) {
  return post('/api/auth/register', { phone, password, promo });
}
export function passwordLogin(phone, password) {
  return post('/api/auth/password-login', { phone, password });
}

// 简历
export function getResume() { return get('/api/user/resume'); }
export function saveResume(data) { return post('/api/user/resume', data); }

// 简历资料库
export function getProfile() { return get('/api/profile'); }
export function saveProfile(data) { return put('/api/profile', data); }
export function getResumes() { return get('/api/resumes'); }
export function createResume(data) { return post('/api/resumes', data); }
export function getResumeDetail(id) { return get(`/api/resumes/${id}`); }
export function updateResume(id, data) { return put(`/api/resumes/${id}`, data); }
export function deleteResume(id) { return del(`/api/resumes/${id}`); }
export function copyResume(id) { return post(`/api/resumes/${id}/copy`); }
export function setResumeDefault(id) { return post(`/api/resumes/${id}/set-default`); }
export function listSection(id, type) { return get(`/api/resumes/${id}/sections/${type}`); }
export function addSection(id, type, data) { return post(`/api/resumes/${id}/sections/${type}`, data); }
export function updateSection(id, type, itemId, data) { return put(`/api/resumes/${id}/sections/${type}/${itemId}`, data); }
export function deleteSection(id, type, itemId) { return del(`/api/resumes/${id}/sections/${type}/${itemId}`); }

// 用户信息
export function getUserInfo() { return get('/api/user/info'); }
export function updateNickname(nickname) { return post('/api/user/nickname', { nickname }); }

// 偏好（与我匹配）
export function getPreference() { return get('/api/user/preference'); }
export function savePreference(data) { return post('/api/user/preference', data); }

// 收藏
export function getFavorites() { return get('/api/favorites'); }
export function addFavorite(jobId) { return post('/api/favorites', { jobId }); }
export function removeFavorite(jobId) { return del(`/api/favorites/${jobId}`); }

// 岗位状态（求职进度 + 关注岗位）
export function getJobStatusOverview(planId) {
  const qs = planId ? '?planId=' + encodeURIComponent(planId) : '';
  return get('/api/job-status/overview' + qs);
}
export function followJob(jobId, planId) { return post('/api/job-status/follow', { jobId, planId }); }
export function unfollowJob(jobId) { return del(`/api/job-status/follow/${jobId}`); }
export function isFollowed(jobId) { return get(`/api/job-status/followed/${jobId}`); }
export function getJobStatusList(status, planId) {
  const params = [];
  if (status) params.push('status=' + encodeURIComponent(status));
  if (planId) params.push('planId=' + encodeURIComponent(planId));
  const qs = params.length ? '?' + params.join('&') : '';
  return get('/api/job-status/list' + qs);
}
export function updateJobStatus(jobId, mainStatus, subStatus, reason) {
  return put(`/api/job-status/${jobId}/status`, { mainStatus, subStatus, reason });
}
export function updateExpectedStart(jobId, expectedStartAt) {
  return put(`/api/job-status/${jobId}/expected-start`, { expectedStartAt });
}

// 求职计划
export function getPlans() { return get('/api/plans'); }
export function createPlan(data) { return post('/api/plans', data); }
export function updatePlan(id, data) { return put(`/api/plans/${id}`, data); }
export function setPlanActive(id) { return post(`/api/plans/${id}/active`); }
export function pausePlan(id) { return post(`/api/plans/${id}/pause`); }
export function completePlan(id) { return post(`/api/plans/${id}/complete`); }
export function archivePlan(id) { return post(`/api/plans/${id}/archive`); }
export function restorePlan(id) { return post(`/api/plans/${id}/restore`); }
export function deletePlan(id) { return del(`/api/plans/${id}`); }
export function moveJob(jobId, targetPlanId, resetStatus) {
  return post('/api/plans/move-job', { jobId, targetPlanId, resetStatus });
}

// 待办
export function getTodos(planId) {
  const qs = planId ? '?planId=' + encodeURIComponent(planId) : '';
  return get('/api/todos' + qs);
}
export function createTodo(data) { return post('/api/todos', data); }
export function updateTodo(id, data) { return put(`/api/todos/${id}`, data); }
export function deleteTodo(id) { return del(`/api/todos/${id}`); }

// 版本更新
export function getLatestVersion() { return get('/api/version/latest'); }

// 兑换码
export function redeemCode(code) { return post('/api/redeem', { code }); }

// 客服微信二维码（返回完整图片 URL，未配置则返回空串）
export function getCustomerQr() {
  return get('/api/config').then(cfg => {
    const p = cfg && cfg.customerQrImage;
    return p ? BASE_URL + p : '';
  });
}
