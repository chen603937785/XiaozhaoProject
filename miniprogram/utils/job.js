/**
 * 岗位数据后处理: 拆分多值字段、生成展示用字段
 */
function decorate(job) {
  const split = (s, n) => (s || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, n || 9999);
  const edu = job.education;
  return {
    ...job,
    recruitTypeArr: split(job.recruitTypes, 3),
    industryArr: split(job.industry, 2),
    cityArr: split(job.cities, 3),
    positionArr: split(job.positions),
    positionPreview: split(job.positions, 4).join(' · '),
    deadlineLabel: job.deadlineDate ? job.deadlineDate : (job.deadline || '招满即止'),
    educationLabel: edu && edu !== '不限' ? edu + '起' : (edu || '不限'),
    gradeLabel: job.targetRaw || '不限',
    publishLabel: job.publishDate ? String(job.publishDate).slice(5).replace('-', '/') : ''
  };
}

module.exports = { decorate };
