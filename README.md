# YouTube Agent

我的第一个 AI Agent 项目。

自动监控 YouTube 财经频道，发现新视频后自动分析并推送到飞书。

---

## 功能

- 检测 YouTube 新视频
- Gemini 自动分析
- 飞书自动推送
- 防重复推送
- Markdown 知识库存档

---

## 技术栈

- Node.js
- GitHub Actions
- Gemini API
- YouTube Data API
- 飞书机器人

---

## 版本历史

### V1.0（2026-06-02）

已实现：

- 自动监控老厉害财经频道
- GitHub Actions 定时运行
- YouTube Data API 获取最新视频
- Gemini 自动分析
- 飞书自动推送
- last_video.txt 防重复推送

状态：

- 已完成生产环境验证
- 已实现无人值守运行

---

## V1.1（2026-06-04）

已实现：

- 支持多个频道监控
- 每个频道独立记录最新视频
- 飞书消息显示频道名称
- 优化消息格式
- 完善异常处理

状态：

- 已支持多频道运行
- 已完成生产环境验证

---

### 技术改造

- [x] 新增 CHANNELS 配置数组
- [x] 支持多个频道循环检查
- [x] last_video.txt 升级为 last_videos.json
- [x] 每个频道独立记录最新视频
- [x] 飞书消息增加频道名称
- [x] 保持 V1.0 兼容逻辑

---

## V1.2（2026-06-05）

已实现：

- Markdown 知识库存档
- 按频道分类归档
- 时间戳文件命名
- 异常隔离处理
- Gemini Prompt 优化

状态：

- 已支持长期历史记录保存
- 已支持多频道独立归档
- 单频道异常不影响整体运行
- 输出质量进一步提升

---

### 技术改造

- [x] 新增 outputs 目录
- [x] 支持 Markdown 自动保存
- [x] 按频道自动创建文件夹
- [x] 文件名增加时间戳
- [x] try/catch 异常隔离
- [x] 优化 Gemini 分析 Prompt
- [x] 移除 last_video.txt
- [x] 统一使用 last_videos.json