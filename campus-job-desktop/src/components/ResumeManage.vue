<script setup>
import { ref, computed, onMounted } from 'vue';
import {
  getProfile, saveProfile, getResumes, createResume, getResumeDetail,
  updateResume, deleteResume, copyResume, setResumeDefault,
  addSection, updateSection, deleteSection
} from '../api';

const emit = defineEmits(['requireLogin', 'changed']);

const resumes = ref([]);
const currentResumeId = ref(null);
const detail = ref(null);
const loading = ref(false);
const saveStatus = ref('');

// 弹窗状态
const showDialog = ref(false);
const dialogType = ref(''); // education/experience/project/skill/language
const dialogItem = ref(null); // null = 新增
const dialogForm = ref({});

// 新建简历 / 删除确认 弹窗
const showCreate = ref(false);
const createName = ref('');
const showConfirm = ref(false);
const confirmMsg = ref('');
const confirmAction = ref(null);

const SECTION_META = {
  education: { title: '教育经历', fields: [
    { key: 'schoolName', label: '学校名称' }, { key: 'major', label: '专业' },
    { key: 'educationLevel', label: '学历' }, { key: 'degree', label: '学位' },
    { key: 'startDate', label: '入学时间' }, { key: 'endDate', label: '毕业时间' },
    { key: 'gpa', label: 'GPA' }, { key: 'courses', label: '主修课程', textarea: true },
    { key: 'description', label: '描述', textarea: true }
  ]},
  experience: { title: '实习/工作经历', fields: [
    { key: 'companyName', label: '公司名称' }, { key: 'position', label: '职位' },
    { key: 'city', label: '城市' }, { key: 'startDate', label: '开始时间' },
    { key: 'endDate', label: '结束时间' }, { key: 'isCurrent', label: '是否在职', bool: true },
    { key: 'description', label: '工作内容', textarea: true }, { key: 'achievements', label: '工作成果', textarea: true }
  ]},
  project: { title: '项目经历', fields: [
    { key: 'projectName', label: '项目名称' }, { key: 'role', label: '项目角色' },
    { key: 'startDate', label: '开始时间' }, { key: 'endDate', label: '结束时间' },
    { key: 'background', label: '项目背景', textarea: true }, { key: 'responsibilities', label: '个人职责', textarea: true },
    { key: 'achievements', label: '项目成果', textarea: true }, { key: 'skills', label: '使用技术' }
  ]},
  skill: { title: '专业技能', fields: [
    { key: 'skillName', label: '技能名称' }, { key: 'level', label: '熟练度' },
    { key: 'years', label: '使用年限' }
  ]},
  language: { title: '语言能力', fields: [
    { key: 'language', label: '语言' }, { key: 'level', label: '熟练程度' },
    { key: 'score', label: '成绩' }
  ]}
};

const PROFILE_FIELDS = [
  { key: 'chineseName', label: '中文姓名' }, { key: 'englishName', label: '英文姓名' },
  { key: 'gender', label: '性别' }, { key: 'birthDate', label: '出生日期' },
  { key: 'phone', label: '手机号' }, { key: 'email', label: '邮箱' },
  { key: 'idType', label: '证件类型' }, { key: 'idNumber', label: '证件号码' },
  { key: 'currentCity', label: '所在城市' }, { key: 'nativePlace', label: '籍贯' },
  { key: 'politicalStatus', label: '政治面貌' }, { key: 'ethnicity', label: '民族' },
  { key: 'wechat', label: '微信号' }, { key: 'emergencyContact', label: '紧急联系人' },
  { key: 'emergencyPhone', label: '紧急联系人电话' }
];

const RESUME_FIELDS = [
  { key: 'resumeName', label: '简历名称' }, { key: 'targetPosition', label: '目标岗位' },
  { key: 'targetCities', label: '期望城市' }, { key: 'expectedSalary', label: '期望薪资' },
  { key: 'availableDate', label: '到岗时间' }
];

const profile = computed(() => detail.value?.profile || {});
const educationList = computed(() => detail.value?.education || []);
const experienceList = computed(() => detail.value?.experience || []);
const projectList = computed(() => detail.value?.project || []);
const skillList = computed(() => detail.value?.skill || []);
const languageList = computed(() => detail.value?.language || []);

async function loadResumes() {
  try {
    resumes.value = await getResumes();
    if (resumes.value.length && currentResumeId.value == null) {
      const def = resumes.value.find(r => r.isDefault) || resumes.value[0];
      currentResumeId.value = def.id;
      await loadDetail();
    } else if (!resumes.value.length) {
      detail.value = null;
    }
  } catch (e) { resumes.value = []; }
}

async function loadDetail() {
  if (!currentResumeId.value) return;
  loading.value = true;
  try {
    detail.value = await getResumeDetail(currentResumeId.value);
  } catch (e) { detail.value = null; } finally {
    loading.value = false;
  }
}

async function selectResume(id) {
  currentResumeId.value = id;
  await loadDetail();
}

function doCreate() {
  createName.value = '我的简历';
  showCreate.value = true;
}

async function confirmCreate() {
  const name = createName.value.trim() || '我的简历';
  showCreate.value = false;
  try {
    await createResume({ resumeName: name });
    currentResumeId.value = null;
    await loadResumes();
    emit('changed');
  } catch (e) {}
}

async function doCopy(r) {
  try {
    await copyResume(r.id);
    await loadResumes();
  } catch (e) {}
}

function doDelete(r) {
  confirmMsg.value = '确定删除「' + (r.resumeName || '未命名') + '」吗？';
  confirmAction.value = async () => {
    try {
      await deleteResume(r.id);
      if (currentResumeId.value === r.id) {
        currentResumeId.value = null;
        detail.value = null;
      }
      await loadResumes();
    } catch (e) {}
  };
  showConfirm.value = true;
}

async function confirmDelete() {
  showConfirm.value = false;
  if (confirmAction.value) await confirmAction.value();
}

async function doSetDefault(r) {
  try {
    await setResumeDefault(r.id);
    await loadResumes();
  } catch (e) {}
}

function setSaveStatus(text) {
  saveStatus.value = text;
  setTimeout(() => { if (saveStatus.value === text) saveStatus.value = ''; }, 2000);
}

async function saveProfileData() {
  try {
    await saveProfile({ ...profile.value });
    setSaveStatus('已保存');
    emit('changed');
  } catch (e) { setSaveStatus('保存失败'); }
}

async function saveResumeData() {
  if (!detail.value) return;
  try {
    await updateResume(currentResumeId.value, {
      resumeName: detail.value.resumeName,
      targetPosition: detail.value.targetPosition,
      targetCities: detail.value.targetCities,
      expectedSalary: detail.value.expectedSalary,
      availableDate: detail.value.availableDate,
      selfEvaluation: detail.value.selfEvaluation
    });
    setSaveStatus('已保存');
    await loadResumes();
    emit('changed');
  } catch (e) { setSaveStatus('保存失败'); }
}

// ===== 模块弹窗 =====
async function openAdd(type) {
  await saveAllSilent();
  dialogType.value = type;
  dialogItem.value = null;
  dialogForm.value = {};
  showDialog.value = true;
}

// 静默保存当前内联编辑（求职意向 + 基本信息），避免打开弹窗时被 loadDetail 清空
async function saveAllSilent() {
  if (!detail.value) return;
  try {
    await saveProfile({ ...profile.value });
    await updateResume(currentResumeId.value, {
      resumeName: detail.value.resumeName,
      targetPosition: detail.value.targetPosition,
      targetCities: detail.value.targetCities,
      expectedSalary: detail.value.expectedSalary,
      availableDate: detail.value.availableDate,
      selfEvaluation: detail.value.selfEvaluation
    });
  } catch (e) {}
}

function openEdit(type, item) {
  dialogType.value = type;
  dialogItem.value = item;
  dialogForm.value = { ...item };
  showDialog.value = true;
}

async function saveDialog() {
  const type = dialogType.value;
  try {
    if (dialogItem.value) {
      await updateSection(currentResumeId.value, type, dialogItem.value.id, dialogForm.value);
    } else {
      await addSection(currentResumeId.value, type, dialogForm.value);
    }
    showDialog.value = false;
    await loadDetail();
    emit('changed');
  } catch (e) {}
}

function removeItem(type, item) {
  confirmMsg.value = '确定删除该条记录吗？';
  confirmAction.value = async () => {
    try {
      await deleteSection(currentResumeId.value, type, item.id);
      await loadDetail();
    } catch (e) {}
  };
  showConfirm.value = true;
}

function sectionTitle(type) {
  return SECTION_META[type].title;
}

function sectionItems(type) {
  const map = { education: educationList, experience: experienceList, project: projectList, skill: skillList, language: languageList };
  return map[type]?.value || [];
}

function sectionItemTitle(type, item) {
  switch (type) {
    case 'education': return [item.schoolName, item.major, item.educationLevel].filter(Boolean).join(' · ');
    case 'experience': return [item.companyName, item.position].filter(Boolean).join(' · ');
    case 'project': return [item.projectName, item.role].filter(Boolean).join(' · ');
    case 'skill': return item.skillName;
    case 'language': return [item.language, item.level].filter(Boolean).join(' · ');
    default: return '';
  }
}

// 完整度（简单估算）
const completion = computed(() => {
  if (!detail.value) return 0;
  let filled = 0, total = 0;
  const count = (obj) => Object.values(obj || {}).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
  total = PROFILE_FIELDS.length + RESUME_FIELDS.length + 1; // +1 自我评价
  filled = count(profile.value) + count(RESUME_FIELDS.reduce((a, f) => { a[f.key] = detail.value[f.key]; return a; }, {})) + (detail.value.selfEvaluation ? 1 : 0);
  const sections = [educationList, experienceList, projectList, skillList, languageList];
  total += sections.length;
  filled += sections.filter(s => s.value?.length > 0).length;
  return total ? Math.round(filled / total * 100) : 0;
});

onMounted(loadResumes);
</script>

<template>
  <div class="resume-manage">
    <div class="rm-head">
      <div>
        <div class="rm-title">简历管理</div>
        <div class="rm-sub">维护完整简历资料，网申时用填写助手自动填充</div>
      </div>
      <div class="rm-head-right">
        <span v-if="saveStatus" class="rm-save-status">{{ saveStatus }}</span>
        <button class="rm-add-btn" @click="doCreate">＋ 新建简历</button>
      </div>
    </div>

    <div class="rm-body">
      <!-- 左栏：简历列表 -->
      <div class="rm-left">
        <div class="rm-section-title">简历版本</div>
        <div v-if="!resumes.length" class="rm-empty">暂无简历，点击右上角新建</div>
        <div
          v-for="r in resumes"
          :key="r.id"
          class="rm-resume-item"
          :class="{ active: currentResumeId === r.id }"
          @click="selectResume(r.id)"
        >
          <div class="rm-resume-name">
            {{ r.resumeName || '未命名' }}
            <span v-if="r.isDefault" class="rm-default-tag">默认</span>
          </div>
          <div class="rm-resume-pos">{{ r.targetPosition || '未设置岗位' }}</div>
          <div class="rm-resume-ops" @click.stop>
            <span class="rm-op" v-if="!r.isDefault" @click="doSetDefault(r)">设默认</span>
            <span class="rm-op" @click="doCopy(r)">复制</span>
            <span class="rm-op danger" @click="doDelete(r)">删除</span>
          </div>
        </div>
      </div>

      <!-- 中栏：编辑 -->
      <div class="rm-center">
        <div v-if="!currentResumeId" class="rm-empty">请先创建或选择一份简历</div>
        <template v-else>
          <!-- 求职意向 -->
          <div class="rm-card">
            <div class="rm-card-head">
              <span class="rm-card-title">求职意向</span>
              <button class="rm-btn" @click="saveResumeData">保存</button>
            </div>
            <div class="rm-fields">
              <label v-for="f in RESUME_FIELDS" :key="f.key" class="rm-field">
                <span class="rm-field-label">{{ f.label }}</span>
                <input v-model="detail[f.key]" class="rm-input" />
              </label>
              <label class="rm-field full">
                <span class="rm-field-label">自我评价</span>
                <textarea v-model="detail.selfEvaluation" class="rm-input" rows="3"></textarea>
              </label>
            </div>
          </div>

          <!-- 基本信息 -->
          <div class="rm-card">
            <div class="rm-card-head">
              <span class="rm-card-title">基本信息</span>
              <button class="rm-btn" @click="saveProfileData">保存</button>
            </div>
            <div class="rm-fields">
              <label v-for="f in PROFILE_FIELDS" :key="f.key" class="rm-field">
                <span class="rm-field-label">{{ f.label }}</span>
                <input v-model="profile[f.key]" class="rm-input" />
              </label>
            </div>
          </div>

          <!-- 模块 -->
          <div v-for="(meta, type) in SECTION_META" :key="type" class="rm-card">
            <div class="rm-card-head">
              <span class="rm-card-title">{{ meta.title }}</span>
              <button class="rm-btn" @click="openAdd(type)">＋ 新增</button>
            </div>
            <div v-if="!sectionItems(type).length" class="rm-empty-small">暂无记录</div>
            <div v-for="item in sectionItems(type)" :key="item.id" class="rm-item">
              <div class="rm-item-title">{{ sectionItemTitle(type, item) }}</div>
              <div class="rm-item-ops">
                <span class="rm-op" @click="openEdit(type, item)">编辑</span>
                <span class="rm-op danger" @click="removeItem(type, item)">删除</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 右栏：完整度 -->
      <div class="rm-right">
        <div class="rm-section-title">完整度</div>
        <div class="rm-progress-ring">{{ completion }}%</div>
        <div class="rm-progress-bar"><div class="rm-progress-fill" :style="{ width: completion + '%' }"></div></div>
        <div class="rm-tip">完善简历信息，填写助手能更准确地填充网申表单</div>
      </div>
    </div>

    <!-- 模块弹窗 -->
    <div v-if="showDialog" class="rm-mask">
      <div class="rm-dialog">
        <div class="rm-dialog-title">{{ sectionTitle(dialogType) }} · {{ dialogItem ? '编辑' : '新增' }}</div>
        <div class="rm-dialog-form">
          <label v-for="f in SECTION_META[dialogType].fields" :key="f.key" class="rm-field">
            <span class="rm-field-label">{{ f.label }}</span>
            <input v-if="!f.bool && !f.textarea" v-model="dialogForm[f.key]" class="rm-input" />
            <textarea v-else-if="f.textarea" v-model="dialogForm[f.key]" class="rm-input" rows="3"></textarea>
            <label v-else class="rm-check">
              <input type="checkbox" v-model="dialogForm[f.key]" />
              <span>{{ f.label }}</span>
            </label>
          </label>
        </div>
        <div class="rm-dialog-actions">
          <button class="rm-btn" @click="showDialog = false">取消</button>
          <button class="rm-btn primary" @click="saveDialog">保存</button>
        </div>
      </div>
    </div>

    <!-- 新建简历弹窗 -->
    <div v-if="showCreate" class="rm-mask">
      <div class="rm-dialog" style="width:360px;">
        <div class="rm-dialog-title">新建简历</div>
        <label class="rm-field">
          <span class="rm-field-label">简历名称</span>
          <input v-model="createName" class="rm-input" @keyup.enter="confirmCreate" />
        </label>
        <div class="rm-dialog-actions">
          <button class="rm-btn" @click="showCreate = false">取消</button>
          <button class="rm-btn primary" @click="confirmCreate">确定</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showConfirm" class="rm-mask">
      <div class="rm-dialog" style="width:360px;">
        <div class="rm-dialog-title">确认</div>
        <div style="font-size:14px;color:var(--text);margin-bottom:20px;">{{ confirmMsg }}</div>
        <div class="rm-dialog-actions">
          <button class="rm-btn" @click="showConfirm = false">取消</button>
          <button class="rm-btn primary" @click="confirmDelete">确定删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resume-manage { display: flex; flex-direction: column; gap: 16px; }
.rm-head { display: flex; align-items: center; justify-content: space-between; }
.rm-title { font-size: 20px; font-weight: 700; color: var(--navy); }
.rm-sub { font-size: 13px; color: var(--text-sub); margin-top: 4px; }
.rm-head-right { display: flex; align-items: center; gap: 12px; }
.rm-save-status { font-size: 13px; color: #35b779; }
.rm-add-btn { height: 38px; padding: 0 20px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }

.rm-body { display: flex; gap: 16px; align-items: flex-start; }
.rm-left { width: 220px; flex-shrink: 0; background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
.rm-center { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.rm-right { width: 200px; flex-shrink: 0; background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 16px; }

.rm-section-title { font-size: 13px; font-weight: 600; color: var(--navy); margin-bottom: 12px; }
.rm-empty { text-align: center; color: var(--text-sub); padding: 30px 0; font-size: 13px; }
.rm-empty-small { text-align: center; color: var(--text-sub); padding: 12px 0; font-size: 12px; }

.rm-resume-item { padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 8px; border: 1px solid transparent; }
.rm-resume-item:hover { background: #f8fafd; }
.rm-resume-item.active { background: var(--blue-bg); border-color: var(--primary); }
.rm-resume-name { font-size: 14px; font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: 6px; }
.rm-default-tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--primary); color: #fff; }
.rm-resume-pos { font-size: 12px; color: var(--text-sub); margin-top: 3px; }
.rm-resume-ops { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; }
.rm-op { color: var(--primary); cursor: pointer; }
.rm-op.danger { color: #e35d5d; }

.rm-card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; }
.rm-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.rm-card-title { font-size: 15px; font-weight: 600; color: var(--navy); }
.rm-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.rm-field { display: flex; flex-direction: column; gap: 6px; }
.rm-field.full { grid-column: span 2; }
.rm-field-label { font-size: 13px; color: var(--text); }
.rm-input { height: 36px; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; font-size: 13px; color: var(--text); outline: none; background: #fff; }
.rm-input:focus { border-color: var(--primary); }
textarea.rm-input { height: auto; padding: 8px 10px; }

.rm-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #f0f2f6; }
.rm-item:last-child { border-bottom: none; }
.rm-item-title { font-size: 13px; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rm-item-ops { display: flex; gap: 10px; font-size: 12px; flex-shrink: 0; }

.rm-progress-ring { font-size: 40px; font-weight: 700; color: var(--primary); text-align: center; }
.rm-progress-bar { height: 6px; background: #eaf2ff; border-radius: 3px; margin: 12px 0; overflow: hidden; }
.rm-progress-fill { height: 100%; background: linear-gradient(90deg, #3f82e8, #63aef3); border-radius: 3px; }
.rm-tip { font-size: 12px; color: var(--text-sub); line-height: 1.6; }

.rm-btn { height: 30px; padding: 0 14px; border: 1px solid var(--border); border-radius: 8px; background: #fff; color: var(--text); font-size: 12px; cursor: pointer; }
.rm-btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.rm-btn:hover { border-color: var(--primary); color: var(--primary); }
.rm-btn.primary:hover { color: #fff; }

.rm-mask { position: fixed; inset: 0; background: rgba(20, 40, 70, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9998; }
.rm-dialog { width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; background: #fff; border-radius: 16px; padding: 24px; }
.rm-dialog-title { font-size: 18px; font-weight: 700; color: var(--navy); margin-bottom: 18px; }
.rm-dialog-form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.rm-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.rm-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); }
</style>
