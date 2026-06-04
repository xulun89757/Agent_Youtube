const fs = require("fs/promises");
const path = require("path");


const CHANNELS = [
  {
    name: "老厉害财经",
    channelId: "UC8gZZWIWmBuCb_gzC8DUrvw",
    promptType: "macro",
  },
  {
    name: "感知",
    channelId: "UCiStSOhmu94BskBJ_2lm98w",
    promptType: "ganzhi",
  },
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
};

const LAST_VIDEOS_FILE = path.join(__dirname, "last_videos.json");

const apiKey = process.env.GEMINI_API_KEY;
const feishuWebhook = process.env.FEISHU_WEBHOOK;

function extractVideoId(link) {
  const watchMatch = link.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];

  const shortMatch = link.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];

  throw new Error(`无法从链接提取视频 ID：${link}`);
}

async function loadLastVideos() {
  try {
    const content = await fs.readFile(LAST_VIDEOS_FILE, "utf8");
    if (!content.trim()) {
      return {};
    }
    return JSON.parse(content);
    
  } catch (err) {
    if (err.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

async function saveLastVideos(data) {
  await fs.writeFile(
    LAST_VIDEOS_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
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

function buildRssUrls(channelId) {
  return [
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${channelId.slice(2)}`,
  ];
}

function buildMacroPrompt() {
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

function buildGanzhiPrompt() {
  return `
请认真观看并理解视频内容。

你是一名专业内容分析师。

不要复述视频。

请提炼最有价值的信息。

按照以下格式输出：

# 视频标题

# 三句话总结

# 核心观点

列出作者最重要的5个观点。

# 底层逻辑

作者为什么这样判断？

# 值得关注的信息

哪些信息最值得后续持续跟踪？

# 审计视角

作者可能忽略了什么？

有哪些潜在反例？

# 一句话结论

要求：

不要废话。
不要重复视频内容。
不要超过800字。
使用中文。
`;
}

function getPrompt(type) {
  switch (type) {
    case "macro":
      return buildMacroPrompt();

    case "ganzhi":
      return buildGanzhiPrompt();

    default:
      return buildMacroPrompt();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRssXml(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers: FETCH_HEADERS });

    if (response.ok) {
      const xml = await response.text();
      if (xml.includes("<entry>")) return xml;
    }

    if (
      attempt < retries &&
      (response.status === 404 || response.status === 500)
    ) {
      const delay = attempt * 5000;
      console.log(
        `RSS 返回 HTTP ${response.status}，${delay / 1000}s 后重试 (${attempt}/${retries})...`
      );
      await sleep(delay);
      continue;
    }

    console.error(`RSS 请求失败：${url} (HTTP ${response.status})`);
    break;
  }

  return null;
}

async function fetchLatestVideoFromRss(channelId) {
  const rssUrls = buildRssUrls(channelId);

  for (const url of rssUrls) {
    console.log(`尝试 RSS：${url}`);
    const xml = await fetchRssXml(url);
    if (xml) {
      console.log("RSS 获取成功\n");
      return parseLatestEntry(xml);
    }
  }
  return null;
}

async function fetchLatestVideoFromYouTubeApi(channelId) {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) return null;

  console.log("RSS 不可用，尝试 YouTube Data API...\n");

  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${youtubeApiKey}`
  );
  const channelData = await channelRes.json();

  if (!channelRes.ok) {
    console.error("YouTube API 获取频道失败：", channelData);
    return null;
  }

  const uploadsPlaylistId =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) return null;

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${youtubeApiKey}`
  );
  const playlistData = await playlistRes.json();

  if (!playlistRes.ok) {
    console.error("YouTube API 获取视频列表失败：", playlistData);
    return null;
  }

  const snippet = playlistData.items?.[0]?.snippet;
  if (!snippet?.resourceId?.videoId) return null;

  console.log("YouTube Data API 获取成功\n");

  return {
    title: snippet.title,
    published: snippet.publishedAt,
    link: `https://www.youtube.com/watch?v=${snippet.resourceId.videoId}`,
  };
}

async function fetchLatestVideoFromChannelPage(channelId) {
  console.log("改从频道页面获取最新视频...\n");

  const channelVideosUrl = `https://www.youtube.com/channel/${channelId}/videos`;
  const response = await fetch(channelVideosUrl, { headers: FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(`获取频道页面失败：HTTP ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/var ytInitialData = (.+?);<\/script>/);

  if (!match) {
    throw new Error("无法解析频道页面数据");
  }

  const data = JSON.parse(match[1]);
  let result = null;

  function walk(obj) {
    if (result || !obj || typeof obj !== "object") return;

    const vm = obj.lockupViewModel;
    const title = vm?.lockupMetadataViewModel?.title?.content;
    const videoId = (JSON.stringify(vm || {}).match(
      /vi\/([a-zA-Z0-9_-]{11})\//
    ) || [])[1];

    if (title && videoId) {
      const metadataRows =
        vm.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows?.[0]?.metadataParts || [];
      const published =
        metadataRows.find((part) => part.accessibilityLabel)
          ?.accessibilityLabel ||
        metadataRows[1]?.text?.content ||
        "未知";

      result = {
        title,
        published,
        link: `https://www.youtube.com/watch?v=${videoId}`,
      };
      return;
    }

    for (const value of Object.values(obj)) {
      walk(value);
    }
  }

  walk(data);

  if (!result) {
    throw new Error("无法从频道页面解析最新视频");
  }

  console.log("频道页面获取成功\n");
  return result;
}

async function fetchLatestVideo(channelId) {
  let video = await fetchLatestVideoFromRss(channelId);

  if (!video) {
    video = await fetchLatestVideoFromYouTubeApi(channelId);
  }

  if (!video) {
    video = await fetchLatestVideoFromChannelPage(channelId);
  }

  const published =
    video.published.includes("T") || video.published.endsWith("Z")
      ? formatPublished(video.published)
      : video.published;

  return {
    title: video.title,
    published,
    link: video.link,
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

async function sendToFeishu(text, channelName) {
  const response = await fetch(feishuWebhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text: `【${channelName}】\n\n${text}`,
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

  const lastVideos = await loadLastVideos();

  for (const channel of CHANNELS) {
    console.log(`正在获取 ${channel.name} 频道最新视频...\n`);

    const { title, published, link } = await fetchLatestVideo(
      channel.channelId
    );

    const videoId = extractVideoId(link);
    const lastVideoId = lastVideos[channel.channelId] || "";

    console.log(`最新视频标题：\n${title}\n`);
    console.log(`发布时间：\n${published}\n`);
    console.log(`视频链接：\n${link}\n`);
    console.log(`视频 ID：${videoId}\n`);

    if (lastVideoId === videoId) {
      console.log(`${channel.name} 无新视频，跳过\n`);
      continue;
    }

    const prompt = getPrompt(channel.promptType);

    console.log("正在将视频链接发送给 Gemini 分析...\n");

    const analysis = await callGemini(link, prompt);

    console.log(analysis);
    console.log();
    await sendToFeishu(analysis, channel.name);

    lastVideos[channel.channelId] = videoId;
    await saveLastVideos(lastVideos);

    console.log(`消息已发送到飞书（${channel.name}）`);
  }
}

main().catch((err) => {
  console.error("错误：", err.message);
  process.exit(1);
});
