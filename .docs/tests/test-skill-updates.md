# 技能更新验收流程

1. 空临时项目安装旧版本技能，配置隔离 registry 返回新版；执行 check，观察仅提示、固定版本参数数组及正确 updateCwd、原文件未变。再次 check 不请求网络。
2. 开启自动更新偏好，check 表示可自动执行；通过新版 CLI 的 update 更换副本，核对内容、版本、偏好和后续命令配套。关闭偏好后不再允许自动执行。
3. 修改本地副本，check 标记修改，update 拒绝且字节不变。删除状态模拟旧安装：相同内容能认领，不同内容不覆盖。
4. registry 离线/无效内容：check 返回不可用而原任务可继续；显式 refresh 可重试。旧 CLI 不降级新版安装。
5. 在项目子目录自动发现项目技能；没有项目安装时发现隔离全局安装。符号链接、损坏状态、并发操作保守失败，不创建数据库。

执行映射：tests/cli-skill.test.mjs 使用 executeHeadless 正式实现和隔离 transport/temp HOME 完成以上跨命令流程；CLI 子进程 help/check 补充验证 JSON 信封。
