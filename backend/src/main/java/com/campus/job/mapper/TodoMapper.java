package com.campus.job.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.campus.job.entity.Todo;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TodoMapper extends BaseMapper<Todo> {
}
