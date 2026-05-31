const title = "测试标题";
const published = "测试时间";
const link = "测试链接";

const apiKey = process.env.GEMINI_API_KEY;
const feishuWebhook = process.env.FEISHU_WEBHOOK;

const PROMPT = `请根据以下 YouTube 视频信息，输出简洁的视频分析（含主题概括、核心观点、适合人群，300字以内）：

标题：${title}
发布时间：${published}
链接：${link}`;

async function generateAndSend() {
  if (!apiKey) {
    console.error("错误：请设置环境变量 GEMINI_API_KEY");
    process.exit(1);
  }

  if (!feishuWebhook) {
    console.error("错误：请设置环境变量 FEISHU_WEBHOOK");
    process.exit(1);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: PROMPT }],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API 错误：", data);
    process.exit(1);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("未获取到有效回复：", data);
    process.exit(1);
  }

  console.log(text);

  const feishuResponse = await fetch(feishuWebhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text: `AI_AGENT\n\n${text}`,
      },
    }),
  });

  const feishuData = await feishuResponse.json();

  if (!feishuResponse.ok || feishuData.code !== 0) {
    console.error("飞书发送失败：", feishuData);
    process.exit(1);
  }

  console.log("消息已发送到飞书");
}

generateAndSend();
