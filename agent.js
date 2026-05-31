const fs = require("fs/promises");
const path = require("path");

const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC8gZZWIWmBuCb_gzC8DUrvw";

const LAST_VIDEO_FILE = path.join(__dirname, "last_video.txt");

const apiKey = process.env.GEMINI_API_KEY;
const feishuWebhook = process.env.FEISHU_WEBHOOK;

function extractVideoId(link) {
  const watchMatch = link.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];

  const shortMatch = link.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];

  throw new Error(`无法从链接提取视频 ID：${link}`);
}

async function readLastVideoId() {
  try {
    const content = await fs.readFile(LAST_VIDEO_FILE, "utf8");
    return content.trim();
  } catch (err) {
    if (err.code === "ENOENT") return "";
    throw err;
  }
}

async function writeLastVideoId(videoId) {
  await fs.writeFile(LAST_VIDEO_FILE, videoId, "utf8");
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseLatestEntry(xml) {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    throw new Error("RSS 中未找到视频条目");
  }

  const entry = entryMatch[1];

  const titleMatch = entry.match(/<title>([^<]*)<\/title>/);
  const publishedMatch = entry.match(/<published>([^<]*)<\/published>/);
  const linkMatch = entry.match(
    /<link\s+rel="alternate"\s+href="([^"]+)"/
  );

  const title = titleMatch?.[1];
  const published = publishedMatch?.[1];
  const link = linkMatch?.[1];

  if (!title || !published || !link) {
    throw new Error("无法解析最新视频的标题、发布时间或链接");
  }

  return {
    title: decodeHtmlEntities(title),
    published,
    link,
  };
}

function formatPublished(isoString) {
  return new Date(isoString).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
  });
}

function buildPrompt() {
  return `
请认真观看并理解视频内容。

你是一名资深宏观研究员和投资分析师。

不要复述视频。

请直接提炼价值。

按照以下格式输出：

# 视频标题

# 三句话总结

用三句话告诉我作者最重要的观点。

# 核心数据

列出视频中最重要的5个数据。

格式：

- 数据
- 意义
- 对市场影响

# 作者的核心逻辑

作者为什么得出这个结论？

核心推理链是什么？

# 投资启示

利好哪些行业？

利空哪些行业？

哪些行业值得继续观察？

# 审计视角

作者的分析有哪些假设？

哪些地方可能错？

有哪些反例？

# 一句话结论

如果我只有10秒钟时间，

最值得记住的一句话是什么？

要求：

不要废话。
不要重复视频内容。
不要超过800字。
使用中文。
`;
}

async function fetchLatestVideo() {
  const response = await fetch(RSS_URL);

  if (!response.ok) {
    throw new Error(`获取 RSS 失败：HTTP ${response.status}`);
  }

  const xml = await response.text();
  const { title, published, link } = parseLatestEntry(xml);

  return {
    title,
    published: formatPublished(published),
    link,
  };
}

async function callGemini(videoLink, prompt) {
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
            parts: [
              {
                fileData: {
                  fileUri: videoLink,
                  mimeType: "video/mp4",
                },
              },
              { text: prompt },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Gemini API 错误：${JSON.stringify(data)}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`未获取到有效回复：${JSON.stringify(data)}`);
  }

  return text;
}

async function sendToFeishu(text) {
  const response = await fetch(feishuWebhook, {
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

  const data = await response.json();

  if (!response.ok || data.code !== 0) {
    throw new Error(`飞书发送失败：${JSON.stringify(data)}`);
  }
}

async function main() {
  if (!apiKey) {
    console.error("错误：请设置环境变量 GEMINI_API_KEY");
    process.exit(1);
  }

  if (!feishuWebhook) {
    console.error("错误：请设置环境变量 FEISHU_WEBHOOK");
    process.exit(1);
  }

  console.log("正在获取老厉害财经频道最新视频...\n");

  const { title, published, link } = await fetchLatestVideo();
  const videoId = extractVideoId(link);
  const lastVideoId = await readLastVideoId();

  console.log(`最新视频标题：\n${title}\n`);
  console.log(`发布时间：\n${published}\n`);
  console.log(`视频链接：\n${link}\n`);
  console.log(`视频 ID：${videoId}\n`);

  if (lastVideoId === videoId) {
    console.log("无新视频，停止推送");
    process.exit(0);
  }

  const prompt = buildPrompt();

  console.log("正在将视频链接发送给 Gemini 分析...\n");

  const analysis = await callGemini(link, prompt);

  console.log(analysis);
  console.log();

  await sendToFeishu(analysis);

  await writeLastVideoId(videoId);

  console.log("消息已发送到飞书");
  console.log(`已更新 ${path.basename(LAST_VIDEO_FILE)}：${videoId}`);
}

main().catch((err) => {
  console.error("错误：", err.message);
  process.exit(1);
});
