import axios from 'axios';
import * as cheerio from 'cheerio';
import { ContentSourceType, ExternalArticle } from './types.js';

const MAIN_CONTENT_SELECTORS = [
  'article',
  'main',
  '.post-content',
  '.entry-content',
  '.blog-post',
  '.blog-post-content',
  '.content-area',
  '#content'
];

const TEXT_STRIP_REGEX = /\s+/g;

function sanitizeText(text: string): string {
  return text.replace(TEXT_STRIP_REGEX, ' ').trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return 'unknown';
  }
}

function buildExcerpt(content: string): string {
  if (!content) return '';
  const sentences = content.split(/(?<=[.!?])\s+/).slice(0, 3);
  return sentences.join(' ');
}

function isWebinarOrEventUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  // Check for webinar/event platforms
  const eventPlatforms = [
    'zoom.us',
    'eventbrite.com',
    'hopin.com',
    'brighttalk.com',
    'on24.com',
    'webex.com',
    'gotomeeting.com',
    'demio.com',
    'livestorm.com'
  ];

  if (eventPlatforms.some(platform => lowerUrl.includes(platform))) {
    return true;
  }

  // Check for webinar/event keywords in URL path
  const eventKeywords = [
    '/webinar',
    '/event',
    '/register',
    '/registration',
    '/rsvp',
    '/live-event',
    '/upcoming-event',
    '/join-webinar',
    '/watch-webinar'
  ];

  if (eventKeywords.some(keyword => lowerUrl.includes(keyword))) {
    return true;
  }

  // Check for event-related query parameters
  const eventParams = ['?register=', '?event=', '&register=', '&event='];
  if (eventParams.some(param => lowerUrl.includes(param))) {
    return true;
  }

  return false;
}

export async function scrapeExternalArticles(
  urls: string[],
  sourceType: ContentSourceType = 'external',
  requestTimeout = 15000
): Promise<ExternalArticle[]> {
  const articles: ExternalArticle[] = [];

  for (const url of urls) {
    try {
      // Skip webinar and event URLs
      if (isWebinarOrEventUrl(url)) {
        console.log(`⏭️  Skipping webinar/event URL: ${url}`);
        continue;
      }

      console.log(`🌐 Fetching external content: ${url}`);
      const response = await axios.get(url, {
        timeout: requestTimeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SalesInsightsBot/1.0; +https://github.com/your-org)'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const title = sanitizeText(
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').first().text() ||
        ''
      );

      const description = sanitizeText(
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        ''
      );

      let content = '';
      for (const selector of MAIN_CONTENT_SELECTORS) {
        const section = $(selector);
        if (section.length > 0) {
          const paragraphs = section.find('p').map((_, el) => sanitizeText($(el).text())).get();
          const combined = paragraphs.filter(Boolean).join('\n\n');
          if (combined.length > content.length) {
            content = combined;
          }
        }
      }

      if (!content) {
        const paragraphs = $('p').map((_, el) => sanitizeText($(el).text())).get();
        content = paragraphs.filter(Boolean).slice(0, 15).join('\n\n');
      }

      if (!content) {
        console.log(`⚠️ No readable content extracted from ${url}`);
        continue;
      }

      const publishedAt =
        $('meta[property="article:published_time"]').attr('content') ||
        $('meta[name="article:published_time"]').attr('content') ||
        $('time').first().attr('datetime') ||
        undefined;

      const article: ExternalArticle = {
        url,
        title: title || 'Untitled Article',
        excerpt: description || buildExcerpt(content),
        content,
        sourceType,
        sourceDomain: extractDomain(url),
        publishedAt,
        fetchedAt: new Date().toISOString()
      };

      articles.push(article);
    } catch (error: any) {
      console.log(`❌ Failed to fetch external content from ${url}:`, error.message);
    }
  }

  return articles;
}
