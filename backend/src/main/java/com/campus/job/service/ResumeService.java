package com.campus.job.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.campus.job.common.BusinessException;
import com.campus.job.common.UserContext;
import com.campus.job.entity.CandidateProfile;
import com.campus.job.entity.Resume;
import com.campus.job.entity.ResumeEducation;
import com.campus.job.entity.ResumeExperience;
import com.campus.job.entity.ResumeLanguage;
import com.campus.job.entity.ResumeProject;
import com.campus.job.entity.ResumeSkill;
import com.campus.job.mapper.CandidateProfileMapper;
import com.campus.job.mapper.ResumeEducationMapper;
import com.campus.job.mapper.ResumeExperienceMapper;
import com.campus.job.mapper.ResumeLanguageMapper;
import com.campus.job.mapper.ResumeMapper;
import com.campus.job.mapper.ResumeProjectMapper;
import com.campus.job.mapper.ResumeSkillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final CandidateProfileMapper profileMapper;
    private final ResumeEducationMapper educationMapper;
    private final ResumeExperienceMapper experienceMapper;
    private final ResumeProjectMapper projectMapper;
    private final ResumeSkillMapper skillMapper;
    private final ResumeLanguageMapper languageMapper;

    private Long userId() {
        Long uid = UserContext.getUserId();
        if (uid == null) throw new BusinessException(401, "未登录");
        return uid;
    }

    private Resume getOwned(Long uid, Long id) {
        return resumeMapper.selectOne(new LambdaQueryWrapper<Resume>()
                .eq(Resume::getUserId, uid).eq(Resume::getId, id));
    }

    // ===== 简历列表 =====
    public List<Map<String, Object>> list() {
        Long uid = userId();
        List<Resume> resumes = resumeMapper.selectList(new LambdaQueryWrapper<Resume>()
                .eq(Resume::getUserId, uid)
                .orderByDesc(Resume::getIsDefault)
                .orderByDesc(Resume::getUpdatedAt));
        List<Map<String, Object>> result = new ArrayList<>();
        for (Resume r : resumes) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", r.getId());
            m.put("resumeName", r.getResumeName());
            m.put("targetPosition", r.getTargetPosition());
            m.put("targetCities", r.getTargetCities());
            m.put("isDefault", r.getIsDefault() != null && r.getIsDefault() == 1);
            m.put("updatedAt", r.getUpdatedAt());
            result.add(m);
        }
        return result;
    }

    // ===== 简历详情（含各模块 + 基本资料） =====
    public Map<String, Object> detail(Long resumeId) {
        Long uid = userId();
        Resume r = getOwned(uid, resumeId);
        if (r == null) throw new BusinessException(404, "简历不存在");
        Map<String, Object> result = new HashMap<>();
        result.put("id", r.getId());
        result.put("resumeName", r.getResumeName());
        result.put("targetPosition", r.getTargetPosition());
        result.put("targetCities", r.getTargetCities());
        result.put("expectedSalary", r.getExpectedSalary());
        result.put("availableDate", r.getAvailableDate());
        result.put("selfEvaluation", r.getSelfEvaluation());
        result.put("isDefault", r.getIsDefault() != null && r.getIsDefault() == 1);
        result.put("profile", getProfile());
        result.put("education", listEducation(uid, resumeId));
        result.put("experience", listExperience(uid, resumeId));
        result.put("project", listProject(uid, resumeId));
        result.put("skill", listSkill(uid, resumeId));
        result.put("language", listLanguage(uid, resumeId));
        return result;
    }

    // ===== 基本资料 =====
    public Map<String, Object> getProfile() {
        Long uid = userId();
        CandidateProfile p = profileMapper.selectOne(new LambdaQueryWrapper<CandidateProfile>()
                .eq(CandidateProfile::getUserId, uid));
        if (p == null) return new HashMap<>();
        Map<String, Object> m = new HashMap<>();
        m.put("chineseName", p.getChineseName());
        m.put("englishName", p.getEnglishName());
        m.put("gender", p.getGender());
        m.put("birthDate", p.getBirthDate());
        m.put("phone", p.getPhone());
        m.put("email", p.getEmail());
        m.put("idType", p.getIdType());
        m.put("idNumber", p.getIdNumber());
        m.put("currentCity", p.getCurrentCity());
        m.put("nativePlace", p.getNativePlace());
        m.put("politicalStatus", p.getPoliticalStatus());
        m.put("ethnicity", p.getEthnicity());
        m.put("wechat", p.getWechat());
        m.put("emergencyContact", p.getEmergencyContact());
        m.put("emergencyPhone", p.getEmergencyPhone());
        return m;
    }

    public void saveProfile(Map<String, Object> body) {
        Long uid = userId();
        CandidateProfile p = profileMapper.selectOne(new LambdaQueryWrapper<CandidateProfile>()
                .eq(CandidateProfile::getUserId, uid));
        if (p == null) {
            p = new CandidateProfile();
            p.setUserId(uid);
            p.setCreatedAt(LocalDateTime.now());
            p.setUpdatedAt(LocalDateTime.now());
            applyProfile(p, body);
            profileMapper.insert(p);
        } else {
            applyProfile(p, body);
            p.setUpdatedAt(LocalDateTime.now());
            profileMapper.updateById(p);
        }
    }

    private void applyProfile(CandidateProfile p, Map<String, Object> body) {
        if (body.containsKey("chineseName")) p.setChineseName(str(body.get("chineseName")));
        if (body.containsKey("englishName")) p.setEnglishName(str(body.get("englishName")));
        if (body.containsKey("gender")) p.setGender(str(body.get("gender")));
        if (body.containsKey("birthDate")) p.setBirthDate(str(body.get("birthDate")));
        if (body.containsKey("phone")) p.setPhone(str(body.get("phone")));
        if (body.containsKey("email")) p.setEmail(str(body.get("email")));
        if (body.containsKey("idType")) p.setIdType(str(body.get("idType")));
        if (body.containsKey("idNumber")) p.setIdNumber(str(body.get("idNumber")));
        if (body.containsKey("currentCity")) p.setCurrentCity(str(body.get("currentCity")));
        if (body.containsKey("nativePlace")) p.setNativePlace(str(body.get("nativePlace")));
        if (body.containsKey("politicalStatus")) p.setPoliticalStatus(str(body.get("politicalStatus")));
        if (body.containsKey("ethnicity")) p.setEthnicity(str(body.get("ethnicity")));
        if (body.containsKey("wechat")) p.setWechat(str(body.get("wechat")));
        if (body.containsKey("emergencyContact")) p.setEmergencyContact(str(body.get("emergencyContact")));
        if (body.containsKey("emergencyPhone")) p.setEmergencyPhone(str(body.get("emergencyPhone")));
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    // ===== 简历 CRUD =====
    @Transactional
    public Long create(Map<String, Object> body) {
        Long uid = userId();
        Resume r = new Resume();
        r.setUserId(uid);
        r.setResumeName(body.get("resumeName") == null ? "我的简历" : String.valueOf(body.get("resumeName")));
        applyResume(r, body);
        LocalDateTime now = LocalDateTime.now();
        r.setCreatedAt(now);
        r.setUpdatedAt(now);
        // 第一份简历自动设为默认
        Long count = resumeMapper.selectCount(new LambdaQueryWrapper<Resume>().eq(Resume::getUserId, uid));
        if (count == 0) {
            r.setIsDefault(1);
        } else {
            r.setIsDefault(0);
        }
        resumeMapper.insert(r);
        return r.getId();
    }

    @Transactional
    public void update(Long id, Map<String, Object> body) {
        Long uid = userId();
        Resume r = getOwned(uid, id);
        if (r == null) throw new BusinessException(404, "简历不存在");
        if (body.containsKey("resumeName")) r.setResumeName(String.valueOf(body.get("resumeName")));
        applyResume(r, body);
        r.setUpdatedAt(LocalDateTime.now());
        resumeMapper.updateById(r);
    }

    private void applyResume(Resume r, Map<String, Object> body) {
        if (body.containsKey("targetPosition")) r.setTargetPosition(str(body.get("targetPosition")));
        if (body.containsKey("targetCities")) r.setTargetCities(str(body.get("targetCities")));
        if (body.containsKey("expectedSalary")) r.setExpectedSalary(str(body.get("expectedSalary")));
        if (body.containsKey("availableDate")) r.setAvailableDate(str(body.get("availableDate")));
        if (body.containsKey("selfEvaluation")) r.setSelfEvaluation(str(body.get("selfEvaluation")));
    }

    @Transactional
    public void delete(Long id) {
        Long uid = userId();
        Resume r = getOwned(uid, id);
        if (r == null) throw new BusinessException(404, "简历不存在");
        deleteModules(uid, id);
        resumeMapper.deleteById(id);
    }

    @Transactional
    public Long copy(Long id) {
        Long uid = userId();
        Resume src = getOwned(uid, id);
        if (src == null) throw new BusinessException(404, "简历不存在");
        Resume r = new Resume();
        r.setUserId(uid);
        r.setResumeName((src.getResumeName() == null ? "我的简历" : src.getResumeName()) + " 副本");
        r.setTargetPosition(src.getTargetPosition());
        r.setTargetCities(src.getTargetCities());
        r.setExpectedSalary(src.getExpectedSalary());
        r.setAvailableDate(src.getAvailableDate());
        r.setSelfEvaluation(src.getSelfEvaluation());
        r.setIsDefault(0);
        LocalDateTime now = LocalDateTime.now();
        r.setCreatedAt(now);
        r.setUpdatedAt(now);
        resumeMapper.insert(r);
        copyModules(uid, id, r.getId());
        return r.getId();
    }

    @Transactional
    public void setDefault(Long id) {
        Long uid = userId();
        Resume r = getOwned(uid, id);
        if (r == null) throw new BusinessException(404, "简历不存在");
        resumeMapper.update(null, new LambdaUpdateWrapper<Resume>()
                .eq(Resume::getUserId, uid).eq(Resume::getIsDefault, 1)
                .set(Resume::getIsDefault, 0));
        resumeMapper.update(null, new LambdaUpdateWrapper<Resume>()
                .eq(Resume::getUserId, uid).eq(Resume::getId, id)
                .set(Resume::getIsDefault, 1));
    }

    // ===== 模块列表 =====
    private List<Map<String, Object>> listEducation(Long uid, Long resumeId) {
        return educationMapper.selectList(new LambdaQueryWrapper<ResumeEducation>()
                .eq(ResumeEducation::getUserId, uid).eq(ResumeEducation::getResumeId, resumeId)
                .orderByAsc(ResumeEducation::getSortOrder)).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("schoolName", e.getSchoolName());
            m.put("major", e.getMajor());
            m.put("educationLevel", e.getEducationLevel());
            m.put("degree", e.getDegree());
            m.put("startDate", e.getStartDate());
            m.put("endDate", e.getEndDate());
            m.put("gpa", e.getGpa());
            m.put("courses", e.getCourses());
            m.put("description", e.getDescription());
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    private List<Map<String, Object>> listExperience(Long uid, Long resumeId) {
        return experienceMapper.selectList(new LambdaQueryWrapper<ResumeExperience>()
                .eq(ResumeExperience::getUserId, uid).eq(ResumeExperience::getResumeId, resumeId)
                .orderByAsc(ResumeExperience::getSortOrder)).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("companyName", e.getCompanyName());
            m.put("position", e.getPosition());
            m.put("city", e.getCity());
            m.put("startDate", e.getStartDate());
            m.put("endDate", e.getEndDate());
            m.put("isCurrent", e.getIsCurrent() != null && e.getIsCurrent() == 1);
            m.put("description", e.getDescription());
            m.put("achievements", e.getAchievements());
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    private List<Map<String, Object>> listProject(Long uid, Long resumeId) {
        return projectMapper.selectList(new LambdaQueryWrapper<ResumeProject>()
                .eq(ResumeProject::getUserId, uid).eq(ResumeProject::getResumeId, resumeId)
                .orderByAsc(ResumeProject::getSortOrder)).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("projectName", e.getProjectName());
            m.put("role", e.getRole());
            m.put("startDate", e.getStartDate());
            m.put("endDate", e.getEndDate());
            m.put("background", e.getBackground());
            m.put("responsibilities", e.getResponsibilities());
            m.put("achievements", e.getAchievements());
            m.put("skills", e.getSkills());
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    private List<Map<String, Object>> listSkill(Long uid, Long resumeId) {
        return skillMapper.selectList(new LambdaQueryWrapper<ResumeSkill>()
                .eq(ResumeSkill::getUserId, uid).eq(ResumeSkill::getResumeId, resumeId)
                .orderByAsc(ResumeSkill::getSortOrder)).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("skillName", e.getSkillName());
            m.put("level", e.getLevel());
            m.put("years", e.getYears());
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    private List<Map<String, Object>> listLanguage(Long uid, Long resumeId) {
        return languageMapper.selectList(new LambdaQueryWrapper<ResumeLanguage>()
                .eq(ResumeLanguage::getUserId, uid).eq(ResumeLanguage::getResumeId, resumeId)
                .orderByAsc(ResumeLanguage::getSortOrder)).stream().map(e -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", e.getId());
            m.put("language", e.getLanguage());
            m.put("level", e.getLevel());
            m.put("score", e.getScore());
            return m;
        }).collect(java.util.stream.Collectors.toList());
    }

    // ===== 模块 CRUD =====
    public List<Map<String, Object>> listSection(Long resumeId, String type) {
        Long uid = userId();
        switch (type) {
            case "education": return listEducation(uid, resumeId);
            case "experience": return listExperience(uid, resumeId);
            case "project": return listProject(uid, resumeId);
            case "skill": return listSkill(uid, resumeId);
            case "language": return listLanguage(uid, resumeId);
            default: throw new BusinessException(400, "未知模块");
        }
    }

    @Transactional
    public Long addSection(Long resumeId, String type, Map<String, Object> body) {
        Long uid = userId();
        Resume r = getOwned(uid, resumeId);
        if (r == null) throw new BusinessException(404, "简历不存在");
        LocalDateTime now = LocalDateTime.now();
        switch (type) {
            case "education": {
                ResumeEducation e = new ResumeEducation();
                e.setUserId(uid); e.setResumeId(resumeId); e.setCreatedAt(now); e.setUpdatedAt(now);
                applyEducation(e, body);
                educationMapper.insert(e);
                return e.getId();
            }
            case "experience": {
                ResumeExperience e = new ResumeExperience();
                e.setUserId(uid); e.setResumeId(resumeId); e.setCreatedAt(now); e.setUpdatedAt(now);
                applyExperience(e, body);
                experienceMapper.insert(e);
                return e.getId();
            }
            case "project": {
                ResumeProject e = new ResumeProject();
                e.setUserId(uid); e.setResumeId(resumeId); e.setCreatedAt(now); e.setUpdatedAt(now);
                applyProject(e, body);
                projectMapper.insert(e);
                return e.getId();
            }
            case "skill": {
                ResumeSkill e = new ResumeSkill();
                e.setUserId(uid); e.setResumeId(resumeId); e.setCreatedAt(now); e.setUpdatedAt(now);
                applySkill(e, body);
                skillMapper.insert(e);
                return e.getId();
            }
            case "language": {
                ResumeLanguage e = new ResumeLanguage();
                e.setUserId(uid); e.setResumeId(resumeId); e.setCreatedAt(now); e.setUpdatedAt(now);
                applyLanguage(e, body);
                languageMapper.insert(e);
                return e.getId();
            }
            default: throw new BusinessException(400, "未知模块");
        }
    }

    @Transactional
    public void updateSection(Long resumeId, String type, Long itemId, Map<String, Object> body) {
        Long uid = userId();
        switch (type) {
            case "education": {
                ResumeEducation e = educationMapper.selectOne(new LambdaQueryWrapper<ResumeEducation>()
                        .eq(ResumeEducation::getUserId, uid).eq(ResumeEducation::getResumeId, resumeId).eq(ResumeEducation::getId, itemId));
                if (e == null) throw new BusinessException(404, "条目不存在");
                applyEducation(e, body);
                e.setUpdatedAt(LocalDateTime.now());
                educationMapper.updateById(e);
                break;
            }
            case "experience": {
                ResumeExperience e = experienceMapper.selectOne(new LambdaQueryWrapper<ResumeExperience>()
                        .eq(ResumeExperience::getUserId, uid).eq(ResumeExperience::getResumeId, resumeId).eq(ResumeExperience::getId, itemId));
                if (e == null) throw new BusinessException(404, "条目不存在");
                applyExperience(e, body);
                e.setUpdatedAt(LocalDateTime.now());
                experienceMapper.updateById(e);
                break;
            }
            case "project": {
                ResumeProject e = projectMapper.selectOne(new LambdaQueryWrapper<ResumeProject>()
                        .eq(ResumeProject::getUserId, uid).eq(ResumeProject::getResumeId, resumeId).eq(ResumeProject::getId, itemId));
                if (e == null) throw new BusinessException(404, "条目不存在");
                applyProject(e, body);
                e.setUpdatedAt(LocalDateTime.now());
                projectMapper.updateById(e);
                break;
            }
            case "skill": {
                ResumeSkill e = skillMapper.selectOne(new LambdaQueryWrapper<ResumeSkill>()
                        .eq(ResumeSkill::getUserId, uid).eq(ResumeSkill::getResumeId, resumeId).eq(ResumeSkill::getId, itemId));
                if (e == null) throw new BusinessException(404, "条目不存在");
                applySkill(e, body);
                e.setUpdatedAt(LocalDateTime.now());
                skillMapper.updateById(e);
                break;
            }
            case "language": {
                ResumeLanguage e = languageMapper.selectOne(new LambdaQueryWrapper<ResumeLanguage>()
                        .eq(ResumeLanguage::getUserId, uid).eq(ResumeLanguage::getResumeId, resumeId).eq(ResumeLanguage::getId, itemId));
                if (e == null) throw new BusinessException(404, "条目不存在");
                applyLanguage(e, body);
                e.setUpdatedAt(LocalDateTime.now());
                languageMapper.updateById(e);
                break;
            }
            default: throw new BusinessException(400, "未知模块");
        }
    }

    @Transactional
    public void deleteSection(Long resumeId, String type, Long itemId) {
        Long uid = userId();
        switch (type) {
            case "education": educationMapper.delete(new LambdaQueryWrapper<ResumeEducation>()
                    .eq(ResumeEducation::getUserId, uid).eq(ResumeEducation::getResumeId, resumeId).eq(ResumeEducation::getId, itemId)); break;
            case "experience": experienceMapper.delete(new LambdaQueryWrapper<ResumeExperience>()
                    .eq(ResumeExperience::getUserId, uid).eq(ResumeExperience::getResumeId, resumeId).eq(ResumeExperience::getId, itemId)); break;
            case "project": projectMapper.delete(new LambdaQueryWrapper<ResumeProject>()
                    .eq(ResumeProject::getUserId, uid).eq(ResumeProject::getResumeId, resumeId).eq(ResumeProject::getId, itemId)); break;
            case "skill": skillMapper.delete(new LambdaQueryWrapper<ResumeSkill>()
                    .eq(ResumeSkill::getUserId, uid).eq(ResumeSkill::getResumeId, resumeId).eq(ResumeSkill::getId, itemId)); break;
            case "language": languageMapper.delete(new LambdaQueryWrapper<ResumeLanguage>()
                    .eq(ResumeLanguage::getUserId, uid).eq(ResumeLanguage::getResumeId, resumeId).eq(ResumeLanguage::getId, itemId)); break;
            default: throw new BusinessException(400, "未知模块");
        }
    }

    // ===== 模块字段应用 =====
    private void applyEducation(ResumeEducation e, Map<String, Object> b) {
        if (b.containsKey("schoolName")) e.setSchoolName(str(b.get("schoolName")));
        if (b.containsKey("major")) e.setMajor(str(b.get("major")));
        if (b.containsKey("educationLevel")) e.setEducationLevel(str(b.get("educationLevel")));
        if (b.containsKey("degree")) e.setDegree(str(b.get("degree")));
        if (b.containsKey("startDate")) e.setStartDate(str(b.get("startDate")));
        if (b.containsKey("endDate")) e.setEndDate(str(b.get("endDate")));
        if (b.containsKey("gpa")) e.setGpa(str(b.get("gpa")));
        if (b.containsKey("courses")) e.setCourses(str(b.get("courses")));
        if (b.containsKey("description")) e.setDescription(str(b.get("description")));
        if (b.containsKey("sortOrder")) e.setSortOrder(toInt(b.get("sortOrder")));
    }
    private void applyExperience(ResumeExperience e, Map<String, Object> b) {
        if (b.containsKey("companyName")) e.setCompanyName(str(b.get("companyName")));
        if (b.containsKey("position")) e.setPosition(str(b.get("position")));
        if (b.containsKey("city")) e.setCity(str(b.get("city")));
        if (b.containsKey("startDate")) e.setStartDate(str(b.get("startDate")));
        if (b.containsKey("endDate")) e.setEndDate(str(b.get("endDate")));
        if (b.containsKey("isCurrent")) e.setIsCurrent(Boolean.TRUE.equals(b.get("isCurrent")) ? 1 : 0);
        if (b.containsKey("description")) e.setDescription(str(b.get("description")));
        if (b.containsKey("achievements")) e.setAchievements(str(b.get("achievements")));
        if (b.containsKey("sortOrder")) e.setSortOrder(toInt(b.get("sortOrder")));
    }
    private void applyProject(ResumeProject e, Map<String, Object> b) {
        if (b.containsKey("projectName")) e.setProjectName(str(b.get("projectName")));
        if (b.containsKey("role")) e.setRole(str(b.get("role")));
        if (b.containsKey("startDate")) e.setStartDate(str(b.get("startDate")));
        if (b.containsKey("endDate")) e.setEndDate(str(b.get("endDate")));
        if (b.containsKey("background")) e.setBackground(str(b.get("background")));
        if (b.containsKey("responsibilities")) e.setResponsibilities(str(b.get("responsibilities")));
        if (b.containsKey("achievements")) e.setAchievements(str(b.get("achievements")));
        if (b.containsKey("skills")) e.setSkills(str(b.get("skills")));
        if (b.containsKey("sortOrder")) e.setSortOrder(toInt(b.get("sortOrder")));
    }
    private void applySkill(ResumeSkill e, Map<String, Object> b) {
        if (b.containsKey("skillName")) e.setSkillName(str(b.get("skillName")));
        if (b.containsKey("level")) e.setLevel(str(b.get("level")));
        if (b.containsKey("years")) e.setYears(str(b.get("years")));
        if (b.containsKey("sortOrder")) e.setSortOrder(toInt(b.get("sortOrder")));
    }
    private void applyLanguage(ResumeLanguage e, Map<String, Object> b) {
        if (b.containsKey("language")) e.setLanguage(str(b.get("language")));
        if (b.containsKey("level")) e.setLevel(str(b.get("level")));
        if (b.containsKey("score")) e.setScore(str(b.get("score")));
        if (b.containsKey("sortOrder")) e.setSortOrder(toInt(b.get("sortOrder")));
    }

    private Integer toInt(Object o) {
        if (o == null) return 0;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return 0; }
    }

    // ===== 复制/删除模块 =====
    private void deleteModules(Long uid, Long resumeId) {
        educationMapper.delete(new LambdaQueryWrapper<ResumeEducation>().eq(ResumeEducation::getUserId, uid).eq(ResumeEducation::getResumeId, resumeId));
        experienceMapper.delete(new LambdaQueryWrapper<ResumeExperience>().eq(ResumeExperience::getUserId, uid).eq(ResumeExperience::getResumeId, resumeId));
        projectMapper.delete(new LambdaQueryWrapper<ResumeProject>().eq(ResumeProject::getUserId, uid).eq(ResumeProject::getResumeId, resumeId));
        skillMapper.delete(new LambdaQueryWrapper<ResumeSkill>().eq(ResumeSkill::getUserId, uid).eq(ResumeSkill::getResumeId, resumeId));
        languageMapper.delete(new LambdaQueryWrapper<ResumeLanguage>().eq(ResumeLanguage::getUserId, uid).eq(ResumeLanguage::getResumeId, resumeId));
    }

    private void copyModules(Long uid, Long srcId, Long dstId) {
        for (ResumeEducation e : educationMapper.selectList(new LambdaQueryWrapper<ResumeEducation>().eq(ResumeEducation::getUserId, uid).eq(ResumeEducation::getResumeId, srcId))) {
            e.setId(null); e.setResumeId(dstId); e.setCreatedAt(LocalDateTime.now()); e.setUpdatedAt(LocalDateTime.now());
            educationMapper.insert(e);
        }
        for (ResumeExperience e : experienceMapper.selectList(new LambdaQueryWrapper<ResumeExperience>().eq(ResumeExperience::getUserId, uid).eq(ResumeExperience::getResumeId, srcId))) {
            e.setId(null); e.setResumeId(dstId); e.setCreatedAt(LocalDateTime.now()); e.setUpdatedAt(LocalDateTime.now());
            experienceMapper.insert(e);
        }
        for (ResumeProject e : projectMapper.selectList(new LambdaQueryWrapper<ResumeProject>().eq(ResumeProject::getUserId, uid).eq(ResumeProject::getResumeId, srcId))) {
            e.setId(null); e.setResumeId(dstId); e.setCreatedAt(LocalDateTime.now()); e.setUpdatedAt(LocalDateTime.now());
            projectMapper.insert(e);
        }
        for (ResumeSkill e : skillMapper.selectList(new LambdaQueryWrapper<ResumeSkill>().eq(ResumeSkill::getUserId, uid).eq(ResumeSkill::getResumeId, srcId))) {
            e.setId(null); e.setResumeId(dstId); e.setCreatedAt(LocalDateTime.now()); e.setUpdatedAt(LocalDateTime.now());
            skillMapper.insert(e);
        }
        for (ResumeLanguage e : languageMapper.selectList(new LambdaQueryWrapper<ResumeLanguage>().eq(ResumeLanguage::getUserId, uid).eq(ResumeLanguage::getResumeId, srcId))) {
            e.setId(null); e.setResumeId(dstId); e.setCreatedAt(LocalDateTime.now()); e.setUpdatedAt(LocalDateTime.now());
            languageMapper.insert(e);
        }
    }
}
