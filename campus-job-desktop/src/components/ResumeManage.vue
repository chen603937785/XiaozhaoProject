<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import ResumeField from './ResumeField.vue';
import fallbackSchema from '../../../backend/src/main/resources/resume-schema.json';
import { getToken, getResumeSchema, fetchMeta, getResumes, getResumeDetail, createResume, copyResume, updateResume, deleteResume, setResumeDefault, saveProfile, addSection, updateSection, deleteSection, reorderResumeSection } from '../api';
const emit = defineEmits(['requireLogin', 'changed']);
const props = defineProps({ loggedIn: Boolean });
const schema = ref(fallbackSchema), resumes = ref([]), detail = ref(null), provinces = ref([]);
const loading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), search = ref(''), active = ref('profile');
const edit = ref(null), draft = ref({}), original = ref(''), more = ref([]);
const modal = ref(''), pending = ref(null), confirmText = ref('');
const newName = ref(''), sourceId = ref(''), selected = ref([]);
const center = ref(null);
const modules = computed(() => schema.value.modules);
const hidden = computed(() => detail.value?.hiddenModules || []);
const visible = computed(() => modules.value.filter(m => !hidden.value.includes(m.key)));
const versions = computed(() => resumes.value.filter(r => String(r.resumeName).toLowerCase().includes(search.value.toLowerCase())));
const editingModule = computed(() => modules.value.find(m => m.key === edit.value?.type));
const dirty = computed(() => edit.value && JSON.stringify(draft.value) !== original.value);
const fields = computed(() => editingModule.value?.fields.filter(f => !f.more || more.value.includes(f.key) || present(draft.value[f.key])) || []);
const optional = computed(() => editingModule.value?.fields.filter(f => f.more && !fields.value.includes(f)) || []);
const completion = computed(() => {
  if (!detail.value) return 0;
  const p=detail.value.profile || {};
  const checks=[p.chineseName,p.phone,p.email,detail.value.targetPosition,detail.value.education?.length,detail.value.internship?.length || detail.value.experience?.length,detail.value.project?.length,detail.value.selfEvaluation];
  return Math.round(checks.filter(present).length/checks.length*100);
});
function present(v) { return v !== null && v !== undefined && v !== '' && v !== false && v !== 0; }
function rows(m) { return m.single ? [m.key === 'profile' ? detail.value?.profile || {} : detail.value || {}] : detail.value?.[m.key] || []; }
function summaries(m,row) { return m.fields.filter(f => present(row[f.key])).map(f => ({label:f.label,value:f.type==='bool'?'是':String(row[f.key]),wide:f.type==='textarea'})); }
function recordTitle(m,row) {
  const keys=['schoolName','companyName','projectName','organizationName','awardName','skillName','language','certificationName','trainingName','paperName','patentName','name'];
  return keys.map(k=>row[k]).find(present) || m.title;
}
async function run(action,success='') {
  if (busy.value) return;
  busy.value=true;error.value='';notice.value='';
  try { await action();if(success)notice.value=success; }
  catch(e) { error.value=e.message || '操作失败，请重试'; }
  finally { busy.value=false; }
}
async function refresh(id=detail.value?.id) {
  resumes.value=await getResumes();
  const target=id || (resumes.value.find(r=>r.isDefault)||resumes.value[0])?.id;
  detail.value=target ? await getResumeDetail(target) : null;
}
async function load() {
  loading.value=true;error.value='';
  try {
    if (!getToken()) { resumes.value=[];detail.value=null;return; }
    schema.value=await getResumeSchema();
    await refresh();
    try { provinces.value=(await fetchMeta()).provinces || []; } catch(e) { notice.value='城市字典暂不可用，可直接填写地址。'; }
  } catch(e) { error.value=e.message; }
  finally { loading.value=false; }
}
function guard(action) {
  if(dirty.value) { pending.value=action;confirmText.value='当前填写内容尚未保存，确定放弃这些修改吗？';modal.value='discard'; }
  else {edit.value=null;action();}
}
function choose(id) { if(detail.value?.id!==id)guard(()=>run(async()=>{await refresh(id);active.value='profile';center.value?.scrollTo({top:0});})); }
function go(key) { active.value=key;center.value?.querySelector('[data-module="'+key+'"]')?.scrollIntoView({block:'start',behavior:'smooth'}); }
function start(m,row=null) {
  guard(()=>{
    edit.value={type:m.key,id:row?.id || null};
    draft.value=Object.fromEntries(m.fields.map(f=>[f.key,row?.[f.key] ?? (f.type==='bool'?false:'')]));
    original.value=JSON.stringify(draft.value);more.value=[];go(m.key);
  });
}
function cancel() { guard(()=>{}); }
async function save() {
  if(!edit.value || !detail.value)return;
  await run(async()=>{
    const m=editingModule.value;
    if(draft.value.startDate && draft.value.endDate && !draft.value.isCurrent && draft.value.startDate>draft.value.endDate)throw new Error('结束时间不能早于开始时间');
    if(m.key==='profile')await saveProfile(draft.value);
    else if(m.single)await updateResume(detail.value.id,draft.value);
    else if(edit.value.id)await updateSection(detail.value.id,m.key,edit.value.id,draft.value);
    else await addSection(detail.value.id,m.key,draft.value);
    edit.value=null;await refresh();emit('changed');
  },editingModule.value?.key==='profile'?'基本信息已保存，并同步到所有简历版本。':'已保存，自动填写资料已更新。');
}
function ask(text,action) { guard(()=>{confirmText.value=text;pending.value=action;modal.value='confirm';}); }
async function confirm() {
  const action=pending.value;modal.value='';pending.value=null;
  if(edit.value){edit.value=null;}
  if(action)await action();
}
function newResume(source=null) {
  guard(()=>{
    newName.value=source ? source.resumeName+' 副本':'';
    sourceId.value=source?.id || '';
    selected.value=modules.value.filter(m=>m.key!=='profile').map(m=>m.key);
    modal.value='create';
  });
}
async function makeResume() {
  if(!newName.value.trim()) {error.value='请填写简历名称';return;}
  await run(async()=>{
    const body={resumeName:newName.value.trim(),modules:selected.value};
    const id=sourceId.value ? await copyResume(Number(sourceId.value),body) : await createResume(body);
    modal.value='';await refresh(id);active.value='profile';emit('changed');
  },'简历已创建');
}
async function move(m,row,direction) {
  const list=rows(m),index=list.findIndex(x=>x.id===row.id),to=index+direction;
  if(to<0||to>=list.length)return;
  guard(()=>run(async()=>{
    const ids=list.map(x=>x.id);[ids[index],ids[to]]=[ids[to],ids[index]];
    await reorderResumeSection(detail.value.id,m.key,ids);await refresh();emit('changed');
  },'排列顺序已更新'));
}
function toggleModule(m) {
  guard(()=>run(async()=>{
    const next=hidden.value.includes(m.key)?hidden.value.filter(k=>k!==m.key):[...hidden.value,m.key];
    await updateResume(detail.value.id,{hiddenModules:next});await refresh();emit('changed');
  },'模块显示已更新，已填写的数据仍会保留。'));
}
function isEditing(m,row) { return edit.value?.type===m.key && (m.single || edit.value.id===row?.id); }
onMounted(load);
watch(() => props.loggedIn, load);
</script>

<template>
  <div class="resume-workspace">
    <header class="resume-heading"><div class="heading-copy"><h2>我的简历资料库</h2><p>整理一次，多站填写</p></div><button class="primary" :disabled="busy" @click="getToken() ? newResume() : emit('requireLogin')">＋ 新建简历</button></header>
    <div v-if="error" class="message error" role="alert">{{ error }} <button @click="error=''">×</button></div>
    <div v-if="notice" class="message notice" role="status">{{ notice }}</div>
    <div v-if="loading" class="empty-state">正在加载简历资料…</div>
    <div v-else-if="!getToken()" class="empty-state"><div class="empty-icon">▤</div><h3>登录后管理你的网申资料</h3><p>与小麦账号共用，电脑网页、客户端与填写插件同步使用。</p><button class="primary" @click="emit('requireLogin')">登录 / 注册</button></div>
    <div v-else-if="error && !detail && !resumes.length" class="empty-state"><button @click="load">重新加载</button></div>
    <div v-else-if="!detail" class="empty-state"><div class="empty-icon">▤</div><h3>创建你的第一份简历</h3><p>从基础资料到完整经历，让每一次网申都有据可填。</p><button class="primary" @click="newResume()">＋ 手动创建简历</button></div>
    <div v-else class="resume-columns">
      <aside class="module-nav"><div class="rail-title">简历模块 <button @click="modal='modules'">管理</button></div><button v-for="(m,i) in visible" :key="m.key" :class="{selected:active===m.key}" @click="go(m.key)"><span class="nav-index">{{ String(i+1).padStart(2,'0') }}</span><span>{{ m.title }}</span><small v-if="!m.single">{{ rows(m).length }}</small></button><div class="rail-tip">敏感信息可按需填写。没有真实资料的字段请留空。</div></aside>
      <main ref="center" class="resume-content">
        <div class="version-heading"><div><h3>{{ detail.resumeName }} <span v-if="detail.isDefault" class="default-badge">填写默认</span></h3><p>默认版本用于客户端与插件的自动填写</p></div><button @click="guard(()=>{newName=detail.resumeName;modal='rename';})">重命名</button></div>
        <section v-for="m in visible" :key="m.key" :data-module="m.key" class="module-card">
          <div class="module-header"><div><h3>{{ m.title }}</h3><p>{{ m.hint }}</p></div><button v-if="!m.single" :disabled="busy" @click="start(m)">＋ 添加</button><button v-else-if="!isEditing(m,rows(m)[0])" :disabled="busy" @click="start(m,rows(m)[0])">编辑</button></div>
          <template v-for="(row,i) in rows(m)" :key="m.single ? m.key : row.id">
            <div v-if="!isEditing(m,row)" class="record" :class="{single:m.single}">
              <div v-if="!m.single" class="record-head"><div><h4>{{ recordTitle(m,row) }}</h4><p v-if="row.startDate || row.endDate">{{ row.startDate || '未填起始日期' }} — {{ row.isCurrent ? '至今' : row.endDate || '未填结束日期' }}</p></div><div class="record-actions"><button :disabled="busy || i===0" aria-label="上移" @click="move(m,row,-1)">↑</button><button :disabled="busy || i===rows(m).length-1" aria-label="下移" @click="move(m,row,1)">↓</button><button :disabled="busy" @click="start(m,row)">编辑</button><button class="danger-link" :disabled="busy" @click="ask('删除这条'+m.title+'？删除后无法恢复。',()=>run(async()=>{await deleteSection(detail.id,m.key,row.id);await refresh();emit('changed');},'已删除'))">删除</button></div></div>
              <div v-if="summaries(m,row).length" class="record-details"><div v-for="f in summaries(m,row)" :key="f.label" :class="{wide:f.wide}"><span>{{ f.label }}</span><p>{{ f.value }}</p></div></div><p v-else class="blank-hint">尚未填写，点击编辑补充{{ m.title }}。</p>
            </div>
            <div v-else class="record-editor"><div class="editor-grid"><ResumeField v-for="f in fields" :key="f.key" :field="f" v-model="draft[f.key]" :provinces="provinces" /></div><div v-if="optional.length" class="more-fields"><span>添加更多信息</span><button v-for="f in optional" :key="f.key" @click="more.push(f.key)">＋ {{ f.label }}</button></div><div class="editor-footer"><small v-if="m.key==='profile'">保存后将同步修改所有简历版本的基本信息</small><button :disabled="busy" @click="cancel">取消</button><button class="primary" :disabled="busy" @click="save">{{ busy ? '保存中…' : '保存资料' }}</button></div></div>
          </template>
          <div v-if="!m.single && edit?.type===m.key && !edit.id" class="record-editor"><div class="editor-grid"><ResumeField v-for="f in fields" :key="f.key" :field="f" v-model="draft[f.key]" :provinces="provinces" /></div><div v-if="optional.length" class="more-fields"><span>添加更多信息</span><button v-for="f in optional" :key="f.key" @click="more.push(f.key)">＋ {{ f.label }}</button></div><div class="editor-footer"><button :disabled="busy" @click="cancel">取消</button><button class="primary" :disabled="busy" @click="save">{{ busy ? '保存中…' : '保存经历' }}</button></div></div>
          <div v-else-if="!m.single && !rows(m).length" class="blank-hint">还没有{{ m.title }}，可根据实际情况添加。</div>
        </section>
      </main>
      <aside class="version-rail"><div class="completion-card"><span>资料准备度</span><strong>{{ completion }}<small>%</small></strong><div class="progress-track"><i :style="{width:completion+'%'}"/></div><p>按常用网申资料估算，仅供参考</p></div><div class="rail-title">简历版本 <small>{{ resumes.length }} 份</small></div><input v-model="search" class="version-search" placeholder="搜索简历名称" aria-label="搜索简历" /><div v-for="r in versions" :key="r.id" class="version-item" :class="{current:r.id===detail.id}"><button class="version-name" @click="choose(r.id)"><span>{{ r.resumeName }}</span><small v-if="r.isDefault">默认</small><p>{{ r.targetPosition || '尚未设置目标岗位' }}</p></button><div class="version-actions"><button :disabled="busy || r.isDefault" @click="guard(()=>run(async()=>{await setResumeDefault(r.id);await refresh();emit('changed');},'默认填写简历已更新'))">{{ r.isDefault ? '已默认' : '设为默认' }}</button><button @click="newResume(r)">复制</button><button class="danger-link" @click="ask('确定删除「'+r.resumeName+'」及其全部经历？基本信息会保留。',()=>run(async()=>{await deleteResume(r.id);await refresh(r.id===detail.id ? null : detail.id);emit('changed');},'简历已删除'))">删除</button></div></div><button class="new-version" @click="newResume()">＋ 新建一个求职方向</button><p class="version-note">基础信息共用；求职意向与经历按版本独立保存。</p></aside>
    </div>
    <div v-if="modal" class="resume-modal-backdrop" @click.self="!busy && (modal='')">
      <div class="resume-modal" role="dialog" aria-modal="true" :class="{large:modal==='create'}">
        <template v-if="modal==='create'"><h3>创建简历版本</h3><p>为不同岗位准备不同经历组合。</p><label>简历名称<input v-model="newName" maxlength="100" placeholder="例如：2027秋招 · 产品经理" /></label><label>创建方式<select v-model="sourceId"><option value="">从空白简历创建</option><option v-for="r in resumes" :key="r.id" :value="r.id">复制自：{{ r.resumeName }}</option></select></label><template v-if="sourceId"><div class="copy-label">选择要复制的模块</div><div class="copy-modules"><label v-for="m in modules.filter(x=>x.key!=='profile')" :key="m.key"><input type="checkbox" v-model="selected" :value="m.key" />{{ m.title }}</label></div></template><div class="modal-tip">基本信息与账号共用。复制后的经历独立保存，不影响原简历。</div><div class="dialog-actions"><button :disabled="busy" @click="modal=''">取消</button><button class="primary" :disabled="busy" @click="makeResume">{{ busy ? '创建中…' : '创建简历' }}</button></div></template>
        <template v-else-if="modal==='modules'"><h3>管理简历模块</h3><p>隐藏模块仅影响展示，资料仍保留。</p><div class="module-toggles"><label v-for="m in modules.filter(x=>!x.single)" :key="m.key"><span>{{ m.title }}</span><input type="checkbox" :checked="!hidden.includes(m.key)" :disabled="busy" @change="toggleModule(m)" /></label></div><div class="dialog-actions"><button class="primary" @click="modal=''">完成</button></div></template>
        <template v-else-if="modal==='rename'"><h3>修改简历名称</h3><input v-model="newName" maxlength="100" /><div class="dialog-actions"><button @click="modal=''">取消</button><button class="primary" :disabled="busy" @click="run(async()=>{await updateResume(detail.id,{resumeName:newName});await refresh();modal='';emit('changed');},'名称已更新')">保存</button></div></template>
        <template v-else><h3>{{ modal==='discard' ? '有尚未保存的修改' : '确认操作' }}</h3><p>{{ confirmText }}</p><div class="dialog-actions"><button @click="modal='';pending=null">取消</button><button class="primary" :disabled="busy" @click="confirm">{{ modal==='discard' ? '放弃修改' : '确认' }}</button></div></template>
        <div v-if="error" class="dialog-error">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resume-workspace{height:100%;min-height:0;display:flex;flex-direction:column;background:#f5f7fb;color:#182334;padding:24px;box-sizing:border-box;font-family:inherit}.resume-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.eyebrow{font-size:10px;color:#7d93b6;letter-spacing:2px;font-weight:700}.resume-heading h2{margin:7px 0;font-size:23px;letter-spacing:.3px}.resume-heading p{margin:0;color:#7c899c;font-size:12px}.resume-workspace button{cursor:pointer;border:1px solid #e3e8f1;background:#fff;color:#41516a;border-radius:9px;padding:8px 12px;font:inherit;font-size:12px}.resume-workspace button:hover:not(:disabled){border-color:#a9c1ff;color:#165dff;background:#f2f6ff}.resume-workspace button:disabled{opacity:.45;cursor:default}.resume-workspace button.primary{background:#165dff;border-color:#165dff;color:#fff;padding:11px 19px;font-weight:600}.resume-columns{display:grid;grid-template-columns:178px minmax(0,1fr) 225px;gap:18px;flex:1;min-height:0}.module-nav,.version-rail{overflow:auto;min-height:0}.rail-title{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin:0 8px 12px;gap:6px}.rail-title button{border:0;background:transparent;padding:3px;color:#165dff}.module-nav>button{width:100%;display:flex;align-items:center;gap:9px;text-align:left;border:0;background:transparent;margin-bottom:3px;min-height:40px;padding:9px 11px}.module-nav>button.selected{color:#165dff;background:#e8efff;font-weight:600}.nav-index{font-size:10px;color:#97a5b9;width:17px}.module-nav small{margin-left:auto;color:#8a99af}.rail-tip,.version-note{font-size:11px;line-height:1.8;color:#91a0b6;margin:16px 10px}.resume-content{overflow:auto;min-height:0;padding-right:4px;scroll-padding:8px}.version-heading{display:flex;justify-content:space-between;align-items:center;margin:0 0 15px;padding:0 3px}.version-heading h3{font-size:17px;margin:0 0 6px}.version-heading p{font-size:11px;color:#8693a7;margin:0}.default-badge{display:inline-block;vertical-align:middle;font-size:10px;background:#e8efff;color:#165dff;padding:4px 6px;border-radius:5px;margin-left:4px}.module-card{background:#fff;border:1px solid #e8edf5;border-radius:16px;margin-bottom:16px;padding:20px;box-shadow:0 3px 15px #14284903}.module-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.module-header h3{font-size:15px;margin:0 0 5px}.module-header p{font-size:11px;line-height:1.6;color:#8794a6;margin:0}.module-header button{color:#165dff;background:#f4f7ff;border-color:#e1eaff;white-space:nowrap}.record{border-top:1px solid #edf0f6;padding:18px 0 0;margin-top:18px}.record.single{border:0;margin:0;padding:0}.record-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}.record-head h4{font-size:14px;margin:0 0 6px}.record-head p{margin:0;font-size:11px;color:#8996aa}.record-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.record-actions button{padding:4px 7px;border:0;background:#f6f8fc;font-size:11px}.resume-workspace button.danger-link{color:#bd5c66}.record-details{display:grid;grid-template-columns:1fr 1fr;gap:13px 24px}.record-details>div{min-width:0}.record-details .wide{grid-column:1/-1}.record-details span{font-size:10px;color:#91a0b5}.record-details p{margin:5px 0 0;font-size:12px;line-height:1.75;color:#465570;white-space:pre-wrap;overflow-wrap:anywhere}.blank-hint{padding:15px 0;color:#9ba7b7;font-size:12px;line-height:1.7}.record-editor{padding-top:15px;border-top:1px solid #edf0f6;margin-top:15px}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.editor-footer{display:flex;justify-content:flex-end;align-items:center;gap:9px;margin-top:20px}.editor-footer small{margin-right:auto;font-size:10px;color:#8794a6;max-width:50%;line-height:1.6}.more-fields{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:18px}.more-fields>span{font-size:11px;color:#94a0b2;width:100%}.more-fields button{font-size:11px;padding:5px 9px;background:#f7f9fd}.completion-card{border-radius:15px;background:linear-gradient(135deg,#e8efff,#f4f8ff);border:1px solid #e0e9fc;padding:18px;margin-bottom:22px}.completion-card>span{font-size:12px;color:#5377b1}.completion-card strong{display:block;font-size:32px;color:#165dff;margin:10px 0}.completion-card strong small{font-size:14px;margin-left:3px}.completion-card p{font-size:10px;color:#8a9bb5;margin:10px 0 0}.progress-track{height:5px;background:#dae5fa;border-radius:8px;overflow:hidden}.progress-track i{display:block;height:100%;background:#165dff;border-radius:8px}.version-search{box-sizing:border-box;width:100%;border:1px solid #e2e7f0;border-radius:9px;padding:10px;background:#fff;outline:none;margin-bottom:12px;font-size:12px}.version-item{border:1px solid #e6ebf3;border-radius:12px;margin-bottom:10px;padding:11px;background:#fff}.version-item.current{border-color:#88aeff;box-shadow:0 0 0 2px #165dff08}.version-item .version-name{display:block;border:0;width:100%;text-align:left;padding:0;background:transparent;overflow-wrap:anywhere}.version-name>span{font-weight:600;font-size:13px}.version-name small{white-space:nowrap;display:inline-block;color:#165dff;font-size:9px;margin-left:5px}.version-name p{font-size:11px;color:#95a0b1;margin:7px 0 12px}.version-actions{display:flex;gap:9px}.version-actions button{border:0;background:transparent;padding:0;font-size:10px;color:#778ba9}.new-version{width:100%;border-style:dashed!important;background:transparent!important;color:#165dff!important}.message{font-size:12px;padding:10px 14px;border-radius:8px;margin-bottom:12px;line-height:1.6}.message.error,.dialog-error{background:#fff0f1;color:#b33948}.message.error button{float:right;border:0;padding:0;background:transparent}.message.notice{background:#e8f5ed;color:#28764c}.empty-state{margin:auto;text-align:center;padding:40px 15px;color:#8693a7}.empty-state h3{color:#30435f;font-size:20px}.empty-state p{font-size:13px;line-height:1.8}.empty-icon{font-size:45px;color:#a9c4fb}.resume-modal-backdrop{position:fixed;inset:0;background:#172a4660;z-index:4000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:24px}.resume-modal{background:#fff;border-radius:22px;padding:28px;width:380px;max-width:100%;max-height:82vh;overflow:auto;box-shadow:0 20px 70px #15273b33}.resume-modal.large{width:490px}.resume-modal h3{margin:0 0 10px;font-size:21px}.resume-modal>p{font-size:13px;color:#8b98aa;line-height:1.7;margin-bottom:22px}.resume-modal>label{display:block;font-size:12px;color:#53647e;margin:16px 0}.resume-modal input:not([type=checkbox]),.resume-modal select{display:block;box-sizing:border-box;width:100%;border:1px solid #dfe6f1;border-radius:10px;min-height:42px;padding:10px 12px;margin-top:8px;font:inherit;font-size:13px;background:#f8faff;outline:none}.copy-label{font-size:12px;color:#53647e;margin-bottom:12px}.copy-modules{display:grid;grid-template-columns:1fr 1fr;gap:10px}.copy-modules label{font-size:12px;display:flex;gap:7px;align-items:center;color:#53647e}.resume-modal input[type=checkbox]{accent-color:#165dff;width:15px;height:15px}.modal-tip{font-size:11px;background:#f2f6fe;color:#8193b1;padding:11px;border-radius:8px;line-height:1.7;margin-top:20px}.dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}.dialog-error{padding:10px;font-size:12px;border-radius:8px;margin-top:12px}.module-toggles{display:grid;grid-template-columns:1fr 1fr;gap:10px}.module-toggles label{display:flex;align-items:center;justify-content:space-between;background:#f5f8fd;padding:10px;border-radius:8px;font-size:12px}@media(max-width:1150px){.resume-workspace{padding:16px}.resume-columns{grid-template-columns:140px minmax(0,1fr) 180px;gap:12px}.module-card{padding:16px}.module-nav>button{font-size:11px}.nav-index{display:none}.record-head{flex-direction:column}}@media(max-width:850px){.resume-columns{grid-template-columns:120px minmax(0,1fr)}.version-rail{display:none}.resume-heading h2{font-size:20px}}
.resume-workspace{padding:14px 16px}
.resume-heading{flex-shrink:0;margin-bottom:12px;min-height:36px;gap:12px}
.heading-copy{display:flex;align-items:baseline;gap:14px;min-width:0}
.resume-heading h2{margin:0;font-size:20px;white-space:nowrap}
.resume-heading p{font-size:12px}
.resume-heading button.primary{padding:8px 14px;white-space:nowrap}
@media(max-width:1150px){.resume-workspace{padding:12px}.heading-copy{gap:10px}}
@media(max-width:950px){.resume-heading p{display:none}}
</style>
