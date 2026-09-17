// 半自动简历填写助手（注入到 child webview）
// 简历数据由 Rust 端注入为 window.__RESUME_DATA__ = { "姓名": "小华", ... }
(function () {
  const resumeData = window.__RESUME_DATA__ || {};

  // 字段识别规则：简历字段 -> 网申字段关键词
  const FIELD_RULES = [
    { key: '姓名', keywords: ['姓名', '真实姓名', '中文名', '姓名/昵称'] },
    { key: '英文姓名', keywords: ['英文名', 'english name', '拼音'] },
    { key: '性别', keywords: ['性别'] },
    { key: '出生日期', keywords: ['出生日期', '出生年月', '生日', '出生'] },
    { key: '手机号', keywords: ['手机号', '手机', '联系电话', '联系方式', '电话'] },
    { key: '邮箱', keywords: ['邮箱', '电子邮箱', '邮件', 'email'] },
    { key: '证件号码', keywords: ['身份证', '证件号', '身份证号'] },
    { key: '所在城市', keywords: ['所在城市', '现居城市', '现居住地', '居住城市'] },
    { key: '籍贯', keywords: ['籍贯', '户籍'] },
    { key: '政治面貌', keywords: ['政治面貌'] },
    { key: '民族', keywords: ['民族'] },
    { key: '微信号', keywords: ['微信', '微信号'] },
    { key: '学校', keywords: ['学校', '院校', '毕业院校', '就读学校', '学校名称'] },
    { key: '专业', keywords: ['专业', '所学专业', '专业名称'] },
    { key: '学历', keywords: ['学历', '最高学历', '学位'] },
    { key: '毕业时间', keywords: ['毕业时间', '毕业日期', '毕业年份'] },
    { key: 'GPA', keywords: ['gpa', '绩点', '平均成绩'] },
    { key: '公司', keywords: ['实习单位', '工作单位', '公司名称'] },
    { key: '职位', keywords: ['实习职位', '职位', '岗位名称'] },
    { key: '期望城市', keywords: ['期望城市', '工作地点', '工作城市', '期望工作地点'] },
    { key: '期望薪资', keywords: ['期望薪资', '薪资', '期望月薪', '期望年薪'] },
    { key: '自我评价', keywords: ['自我评价', '个人优势', '自我介绍', '个人简介', '自我描述'] }
  ];

  // 不应触发的字段
  const SKIP_TYPES = ['password', 'file', 'submit', 'button', 'reset', 'image', 'hidden'];
  const SKIP_KEYWORDS = ['密码', '验证码', '支付', '银行卡', '登录', '验证'];

  function fieldText(el) {
    const parts = [];
    parts.push(el.getAttribute('placeholder') || '');
    parts.push(el.getAttribute('name') || '');
    parts.push(el.getAttribute('id') || '');
    parts.push(el.getAttribute('aria-label') || '');
    parts.push(el.getAttribute('title') || '');
    if (el.labels && el.labels.length) {
      for (const lb of el.labels) parts.push(lb.textContent || '');
    }
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      if (p.tagName === 'LABEL') parts.push(p.textContent || '');
      p = p.parentElement;
    }
    return parts.join(' ').toLowerCase();
  }

  function shouldSkip(el) {
    const t = (el.type || '').toLowerCase();
    if (SKIP_TYPES.includes(t)) return true;
    const text = fieldText(el);
    return SKIP_KEYWORDS.some(k => text.includes(k));
  }

  function matchField(el) {
    const text = fieldText(el);
    for (const rule of FIELD_RULES) {
      for (const kw of rule.keywords) {
        if (text.includes(kw.toLowerCase())) {
          return { key: rule.key, value: resumeData[rule.key] || '' };
        }
      }
    }
    return null;
  }

  // 受控组件赋值
  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ===== 候选浮层 =====
  let popup = null;
  let activeField = null;

  function createPopup() {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = '__autofill_popup__';
    popup.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'background:#fff',
      'border:1px solid #dce7f4', 'border-radius:12px',
      'box-shadow:0 8px 24px rgba(30,53,87,0.16)', 'padding:12px',
      'min-width:240px', 'max-width:340px', 'font-size:13px', 'line-height:1.6',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');
    document.body.appendChild(popup);
    return popup;
  }

  function hidePopup() {
    if (popup) { popup.remove(); popup = null; }
    if (activeField) {
      activeField.style.outline = '';
      activeField = null;
    }
  }

  function showPopup(el, field) {
    hidePopup();
    activeField = el;
    el.style.outline = '2px solid #4b87e5';
    const box = createPopup();

    // 字段名 + 智能识别描述
    let html = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
    html += '<span style="font-weight:600;color:#17304f;">' + field.key + '</span>';
    html += '<span style="font-size:11px;color:#b0c0d6;">已智能识别内容</span>';
    html += '</div>';

    if (field.value) {
      // 有值：显示候选
      html += '<div class="af-item" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;background:#eaf2ff;cursor:pointer;color:#17304f;">';
      html += '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">' + escapeHtml(String(field.value)) + '</span>';
      html += '<span style="color:#4b87e5;font-weight:600;flex-shrink:0;">点击填入</span>';
      html += '</div>';
    } else {
      // 无值：提示简历未完善
      html += '<div style="padding:8px 10px;border-radius:8px;background:#f7fafd;color:#96a8bd;font-size:12px;">简历未完善，请到简历中完善</div>';
    }
    box.innerHTML = html;

    const item = box.querySelector('.af-item');
    if (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault(); // 防止 blur 先触发
        setNativeValue(el, field.value);
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        hidePopup();
        flashToast('已填入' + field.key);
      });
    }

    positionPopup(el, box);
  }

  function positionPopup(el, box) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = box.offsetWidth || 260;
    const bh = box.offsetHeight || 80;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (y + bh > vh - 12) y = rect.top - bh - 8;
    if (y < 12) y = 12;
    if (x + bw > vw - 12) x = vw - bw - 12;
    if (x < 12) x = 12;
    box.style.left = x + 'px';
    box.style.top = y + 'px';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 轻提示
  function flashToast(text) {
    const old = document.getElementById('__autofill_toast__');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = '__autofill_toast__';
    t.textContent = text;
    t.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483647', 'background:rgba(23,48,79,0.85)', 'color:#fff',
      'padding:8px 16px', 'border-radius:20px', 'font-size:13px'
    ].join(';');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }

  // ===== 事件监听 =====
  let lastFocusTime = 0;
  document.addEventListener('focusin', function (e) {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
    if (shouldSkip(el)) return;
    const field = matchField(el);
    if (field) {
      lastFocusTime = Date.now();
      showPopup(el, field);
    }
  }, true);

  document.addEventListener('focusout', function () {
    // 刚聚焦后若立即失焦（如 SPA 重渲染），延长延迟，避免浮层闪烁消失
    const sinceFocus = Date.now() - lastFocusTime;
    const delay = sinceFocus < 300 ? 600 : 300;
    setTimeout(() => {
      if (popup && !popup.matches(':hover') && (!activeField || document.activeElement !== activeField)) hidePopup();
    }, delay);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hidePopup();
    if (e.key === 'Enter' && popup && activeField) {
      const item = popup.querySelector('.af-item');
      if (item) item.click();
    }
  }, true);

  document.addEventListener('scroll', function () {
    if (popup && activeField) positionPopup(activeField, popup);
  }, true);

  // 拦截 target="_blank" 链接，改为当前窗口导航（child webview 无新窗口）
  document.addEventListener('click', function (e) {
    let a = e.target;
    while (a && a.tagName !== 'A') a = a.parentElement;
    if (a && a.target === '_blank' && a.href) {
      e.preventDefault();
      window.location.href = a.href;
    }
  }, true);

  // 拦截 window.open，改为当前窗口导航
  window.open = function (url) {
    if (url) {
      try { window.location.href = String(url); } catch (e) {}
    }
    return null;
  };

  // ===== 一键填全部 =====
  function fillAll() {
    const inputs = document.querySelectorAll('input, textarea, select');
    let filled = 0, skipped = 0, incomplete = 0;
    for (const el of inputs) {
      if (shouldSkip(el)) continue;
      const field = matchField(el);
      if (!field) continue;
      if (!field.value) { incomplete++; continue; }
      if (el.value && el.value.trim()) { skipped++; continue; }
      setNativeValue(el, field.value);
      filled++;
    }
    let msg = '一键填入：成功 ' + filled + ' 项';
    if (incomplete) msg += '，未完善 ' + incomplete + ' 项';
    flashToast(msg);
  }

  function createFillAllButton() {
    if (document.getElementById('__fill_all_btn__')) return;
    const btn = document.createElement('button');
    btn.id = '__fill_all_btn__';
    btn.textContent = '⚡ 一键填全部';
    btn.style.cssText = [
      'position:fixed', 'right:24px', 'bottom:24px', 'z-index:2147483646',
      'padding:10px 18px', 'border:none', 'border-radius:22px',
      'background:linear-gradient(135deg,#5b97f2,#4a86e8)',
      'color:#fff', 'font-size:13px', 'font-weight:600',
      'cursor:pointer', 'box-shadow:0 6px 18px rgba(74,134,232,0.4)'
    ].join(';');
    btn.addEventListener('click', fillAll);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFillAllButton);
  } else {
    createFillAllButton();
  }
  setTimeout(createFillAllButton, 1500);
})();
