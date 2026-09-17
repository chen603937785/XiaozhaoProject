<script setup>
import { ref, computed } from 'vue';
import { updateNickname, redeemCode } from '../api';

const props = defineProps({
  phone: String,
  nickname: String,
  isVip: Boolean,
  vipExpire: String
});
const emit = defineEmits(['close', 'logout', 'updateNickname', 'redeemed']);

const codeInput = ref('');
const redeeming = ref(false);
const redeemMsg = ref('');

async function doRedeem() {
  const code = codeInput.value.trim();
  if (!code) { redeemMsg.value = '请输入兑换码'; return; }
  redeeming.value = true;
  redeemMsg.value = '';
  try {
    const data = await redeemCode(code);
    const label = data.planType === 'MONTH' ? '月卡' : data.planType === 'QUARTER' ? '季卡' : '年卡';
    redeemMsg.value = '兑换成功：' + label + ' +' + data.days + ' 天';
    codeInput.value = '';
    emit('redeemed', data);
  } catch (e) {
    redeemMsg.value = e.message || '兑换失败';
  } finally {
    redeeming.value = false;
  }
}

const editingNickname = ref(false);
const nicknameInput = ref('');
const savingNickname = ref(false);

const displayName = computed(() => {
  if (props.nickname) return props.nickname;
  return props.phone ? '用户' + String(props.phone).slice(-4) : '未登录';
});

function startEditNickname() {
  nicknameInput.value = props.nickname || '';
  editingNickname.value = true;
}

async function saveNickname() {
  const name = nicknameInput.value.trim();
  if (!name) return;
  savingNickname.value = true;
  try {
    await updateNickname(name);
    emit('updateNickname', name);
    editingNickname.value = false;
  } catch (e) {} finally {
    savingNickname.value = false;
  }
}

const tab = ref('plan');
const selectedPlan = ref(1);

const plans = [
  { name: '月卡', tag: '1 个月', desc: '适合短期求职，快速体验全部会员功能，随时可续', price: '29' },
  { name: '季卡', tag: '3 个月', desc: '覆盖整个秋招季，持续追踪岗位，性价比之选', price: '79' },
  { name: '年卡', tag: '12 个月', desc: '全年求职护航，无限次使用，综合最优价值', price: '199' }
];

const currentPlan = computed(() => plans[selectedPlan.value]);
</script>

<template>
  <div class="vip-mask">
    <div class="vip-modal">
      <!-- 标题区 -->
      <div class="vip-header">
        <div class="vip-header-left">
          <div class="vip-brand">求职助手</div>
          <div class="vip-title">账号与会员</div>
        </div>
        <div class="vip-close" @click="emit('close')">✕</div>
      </div>

      <!-- 账号状态卡片 -->
      <div class="acct-card">
        <div class="acct-avatar">👤</div>
        <div class="acct-meta">
          <div v-if="editingNickname" class="nickname-edit">
            <input v-model="nicknameInput" class="nickname-input" placeholder="输入昵称" @keyup.enter="saveNickname" />
            <button class="nickname-save" :disabled="savingNickname || !nicknameInput.trim()" @click="saveNickname">保存</button>
            <button class="nickname-cancel" @click="editingNickname = false">取消</button>
          </div>
          <div v-else class="acct-name-row">
            <span class="acct-name">{{ displayName }}</span>
            <span class="nickname-edit-btn" title="设置昵称" @click="startEditNickname">✎</span>
          </div>
          <div class="acct-type">{{ isVip ? (vipExpire ? '会员 · 到期 ' + vipExpire : '会员用户') : '普通用户' }}</div>
        </div>
        <button class="acct-logout" @click="emit('logout')">退出登录</button>
      </div>

      <!-- 会员切换栏 -->
      <div class="vip-tabs">
        <div class="vip-tab" :class="{ active: tab === 'plan' }" @click="tab = 'plan'">会员套餐</div>
        <div class="vip-tab" :class="{ active: tab === 'code' }" @click="tab = 'code'">兑换码</div>
      </div>

      <!-- 会员套餐内容 -->
      <template v-if="tab === 'plan'">
        <input class="promo-input" placeholder="注册时没填，可在开会员前补填" />

        <div class="plan-grid">
          <div
            v-for="(p, i) in plans"
            :key="p.name"
            class="plan-card"
            :class="{ selected: selectedPlan === i }"
            @click="selectedPlan = i"
          >
            <div class="plan-name">{{ p.name }}</div>
            <div class="plan-tag">{{ p.tag }}</div>
            <div class="plan-desc">{{ p.desc }}</div>
            <div class="plan-price">¥{{ p.price }}</div>
            <div class="plan-buy">购买</div>
          </div>
        </div>

        <!-- 支付区域 -->
        <div class="pay-panel">
          <div class="qr-card">
            <div class="qr-placeholder">二维码</div>
          </div>
          <div class="pay-info">
            <div class="pay-name">{{ currentPlan.name }}会员</div>
            <div class="pay-price">¥{{ currentPlan.price }}</div>
            <div class="pay-desc">扫码支付，支付完成后自动开通</div>
            <button class="pay-refresh">刷新支付状态</button>
          </div>
        </div>
      </template>

      <!-- 兑换码内容 -->
      <div v-else class="code-box">
        <input v-model="codeInput" class="promo-input" placeholder="请输入会员兑换码" @keyup.enter="doRedeem" />
        <button class="code-btn" :disabled="redeeming" @click="doRedeem">{{ redeeming ? '兑换中...' : '立即兑换' }}</button>
        <div v-if="redeemMsg" class="redeem-msg" :class="{ error: redeemMsg.includes('失败') || redeemMsg.includes('不存在') || redeemMsg.includes('已使用') || redeemMsg.includes('过期') }">{{ redeemMsg }}</div>
      </div>

      <div class="vip-tip">温馨提示：请确保网络正常，不要开代理</div>
    </div>
  </div>
</template>

<style scoped>
.vip-mask {
  position: fixed;
  inset: 0;
  background: rgba(120, 145, 172, 0.42);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.vip-modal {
  width: 620px;
  background: #ffffff;
  border-radius: 28px;
  border: 1px solid #eef4fb;
  box-shadow: 0 24px 64px rgba(30, 60, 100, 0.16);
  padding: 30px 34px 26px;
  box-sizing: border-box;
}

/* 标题区 */
.vip-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}
.vip-brand {
  font-size: 14px;
  font-weight: 600;
  color: #3286ee;
  margin-bottom: 8px;
}
.vip-title {
  font-size: 26px;
  font-weight: 700;
  color: #18385f;
}
.vip-close {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #eef7ff;
  color: #647b96;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.vip-close:hover { background: #e3f0ff; }

/* 账号状态卡片 */
.acct-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f0f7ff;
  border: 1px solid #d4e6f8;
  border-radius: 18px;
  margin-bottom: 20px;
}
.acct-avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2f80ed, #5db4f5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.acct-meta { flex: 1; }
.acct-name { font-size: 18px; font-weight: 700; color: #1b2b40; }
.acct-name-row { display: flex; align-items: center; gap: 8px; }
.nickname-edit-btn { font-size: 14px; color: #94a6ba; cursor: pointer; }
.nickname-edit-btn:hover { color: #3286ee; }
.nickname-edit { display: flex; align-items: center; gap: 6px; }
.nickname-input { flex: 1; height: 32px; border: 1.5px solid #d4e6f8; border-radius: 8px; padding: 0 10px; font-size: 14px; color: #1b2b40; outline: none; }
.nickname-input:focus { border-color: #3286ee; }
.nickname-save { height: 32px; padding: 0 12px; border: none; border-radius: 8px; background: #3286ee; color: #fff; font-size: 13px; cursor: pointer; }
.nickname-save:disabled { opacity: 0.5; cursor: not-allowed; }
.nickname-cancel { height: 32px; padding: 0 12px; border: 1px solid #d4e6f8; border-radius: 8px; background: #fff; color: #647b96; font-size: 13px; cursor: pointer; }
.acct-type { font-size: 13px; color: #647b96; margin-top: 4px; }
.acct-logout {
  padding: 8px 20px;
  border: 1px solid #d4e6f8;
  border-radius: 10px;
  background: #ffffff;
  color: #647b96;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}
.acct-logout:hover { border-color: #3286ee; color: #3286ee; }

/* 会员切换栏 */
.vip-tabs {
  height: 54px;
  background: #f0f7ff;
  border-radius: 16px;
  display: flex;
  padding: 5px;
  margin-bottom: 22px;
  box-sizing: border-box;
}
.vip-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #94a6ba;
  border-radius: 12px;
  cursor: pointer;
}
.vip-tab.active {
  background: #ffffff;
  color: #18385f;
  font-weight: 700;
  border: 2px solid #f0a000;
}

/* 推广码输入框 */
.promo-input {
  width: 100%;
  height: 46px;
  border: 1.5px solid #d4e6f8;
  border-radius: 14px;
  background: #ffffff;
  padding: 0 18px;
  font-size: 14px;
  color: #1b2b40;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 18px;
}
.promo-input::placeholder { color: #94a6ba; }
.promo-input:focus { border-color: #3286ee; }

/* 套餐卡片 */
.plan-grid {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}
.plan-card {
  flex: 1;
  padding: 16px;
  border: 1.5px solid #d4e6f8;
  border-radius: 18px;
  background: #ffffff;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
.plan-card.selected { border-color: #3286ee; box-shadow: 0 4px 16px rgba(50, 134, 238, 0.12); }
.plan-name { font-size: 17px; font-weight: 700; color: #1b2b40; }
.plan-tag {
  display: inline-block;
  padding: 3px 10px;
  background: #f0f7ff;
  color: #3286ee;
  border-radius: 6px;
  font-size: 12px;
  margin-top: 8px;
}
.plan-desc { font-size: 13px; color: #647b96; line-height: 1.6; margin-top: 10px; min-height: 40px; }
.plan-price { font-size: 27px; font-weight: 700; color: #3286ee; margin-top: 10px; }
.plan-buy {
  position: absolute;
  right: 14px;
  bottom: 14px;
  padding: 6px 16px;
  background: linear-gradient(135deg, #2f80ed, #5db4f5);
  color: #ffffff;
  border-radius: 16px;
  font-size: 13px;
}

/* 支付区域 */
.pay-panel {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 20px;
  background: #f4f8fd;
  border: 1px solid #d4e6f8;
  border-radius: 18px;
}
.qr-card {
  width: 92px;
  height: 92px;
  background: #ffffff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.qr-placeholder { font-size: 13px; color: #94a6ba; }
.pay-info { flex: 1; }
.pay-name { font-size: 16px; font-weight: 700; color: #1b2b40; }
.pay-price { font-size: 22px; font-weight: 700; color: #3286ee; margin-top: 4px; }
.pay-desc { font-size: 13px; color: #647b96; margin-top: 6px; }
.pay-refresh {
  margin-top: 12px;
  padding: 8px 20px;
  border: 1px solid #d4e6f8;
  border-radius: 10px;
  background: #ffffff;
  color: #3286ee;
  font-size: 13px;
  cursor: pointer;
}

/* 兑换码 */
.code-box { margin-bottom: 18px; }
.code-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #2f80ed, #5db4f5);
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.code-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.redeem-msg { margin-top: 10px; font-size: 13px; color: #35b779; text-align: center; }
.redeem-msg.error { color: #e35d5d; }

.vip-tip { font-size: 13px; color: #94a6ba; margin-top: 16px; text-align: center; }
</style>
