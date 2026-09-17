package com.campus.job.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("candidate_profile")
public class CandidateProfile {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String chineseName;
    private String englishName;
    private String gender;
    private String birthDate;
    private String phone;
    private String email;
    private String idType;
    private String idNumber;
    private String currentCity;
    private String nativePlace;
    private String politicalStatus;
    private String ethnicity;
    private String wechat;
    private String emergencyContact;
    private String emergencyPhone;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
