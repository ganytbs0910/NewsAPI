const functions = require('firebase-functions');
const Parser = require('rss-parser');
const cors = require('cors')({ origin: true });

const LATEST_NEWS_COUNT = 5; // 取得するニュース件数を定数として定義

const parser = new Parser({
  customFields: {
    item: [
      ['title', 'title'],
      ['link', 'link'],
      ['description', 'description'],
      ['pubDate', 'pubDate']
    ]
  }
});

// ニュースを整形する関数
const formatNewsItem = (item) => ({
  title: item.title || '無題',
  link: item.link || '',
  description: item.description || '',
  pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
});

// RSSフィードからニュースを取得する関数
const fetchLatestNews = async (url) => {
  const feed = await parser.parseURL(url);
  return feed.items
    .slice(0, LATEST_NEWS_COUNT)
    .map(formatNewsItem);
};

exports.getLatestNews = functions
  .region('asia-northeast1')
  .https.onRequest((request, response) => {
    cors(request, response, async () => {
      try {
        const latestNews = await fetchLatestNews('https://www.mhlw.go.jp/stf/news.rdf');

        response.status(200).json({
          status: 'success',
          totalItems: latestNews.length,
          lastUpdated: new Date().toISOString(),
          data: latestNews
        });

      } catch (error) {
        console.error('Error fetching RSS feed:', error);
        response.status(500).json({
          status: 'error',
          message: 'ニュースの取得に失敗しました',
          error: error.message
        });
      }
    });
  });