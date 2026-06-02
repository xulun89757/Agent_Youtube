# YouTube Agent

我的第一个 AI Agent 项目。

自动监控 YouTube 财经频道，发现新视频后自动分析并推送到飞书。

---

## 功能

- 检测 YouTube 新视频
- Gemini 自动分析
- 飞书自动推送
- 防重复推送

---

## 技术栈

- Node.js
- GitHub Actions
- Gemini API
- YouTube Data API
- 飞书机器人

---

## 当前版本

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

## V1.1 开发计划

- [ ] 支持多个频道监控
- [ ] 每个频道独立记录最新视频
- [ ] 飞书消息显示频道名称
- [ ] 优化消息格式
- [ ] 完善异常处理