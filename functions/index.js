const functions = require('firebase-functions');
const Parser = require('rss-parser');
const cors = require('cors')({ origin: true });

const LATEST_NEWS_COUNT = 5;
const CACHE_DURATION = 60 * 5; // 5分のキャッシュ

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

const formatNewsItem = (item) => ({
  title: item.title || '無題',
  link: item.link || '',
  description: item.description || '',
  pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
});

const fetchLatestNews = async (url) => {
  const feed = await parser.parseURL(url);
  return feed.items
    .slice(0, LATEST_NEWS_COUNT)
    .map(formatNewsItem);
};

exports.getLatestNews = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onRequest((request, response) => {
    cors(request, response, async () => {
      // メソッドの制限
      if (request.method !== 'GET') {
        response.status(405).json({
          status: 'error',
          message: 'Method Not Allowed'
        });
        return;
      }

      try {
        // キャッシュヘッダーの設定
        response.set('Cache-Control', `public, max-age=${CACHE_DURATION}`);
        response.set('Content-Type', 'application/json');

        const latestNews = await fetchLatestNews('https://www.mhlw.go.jp/stf/news.rdf');

        response.status(200).json({
          status: 'success',
          totalItems: latestNews.length,
          lastUpdated: new Date().toISOString(),
          data: latestNews,
          _meta: {
            cached: CACHE_DURATION,
            version: '1.0.0'
          }
        });

      } catch (error) {
        console.error('Error fetching RSS feed:', error);
        
        // エラーレスポンスにもキャッシュ制御を設定（短め）
        response.set('Cache-Control', 'public, max-age=60');
        
        response.status(500).json({
          status: 'error',
          message: 'ニュースの取得に失敗しました',
          error: error.message,
          _meta: {
            cached: 60,
            version: '1.0.0'
          }
        });
      }
    });
  });