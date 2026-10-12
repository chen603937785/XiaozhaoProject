(function () {
  'use strict';
  const C = globalThis.XiaomaiControls;
  const ALIASES = [
    ['profile.chineseName','姓名','中文姓名','中文名','真实姓名','申请人姓名','应聘者姓名','候选人姓名','name','full name'],
    ['profile.englishName','英文姓名','英文名','english name'],
    ['profile.gender','性别','gender','sex'],
    ['profile.birthDate','出生日期','出生年月','出生年月日','生日','date of birth','birthday'],
    ['profile.phone','手机','手机号','手机号码','联系电话','联系手机','移动电话','电话号码','phone','mobile','phone number'],
    ['profile.email','邮箱','邮箱地址','电子邮箱','电子邮件','email','e-mail','email address'],
    ['profile.idNumber','身份证号','身份证号码','证件号码','证件号','id number'],
    ['profile.currentCity','现居城市','现居住地','目前所在地','所在城市','居住城市'],
    ['profile.nativePlace','籍贯','祖籍','native place'],
    ['profile.politicalStatus','政治面貌','政治身份','党团关系','political status'],['profile.ethnicity','民族','民族名称','ethnicity'],
    ['profile.idType','证件类型','身份证件类型','证件类别','id type'],
    ['profile.wechat','微信','微信号','wechat'],
    ['profile.emergencyContact','紧急联系人','紧急联系人姓名','应急联系人'],
    ['profile.emergencyPhone','紧急联系人电话','紧急联系电话','应急联系电话','紧急联系人手机号'],
    ['education.schoolName','学校名称','毕业院校','学校','院校','就读学校','就读院校','university','school'],
    ['education.major','专业名称','所学专业','主修专业','专业','major','field of study'],
    ['education.educationLevel','学历','最高学历','学历层次','education','degree level'],
    ['education.degree','学位','学位名称','degree'],
    ['education.startDate','入学时间','入学日期','入学年月','就读开始时间','开始时间','开始日期','start date'],
    ['education.endDate','毕业时间','毕业日期','毕业年月','预计毕业时间','结束时间','结束日期','graduation date','end date'],
    ['education.gpa','GPA','绩点','平均成绩'],['education.courses','主修课程','专业课程'],
    ['experience.companyName','公司名称','企业名称','单位名称','实习单位','实习公司','工作单位','任职单位','employer','company'],
    ['experience.position','职位','职位名称','岗位名称','担任职位','实习职位','job title','position'],
    ['experience.city','城市','工作城市','工作地点','所在城市'],
    ['experience.startDate','开始时间','开始日期','入职时间','工作开始时间','实习开始时间','start date'],
    ['experience.endDate','结束时间','结束日期','离职时间','工作结束时间','实习结束时间','end date'],
    ['experience.description','工作内容','工作职责','实习内容','职责描述','岗位描述','responsibilities'],
    ['project.projectName','项目名称','项目名','project name'],['project.role','项目角色','担任角色','role'],
    ['project.background','项目背景','背景','project background'],
    ['project.responsibilities','项目职责','个人职责','负责内容','responsibilities'],
    ['project.achievements','项目成果','项目业绩','成果','achievements'],
    ['project.startDate','开始时间','开始日期','项目开始时间','start date'],
    ['project.endDate','结束时间','结束日期','项目结束时间','end date'],
    ['intention.targetPosition','期望职位','目标岗位','意向职位','应聘岗位','target position'],
    ['intention.targetCities','期望城市','工作地点偏好','意向城市','期望工作地点'],
    ['intention.expectedSalary','期望薪资','薪资要求','期望月薪','expected salary'],
    ['intention.availableDate','到岗时间','可入职时间','可开始时间','available date'],
    ['intention.selfEvaluation','自我评价','自我介绍','个人优势','个人简介','self evaluation'],
    ['intention.selfEvaluation','个人评价','自我描述','个人总结'],
    ['skill.skillName','技能名称','专业技能','技能','skill name'],
    ['skill.level','技能水平','熟练程度','熟练度','掌握程度'],
    ['skill.years','使用年限','使用年数','技能年限'],
    ['language.language','语种','外语语种','语言名称','语言','language'],
    ['language.level','语言水平','语言等级','外语水平','熟练程度'],
    ['language.score','语言成绩','考试成绩','成绩','score']
  ];
  ALIASES.push(
    ['profile.healthCondition','健康状况'],
    ['profile.currentResidence','通信地址'],
    ['profile.hobbies','个人爱好','兴趣爱好'],
    ['education.lengthOfSchooling','学制'],
    ['education.formOfStudy','受教育类型'],
    ['education.institute','院系','学院','所属院系'],
    ['education.score','必修课平均分'],
    ['intention.expectedSalary','期望薪酬'],
    ['internship.witnessName','证明人姓名'],
    ['internship.witnessPosition','证明人职务'],
    ['internship.witnessContact','证明人联系方式'],
    ['internship.description','工作描述'],
    ['project.background','项目描述'],
    ['campus.organizationName','活动名称'],
    ['campus.jobDescription','活动描述'],
    ['campus.position','职务'],
    ['patent.publicationDate','发表日期'],
    ['publication.publicationDate','接收/发表日期'],
    ['publication.journalName','期刊或会议名称'],
    ['publication.journalLevel','期刊或会议水平'],
    ['award.awardName','奖励名称'],
    ['award.awardTime','获奖时间'],
    ['award.awardOrg','颁发单位'],
    ['language.certificationName','英语水平'],
    ['language.score','英语成绩得分'],
    ['skill.level','IT技能掌握程度'],
    ['certificate.certificationName','专业资格证书'],
    ['certificate.certificationDate','专业资格证书获得时间'],
    ['family.company','工作单位'],
    ['family.position','亲属职务/岗位（含层级）'],
    ['profile.examRegistrationAddress','生源地'],
    ['profile.householdRegistrationLocation','户口所在地','户籍所在地','户籍地址','户口地址'],
    ['profile.specialSkills','特长及技能','特长技能'],
    ['profile.emergencyPhone','紧急联系方式'],
    ['education.isHighest','是否最高学历','是否为最高学历'],
    ['language.certificationName','英语等级','英语水平等级'],
    ['language.score','得分'],
    ['language.language','其他语言'],
    ['skill.skillName','IT技能'],
    ['experience.achievements','工作成果','工作业绩','实习成果','实习业绩'],
    ['experience.isCurrent','是否在职','目前在职','仍在职'],
    ['education.description','教育经历描述','教育描述','在校经历'],
    ['project.skills','使用技术','项目技术','技术栈']
  );
  // These are separate modules even on pages calling internships “学生实践”.
  for (const [key,...aliases] of ALIASES.filter(row=>row[0].startsWith('experience.'))) {
    ALIASES.push([key.replace('experience.','internship.'),...aliases]);
  }
  const MORE = {
    'profile.chineseName':['姓名全称','本人姓名','your name','candidate name','fullname','realname'],
    'profile.birthDate':['出生时间','出生年月(年/月)','出生日期(年/月/日)','dob','birth date'],
    'profile.phone':['个人手机','本人手机','常用手机','联系号码','联系方式(手机)','mobile number','telephone','contact number','tel'],
    'profile.email':['常用邮箱','个人邮箱','联系邮箱','电子信箱','emailaddress'],
    'profile.currentCity':['现居地','现居地址城市','常住城市','current city','city of residence'],
    'education.schoolName':['院校名称','毕业学校','就读大学','毕业大学','学校(院校)','school name','university name','college name','institution'],
    'education.major':['就读专业','毕业专业','专业方向','专业(全称)','major name','specialization'],
    'education.educationLevel':['教育程度','教育水平','学历类别','获得学历','qualification','education level','highest education'],
    'education.degree':['获得学位','学位类型','所获学位','academic degree'],
    'education.startDate':['入校时间','入学年份','入学起始日期','入学起始时间','就读起始时间','from','startdate'],
    'education.endDate':['毕业年份','预计毕业日期','预计毕业年月','就读结束时间','to','enddate'],
    'education.gpa':['平均绩点','平均学分绩点','综合绩点','grade point average'],
    'education.courses':['主要课程','所学课程','核心课程','courses'],
    'experience.companyName':['雇主名称','所在单位','实习企业','任职公司','工作公司','organization','employer name','company name'],
    'experience.position':['担任岗位','职务','工作职位','实习岗位','岗位','position title'],
    'experience.description':['工作描述','实习描述','主要工作内容','工作成果与职责','工作职责及业绩','job description'],
    'project.projectName':['项目标题','参与项目','name of project'],
    'project.role':['项目中担任角色','项目职务','承担角色','project role'],
    'project.responsibilities':['个人贡献','承担职责','项目工作内容','项目中职责'],
    'project.achievements':['项目结果','取得成果','项目成就','project achievements']
  };
  for (const row of ALIASES) row.push(...(MORE[row[0]]||[]));
  function configure(schema) {
    if (!Array.isArray(schema?.modules)) return false;
    for (const module of schema.modules) {
      if (!Array.isArray(module.fields)) continue;
      for (const field of module.fields) {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(module.key) || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(field.key)) continue;
        // Self evaluation keeps the established top-level autofill path.
        const key=module.key==='evaluation' ? 'intention.'+field.key : module.key+'.'+field.key;
        const aliases=[field.label,...(field.aliases||[])].filter(x=>typeof x==='string'&&x.length<100);
        const existing=ALIASES.find(row=>row[0]===key);
        if (existing) existing.push(...aliases.filter(x=>!existing.includes(x)));
        else ALIASES.push([key,...aliases]);
      }
    }
    return true;
  }
  configure(globalThis.XiaomaiResumeSchema);
  const sensitive = /密码|验证码|支付|银行卡|短信|password|captcha|privacy|隐私|同意|订阅/i;
  const norm = v => String(v ?? '').toLowerCase().replace(/[\s:：*（）()【】\[\]{}<>「」]/g,'').replace(/^(请输入|请选择|请填写|必填|required|optional)/,'');
  const labelCore = v => String(v ?? '').replace(/[（(](?:注|备注|说明|如没有|如无)[^）)]*[）)]/g,'').trim();
  function info(element) {
    const el = C.widget(element), control = C.input(el), group = C.container(el);
    const title = group.querySelector('.resume-form-title,.el-form-item__label,.ant-form-item-label,legend,.form-label,.label');
    const labels = [title?.textContent, el.getAttribute('aria-label'), control?.getAttribute('aria-label'),
      ...Array.from(control?.labels || []).map(x => x.textContent), control?.placeholder,
      control?.name, el.getAttribute('data-label'), el.getAttribute('data-field')].filter(Boolean).map(String);
    const moduleEl = group.closest('.resume-tpl-wrap');
    const moduleTitle = moduleEl?.querySelector('.title-txt,.resume-edit-title')?.textContent?.trim() || '';
    const module = /教育|学历|education/i.test(moduleTitle) ? 'education' : /实习|工作|任职|experience/i.test(moduleTitle) ? 'experience' : /项目|project/i.test(moduleTitle) ? 'project' : /意向|intention/i.test(moduleTitle) ? 'intention' : /基本|个人|profile/i.test(moduleTitle) ? 'profile' : '';
    const record = /record_(\d+)/.exec([group.id,el.id,control?.id].join(' '));
    return {el,control,labels,title:labels[0]?.replace(/^\s*\*\s*/,'').trim() || '(无标签)',module,moduleTitle,record:record ? Number(record[1]) : 0};
  }
  function match(item) {
    const primary=norm(labelCore(item.labels[0]));
    // A generic relative record cannot answer a bank employment declaration.
    if (/系统内|受雇|经商|违法|违规|违纪|诚信声明/.test(primary) || /^(是否|有无)/.test(primary)&&!/^(是否最高学历|是否为最高学历|是否在职|是否为海外教育经历)$/.test(primary)) return '';
    // These names require a different data type or an explicit declaration.
    if (/^(年级排名|奖励级别|奖项类别|专利发表阶段|发表阶段|作者排序|论文发表状态|影响因子|专业资格证书等级|其他外语水平及成绩|其他IT技能水平)$/.test(primary)) return '';
    const mixedSkills=/技能\s*[/／]\s*爱好/.test(item.moduleTitle||'');
    if (mixedSkills) {
      const key={'英语水平':'language.certificationName','英语成绩得分':'language.score','IT技能掌握程度':'skill.level','专业资格证书':'certificate.certificationName','专业资格证书获得时间':'certificate.certificationDate','个人爱好':'profile.hobbies'}[labelCore(item.labels[0]).replace(/[\s*：:]/g,'')];
      return key||'';
    }
    // Some Beisen forms put certificate records under a section named 技能.
    // Keep these explicit labels separate from generic skill name/level fields.
    if(item.module==='skill'){
      const certificate={'职执业资格证书':'certificate.certificationName','颁发机构':'certificate.certificationAuthDepartment','获取时间':'certificate.certificationDate'}[primary];
      if(certificate)return certificate;
    }
    if (item.module==='family' && /^(单位及职务|其他需要说明)/.test(primary)) return '';
    if (item.module==='family' && /^(与本人关系|关系)$/.test(primary)) {
      if (/如没有|如无|系统内|受雇/.test(item.labels[0]) || /系统内|受雇/.test(item.moduleTitle||'')) return '';
      return 'family.relationship';
    }
    if (/^(意向岗位类别|岗位类别|职位类别|意向单位|国籍|出生地|家庭住址)$/.test(primary)) return '';
    if (item.module==='profile' && primary==='个人评价') return 'intention.selfEvaluation';
    if(item.module==='profile'){
      const cross={'外语语种':'language.language','外语掌握水平':'language.level','计算机水平':'skill.level'}[primary];
      if(cross)return cross;
    }
    const parent=/^(父亲|母亲)(姓名|单位|工作单位|职务|职位)$/.exec(primary);
    if (parent && item.module==='family') return 'family.'+({姓名:'name',单位:'company',工作单位:'company',职务:'position',职位:'position'})[parent[2]];
    const scores = new Map();
    for (const [key,...aliases] of ALIASES) {
      // Do not map a work title to a target job, or a work date to education.
      if (item.module && key.split('.')[0]!==item.module) continue;
      for (const [index,label] of item.labels.entries()) {
        const text = norm(labelCore(label)).replace(/^(IT技能)[（(]?\d+[）)]?$/i,'$1');
        for (const alias of aliases) {
          const wanted = norm(alias);
          if (!wanted || !text) continue;
          const exact = wanted === text;
          // Yes/no fields must never be matched to a degree, name or date.
          if (/^(是否|有无)/.test(text) && !/^(是否|有无)/.test(wanted)) continue;
          if (!exact && (!/[\u4e00-\u9fff]/.test(wanted) || wanted.length < 2 || !text.includes(wanted) ||
            /紧急|父亲|母亲|配偶|联系人|户籍|户口|曾用|非/.test(text.replace(wanted,'')))) continue;
          const score = (exact ? 200 : 40) + wanted.length + (index === 0 ? 60 : 0) + (item.module && key.startsWith(item.module+'.') ? 100 : 0);
          scores.set(key,Math.max(scores.get(key)||0,score));
        }
      }
    }
    const found = [...scores.entries()].sort((a,b) => b[1]-a[1]);
    return !found.length || found[1]?.[1] === found[0][1] ? '' : found[0][0];
  }
  function moduleKey(title) {
    return /教育|学历|education/i.test(title)?'education':/学生实践|实习|internship/i.test(title)&& !/工作|work/i.test(title)?'internship':/工作|任职|experience|employment/i.test(title)?'experience':
      /项目|project/i.test(title)?'project':/技能|skill/i.test(title)?'skill':/语言|外语|language/i.test(title)?'language':
      /证书|certificate/i.test(title)?'certificate':/社会实践|校内活动|在校职务|干部|社团|campus/i.test(title)?'campus':/奖|荣誉|award/i.test(title)?'award':
      /家庭|family/i.test(title)?'family':/培训|training/i.test(title)?'training':/论文|著作|publication/i.test(title)?'publication':
      /专利|patent/i.test(title)?'patent':/意向|求职|自我评价|自我描述|intention/i.test(title)?'intention':/基本|个人|联系|profile|personal/i.test(title)?'profile':'';
  }
  function scan() {
    const excluded=el=>!!el.closest('#xiaomai-debug-panel');
    const scanned=globalThis.ResumeProFieldScan.scanPage(document,{isVisible:C.visible,exclude:excluded});
    const fields=[];
    for (const entry of scanned.controls) {
      if (excluded(entry.root)) continue;
      const item=info(entry.element||entry.root);
      // Keep the exact range input rather than collapsing both dates into one wrapper.
      if (entry.rangePart) item.el=entry.element;
      const hasDedicated=!!C.container(entry.root).querySelector('.resume-form-title,.el-form-item__label,.ant-form-item-label,legend,.form-label,.label');
      item.labels=hasDedicated?item.labels:[entry.label,...item.labels].filter(Boolean);
      if (entry.rangePart) {
        const key=entry.rangePart==='开始'?'开始日期':'结束日期';
        item.labels=[key,...item.labels]; item.title=entry.label;
      } else item.title=item.labels[0]?.replace(/^\s*\*\s*/,'').trim()||entry.label;
      if (!item.moduleTitle) item.moduleTitle=entry.section||'';
      item.module=moduleKey(item.moduleTitle);
      if (!/record_\d+/.test([C.container(item.el).id,item.el.id,item.control?.id].join(' '))) item.record=Math.max(0,(entry.repeatIndex||1)-1);
      const numbered=/^(?:IT技能|荣誉[^（(\d]*)[（(]?(\d+)[）)]?$/i.exec(item.title.replace(/[\s*]/g,''));
      if (numbered) item.record=Math.max(0,Number(numbered[1])-1);
      if (item.labels.some(x=>sensitive.test(x))) continue;
      const field={...item,id:'debug-'+fields.length,match:match(item),options:[],expanded:false,entry};
      if(item.el.matches('input[choose-date].dayType'))entry.controlKind='date';
      if(globalThis.XiaomaiPhoenix?.isDate(entry.root)) {entry.controlKind='date';entry.pickerType='phoenix';}
      if(item.el.matches('input[school-or-subject="1"]')) {
        const root=item.el.closest('.ipt-item');
        if(root&&entry.item.contains(root))entry.root=root;
      }
      globalThis.XiaomaiEngine.register(field.el,entry);
      fields.push(field);
    }
    // Rich text is not covered by the imported logical scanner.
    for (const el of document.querySelectorAll('[contenteditable="true"]')) {
      if (excluded(el)||!C.visible(el)||fields.some(x=>x.el.contains(el))) continue;
      const item=info(el);
      if (!item.labels.length||item.labels.some(x=>sensitive.test(x))) continue;
      fields.push({...item,id:'debug-'+fields.length,match:match(item),options:[],expanded:false});
    }
    return fields;
  }
  function readResume(data,key,record=0) {
    const resumes = data?.resumes || [];
    const resume = resumes.find(x => x.isDefault === true || x.isDefault === 1) || resumes[0];
    if (!resume) return null;
    const [group,field] = key.split('.');
    const source = Array.isArray(resume[group]) ? resume[group][record] : ['intention','evaluation'].includes(group) ? resume : resume[group];
    return source?.[field] ?? null;
  }
  function resolveResume(data,item) {
    const resume=data?.resumes?.find(x=>x.isDefault===true||x.isDefault===1)||data?.resumes?.[0];
    if (!resume || !item.match) return null;
    const title=norm(labelCore(item.title)), [group,key]=item.match.split('.');
    // These single fields summarize another module. Multiple records cannot
    // identify which language or computer skill the employer means.
    if(item.module==='profile'&&/^(外语语种|外语掌握水平|计算机水平)$/.test(title)){
      const records=resume[group]||[];
      return Array.isArray(records)&&records.length===1?records[0][key]??null:null;
    }
    if (group==='family' && /^(父亲|母亲)/.test(title)) {
      const relationship=title.startsWith('父亲')?'父亲':'母亲';
      const records=(resume.family||[]).filter(x=>norm(x.relationship)===relationship);
      return records.length===1 ? records[0][key]??null : null;
    }
    if (group==='language' && /^(英语等级|英语水平|英语成绩|其他语言)/.test(title)) {
      const records=(resume.language||[]).filter(x=>/^(英语|english)$/i.test(String(x.language).trim())===title.startsWith('英语'));
      return records[item.record||0]?.[key]??null;
    }
    if (item.match==='education.isHighest') {
      const records=resume.education||[], explicit=records[item.record]?.isHighest;
      if (explicit!=null) return typeof explicit==='boolean'?(explicit?'是':'否'):explicit;
      const ranks=records.map(x=>({博士:6,博士研究生:6,硕士:5,硕士研究生:5,研究生硕士:5,本科:4,大学本科:4,专科:3,大专:3,大学专科:3,高中:2,初中:1})[norm(x.educationLevel)]);
      if (!ranks.length || ranks.some(x=>!x) || item.record>=ranks.length) return null;
      const highest=Math.max(...ranks);
      if (ranks.filter(x=>x===highest).length!==1) return null;
      return ranks[item.record]===highest?'是':'否';
    }
    return readResume(data,item.match,item.record);
  }
  function fillHints(item,wanted) {
    // Free-text skill names list independent skills, not province-style paths.
    // The DOM executor must still find exactly one actual leaf, or refuse.
    if (item.match!=='skill.skillName' || C.type(item.el)!=='cascader' || typeof wanted!=='string') return {};
    const values=[...new Set(wanted.split(/\s*(?:\/|、|，|,|;|；)\s*/).map(x=>x.trim()).filter(Boolean))];
    return values.length>1&&values.length<=8&&values.every(x=>x.length<=100)?{leafAlternatives:values}:{};
  }
  globalThis.XiaomaiFields = {scan,info,match,readResume,resolveResume,fillHints,configure};
})();
