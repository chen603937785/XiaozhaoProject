<script setup>
import { ref } from 'vue';
import { register, passwordLogin, setToken } from '../api';

const emit = defineEmits(['close', 'login']);

const mode = ref('login');
const phone = ref('');
const password = ref('');
const promo = ref('');
const agreed = ref(false);
const showPwd = ref(false);
const status = ref('');

function switchMode(m) { mode.value = m; status.value = ''; }

async function submit() {
  if (!phone.value || !password.value) {
    status.value = '请输入手机号和密码';
    return;
  }
  if (mode.value === 'register' && !agreed.value) {
    status.value = '请先勾选同意用户协议';
    return;
  }
  try {
    if (mode.value === 'register') {
      await register(phone.value, password.value, promo.value);
      status.value = '注册成功，请登录';
      mode.value = 'login';
      password.value = '';
      promo.value = '';
      agreed.value = false;
    } else {
      const data = await passwordLogin(phone.value, password.value);
      setToken(data.token);
      status.value = '登录成功';
      emit('login', data);
      setTimeout(() => emit('close'), 600);
    }
  } catch (e) {
    status.value = e.message || '操作失败';
  }
}
</script>

<template>
  <div class="modal-mask">
    <div class="modal">
      <!-- 标题区 -->
      <div class="modal-header">
        <div class="header-left">
          <div class="title-row">
            <span class="title">{{ mode === 'register' ? '注册账号' : '欢迎登录' }}</span>
            <span class="subtitle">已有账号可直接登录</span>
          </div>
        </div>
        <div class="close-btn" @click="emit('close')">✕</div>
      </div>

      <!-- 登录/注册切换 -->
      <div class="mode-tabs">
        <div class="mode-tab" :class="{ active: mode === 'login' }" @click="switchMode('login')">登录</div>
        <div class="mode-tab" :class="{ active: mode === 'register' }" @click="switchMode('register')">注册</div>
      </div>

      <!-- 表单 -->
      <div class="form">
        <div class="field">
          <div class="label">手机号</div>
          <input class="input" type="text" v-model="phone" placeholder="请输入手机号" />
        </div>

        <div class="field">
          <div class="label">密码</div>
          <div class="input-wrap">
            <input class="input" :type="showPwd ? 'text' : 'password'" v-model="password" placeholder="请输入密码（至少 6 位）" />
            <span class="eye" @click="showPwd = !showPwd">{{ showPwd ? '👁' : '👁‍🗨' }}</span>
          </div>
        </div>

        <div class="field" v-if="mode === 'register'">
          <div class="label light">推广码（可不填）</div>
          <input class="input" type="text" v-model="promo" placeholder="有推广码可在这里填写" />
        </div>

        <button class="submit" @click="submit">{{ mode === 'register' ? '立即注册' : '立即登录' }}</button>
        <div v-if="status" class="form-status">{{ status }}</div>

        <div class="agreement">
          <div class="checkbox" :class="{ checked: agreed }" @click="agreed = !agreed">
            <span v-if="agreed" class="check">✓</span>
          </div>
          <span class="agreement-text">
            我已阅读并同意 <a class="link" @click.stop>《用户协议》</a> 和 <a class="link" @click.stop>《隐私政策》</a>
          </span>
        </div>

        <div class="tip">温馨提示：请确保网络正常，不要开代理</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(124, 145, 170, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 540px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(30, 60, 100, 0.18);
  padding: 34px 38px 48px;
  box-sizing: border-box;
}

/* 标题区 */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.title {
  font-size: 26px;
  font-weight: 700;
  color: #1e2b3d;
}
.subtitle {
  font-size: 14px;
  color: #8fa1b6;
}
.close-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #eff7ff;
  color: #69809a;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.close-btn:hover { background: #e3f0ff; }

/* 切换标签 */
.mode-tabs {
  height: 58px;
  background: #f1f7fd;
  border-radius: 14px;
  display: flex;
  padding: 4px;
  margin: 20px 0 20px;
  box-sizing: border-box;
}
.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #8fa1b6;
  border-radius: 12px;
  cursor: pointer;
}
.mode-tab.active {
  background: #ffffff;
  color: #1e3a6e;
  font-weight: 700;
  border: 2px solid #f0a000;
  box-shadow: 0 4px 14px rgba(240, 160, 0, 0.18);
}

/* 表单 */
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.field { display: flex; flex-direction: column; gap: 8px; }
.label {
  font-size: 14px;
  font-weight: 600;
  color: #4a5f78;
}
.label.light { color: #9aaabf; font-weight: 500; }
.input {
  height: 52px;
  border: 1.5px solid #d6e7fa;
  border-radius: 13px;
  background: #fbfdff;
  padding: 0 18px;
  font-size: 14px;
  color: #1e2b3d;
  outline: none;
  box-sizing: border-box;
  width: 100%;
}
.input::placeholder { color: #8fa1b6; }
.input:focus { border-color: #3988ee; }
.input-wrap { position: relative; }
.input-wrap .input { padding-right: 52px; }
.eye {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  cursor: pointer;
  color: #9aaabf;
}

/* 注册按钮 */
.submit {
  height: 54px;
  border: none;
  border-radius: 13px;
  background: linear-gradient(135deg, #2f80ed, #5db4f5);
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(47, 128, 237, 0.28);
}

/* 协议 */
.agreement {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}
.checkbox {
  width: 22px;
  height: 22px;
  border: 1.5px solid #c5d2e0;
  border-radius: 6px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-sizing: border-box;
}
.checkbox.checked { background: #3988ee; border-color: #3988ee; }
.check {
  color: #ffffff;
  font-size: 14px;
  line-height: 1;
}
.agreement-text {
  font-size: 14px;
  color: #69809a;
  line-height: 1.5;
}
.link {
  color: #2779d5;
  font-weight: 600;
  cursor: pointer;
}

/* 提示 */
.tip {
  font-size: 13px;
  color: #9aaabf;
  margin-top: -4px;
}
.form-status {
  font-size: 13px;
  color: #35b779;
  text-align: center;
  margin-top: 2px;
}
</style>
