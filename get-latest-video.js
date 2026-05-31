const RSS_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UC8gZZWIWmBuCb_gzC8DUrvw";

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

async function getLatestVideo() {
  const response = await fetch(RSS_URL);

  if (!response.ok) {
    console.error(`获取 RSS 失败：HTTP ${response.status}`);
    process.exit(1);
  }

  const xml = await response.text();
  const { title, published, link } = parseLatestEntry(xml);

  console.log(`最新视频标题：\n${title}\n`);
  console.log(`发布时间：\n${formatPublished(published)}\n`);
  console.log(`视频链接：\n${link}`);
}

getLatestVideo().catch((err) => {
  console.error("错误：", err.message);
  process.exit(1);
});
