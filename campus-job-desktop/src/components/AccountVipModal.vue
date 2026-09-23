<script setup>
import { computed, ref } from 'vue';
import taobaoShopQr from '../assets/taobao-shop-qr.jpg';
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
const showShop = ref(false);
const copyMessage = ref('');
const TAOBAO_CODE = '【淘宝】https://e.tb.cn/h.8wgjIq2YZ34lcLQ?tk=jbxiTlHwFYN MF278 ';

const vipExpiring = computed(() => {
  if (!props.isVip || !props.vipExpire) return false;
  const expire = new Date(props.vipExpire + 'T00:00:00');
  return (expire - new Date()) / 86400000 < 7;
});

async function copyTaobaoCode() {
  try {
    await navigator.clipboard.writeText(TAOBAO_CODE);
    copyMessage.value = '口令已复制，打开淘宝即可跳转';
  } catch {
    copyMessage.value = '复制失败，请长按口令手动复制';
  }
}

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
      <div class="vip-layout">
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
          <div class="acct-type" :class="{ expiring: vipExpiring }">{{ isVip ? (vipExpire ? '会员到期 ' + vipExpire : '会员已开通') : '普通用户 · 开通会员解锁更多功能' }}</div>
        </div>
        <button class="acct-logout" @click="emit('logout')">退出登录</button>
      </div>
      <div class="vip-main">

      <section class="membership-panel" aria-label="会员定价与功能对比">
        <div class="membership-head">
          <h3>会员定价</h3>
          <span>兑换后立即生效</span>
        </div>
        <div class="membership-prices">
          <article class="tier-month"><strong>月卡</strong><b>¥9.9</b><small>30 天</small></article>
          <article class="tier-quarter"><strong>季卡</strong><b>¥25.9</b><small>90 天</small></article>
          <article class="tier-year"><strong>年卡</strong><b>¥88</b><small>365 天</small></article>
        </div>
        <div class="membership-table-wrap">
          <table class="membership-table">
            <thead><tr><th>功能</th><th>非会员</th><th>会员</th></tr></thead>
            <tbody>
              <tr><td>岗位浏览与筛选</td><td>首页可看</td><td>全部可用</td></tr>
              <tr><td>翻页查看更多岗位</td><td>不可用</td><td>可用</td></tr>
              <tr><td>关注岗位与进度管理</td><td>不可用</td><td>可用</td></tr>
              <tr><td>网申公告与投递直达</td><td>不可用</td><td>可用</td></tr>
              <tr><td>求职计划与待办管理</td><td>不可用</td><td>可用</td></tr>
              <tr><td>简历资料与自动填写</td><td>不可用</td><td>客户端可用</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 兑换码 -->
      <div class="code-box">
        <div class="code-title">会员兑换</div>
        <div class="code-row">
          <input v-model="codeInput" class="promo-input" placeholder="请输入会员兑换码" @keyup.enter="doRedeem" />
          <button class="code-btn" :disabled="redeeming" @click="doRedeem">{{ redeeming ? '兑换中' : '立即兑换' }}</button>
        </div>
        <div v-if="redeemMsg" class="redeem-msg" :class="{ error: redeemMsg.includes('失败') || redeemMsg.includes('不存在') || redeemMsg.includes('已使用') || redeemMsg.includes('过期') }">{{ redeemMsg }}</div>
        <button class="get-code-btn" @click="showShop = true; copyMessage = ''">获取兑换码</button>
      </div>
      </div>
      </div>
      <div v-if="showShop" class="shop-mask" @click.self="showShop = false">
        <section class="shop-dialog">
          <header><h3>官方淘宝店获取</h3><button @click="showShop = false">关闭</button></header>
          <div class="shop-method"><strong>获取方式 1</strong><p>淘宝 APP 扫描店铺二维码</p><img :src="taobaoShopQr" alt="官方淘宝店铺二维码" /></div>
          <div class="shop-method"><strong>获取方式 2</strong><p>复制口令，打开淘宝自动跳转</p><code>{{ TAOBAO_CODE }}</code><button class="copy-btn" @click="copyTaobaoCode">复制口令</button><small>{{ copyMessage }}</small></div>
        </section>
      </div>
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
  width: min(980px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #ffffff;
  border-radius: 28px;
  border: 1px solid #eef4fb;
  box-shadow: 0 24px 64px rgba(30, 60, 100, 0.16);
  padding: 24px 28px 22px;
  box-sizing: border-box;
}

/* 标题区 */
.vip-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
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
.acct-type.expiring { color: #e35d5d; font-weight: 700; }
.vip-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
.vip-main { min-width: 0; }
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
.membership-panel { margin-bottom: 18px; }
.membership-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.membership-head h3 { margin: 0; font-size: 15px; color: #18385f; }
.membership-head span { color: #8aa0b7; font-size: 12px; }
.membership-prices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.membership-prices article { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px; border: 1px solid #e3ecf6; border-radius: 12px; background: #f8fbff; text-align: center; }
.membership-prices .tier-month { border-color: #d9e4ee; background: linear-gradient(180deg, #f8fbfd, #eef4f8); }
.membership-prices .tier-quarter { border-color: #efd089; background: linear-gradient(180deg, #fffaf0, #ffe8b8); }
.membership-prices .tier-year { border-color: #e2b15a; background: linear-gradient(180deg, #fff4d4, #f6c96a); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
.membership-prices strong { color: #18385f; font-size: 13px; }
.membership-prices b { color: #df5b45; font-size: 20px; line-height: 1.1; }
.membership-prices small { color: #7d92a8; font-size: 12px; }
.membership-table-wrap { overflow-x: auto; border: 1px solid #e3ecf6; border-radius: 12px; }
.membership-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.membership-table th, .membership-table td { padding: 8px 7px; border-bottom: 1px solid #edf2f7; text-align: center; white-space: nowrap; }
.membership-table th:first-child, .membership-table td:first-child { text-align: left; }
.membership-table th { color: #6d8298; background: #f7fafd; font-weight: 600; }
.membership-table td:last-child { color: #2f6f86; font-weight: 700; }
.membership-table tr:last-child td { border-bottom: 0; }
.code-title { font-size: 15px; font-weight: 600; color: #18385f; margin-bottom: 12px; }
.code-btn {
  flex: none;
  height: 42px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #2f80ed, #5db4f5);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.code-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.vip-layout .acct-card { flex-direction: column; align-items: flex-start; margin-bottom: 0; }
.vip-layout .acct-logout { margin-top: 8px; }
.code-row { display: flex; gap: 8px; }
.code-row .promo-input { flex: 1; width: auto; height: 42px; margin-bottom: 0; }
.get-code-btn { width: 100%; height: 46px; margin-top: 12px; border: 0; border-radius: 12px; background: linear-gradient(135deg, #f6c453, #e9a322); color: #5b3b08; font-size: 16px; font-weight: 800; box-shadow: 0 8px 18px rgba(214, 154, 32, .25); cursor: pointer; }
.shop-mask { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; background: rgba(24, 36, 52, .42); }
.shop-dialog { width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; background: #fff; border-radius: 18px; padding: 18px; }
.shop-dialog header { display: flex; justify-content: space-between; align-items: center; }
.shop-dialog h3 { margin: 0; color: #18385f; }
.shop-dialog header button { border: 0; border-radius: 8px; background: #f2f5f8; color: #324263; padding: 7px 12px; cursor: pointer; }
.shop-method { margin-top: 16px; }
.shop-method p, .shop-method small { color: #708294; }
.shop-method img { display: block; width: 178px; height: 178px; margin: 8px auto; border: 8px solid #fff7df; border-radius: 12px; box-shadow: 0 0 0 1px #f0d48a; }
.shop-method code { display: block; margin: 8px 0; padding: 10px; border-radius: 8px; background: #f7f8fa; color: #324263; overflow-wrap: anywhere; }
.copy-btn { border: 0; border-radius: 8px; background: #324263; color: #fff; padding: 8px 14px; cursor: pointer; }
.redeem-msg { margin-top: 10px; font-size: 13px; color: #35b779; text-align: center; }
.redeem-msg.error { color: #e35d5d; }

/* 联系客服 */
.contact-box {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px;
  background: #f7fafd;
  border: 1px solid #e3ecf6;
  border-radius: 18px;
  margin-bottom: 4px;
}
.contact-text { flex: 1; }
.contact-title { font-size: 15px; font-weight: 600; color: #18385f; margin-bottom: 6px; }
.contact-desc { font-size: 13px; color: #647b96; line-height: 1.5; }
.contact-qr {
  width: 88px;
  height: 88px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e3ecf6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.contact-qr img { width: 100%; height: 100%; object-fit: cover; }
.contact-qr-empty { font-size: 12px; color: #94a6ba; }

.vip-tip { font-size: 13px; color: #94a6ba; margin-top: 16px; text-align: center; }
</style>
