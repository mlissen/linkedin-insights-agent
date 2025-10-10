import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { LinkedInPost, ScrapingConfig, ContentSourceType, ExternalArticle } from './types.js';

export class LinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    // Use a copy of your Chrome profile to avoid conflicts with running browser
    const userDataDir = process.platform === 'darwin'
      ? '/Users/' + process.env.USER + '/Library/Application Support/Google/Chrome/LinkedIn-Scraper'
      : process.platform === 'win32'
      ? 'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\LinkedIn-Scraper'
      : '/home/' + process.env.USER + '/.config/google-chrome-linkedin-scraper';

    console.log('🔧 Launching Chrome with separate profile for LinkedIn scraping...');
    console.log('💡 You\'ll need to log into LinkedIn in the browser window that opens.');

    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Set a realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Prevent new tabs/windows from stealing focus
    this.browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage && newPage !== this.page) {
          console.log('🚫 Closing unwanted new tab to maintain focus...');
          await newPage.close();
        }
      }
    });

    // Prevent links from opening in new tabs by removing target="_blank" attributes
    await this.page.evaluateOnNewDocument(() => {
      // Override window.open to prevent popup/new tab behavior
      window.open = () => null;

      // Remove target="_blank" from all links
      const observer = new MutationObserver(() => {
        document.querySelectorAll('a[target="_blank"]').forEach(link => {
          link.removeAttribute('target');
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });

    console.log('✅ Browser launched! If you\'re not logged into LinkedIn, please log in manually.');
  }

  async scrapeUserPosts(config: ScrapingConfig): Promise<LinkedInPost[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    const posts: LinkedInPost[] = [];
    const profileUrl = `https://www.linkedin.com/in/${config.linkedinUsername}/recent-activity/all/`;

    try {
      // First, let's navigate to LinkedIn homepage to verify login
      console.log('🔍 Checking LinkedIn login status...');
      await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we're on the feed (meaning we're logged in)
      const feedPresent = await this.page.$('.feed-shared-update-v2, .scaffold-layout__main');
      if (!feedPresent) {
        console.log('❌ Not logged into LinkedIn. Please log in first.');
        return posts;
      }

      console.log('✅ Logged into LinkedIn successfully!');
      console.log(`📍 Now navigating to ${profileUrl}...`);

      await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we're logged in by looking for the LinkedIn navigation
      const isLoggedIn = await this.page.$('.global-nav__primary-link');
      if (!isLoggedIn) {
        console.log('⚠️  Not logged into LinkedIn in this browser session.');
        console.log('💡 Please log into LinkedIn manually in the browser window that opened.');
        console.log('⏳ Press Enter when you\'re logged in...');

        // Wait for user to press Enter
        await new Promise(resolve => {
          process.stdin.once('data', resolve);
        });

        // Refresh the page after login
        await this.page.reload({ waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('✅ Already logged into LinkedIn!');
      }

      // Try multiple selectors for posts
      const postSelectors = [
        '[data-urn*="urn:li:activity"]',
        '.feed-shared-update-v2',
        '.occludable-update',
        '.feed-shared-update-v2__content',
        'div[data-id]'
      ];

      let postsFound = false;
      for (const selector of postSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Found posts using selector: ${selector}`);
          postsFound = true;
          break;
        } catch (e) {
          console.log(`❌ Selector failed: ${selector}`);
        }
      }

      if (!postsFound) {
        console.log('❌ No posts found with any selector. The page structure may have changed.');
        console.log('🔍 Let\'s analyze what\'s actually on the page...');

        // Debug: Check what's actually on the page
        const bodyContent = await this.page.evaluate(() => {
          return document.body.innerText.substring(0, 500);
        });
        console.log('Page content preview:', bodyContent);

        return posts; // Return empty array instead of throwing
      }

      let postsScraped = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 30; // Further increased for pagination
      let consecutiveNoNewPosts = 0;
      let lastPostCount = 0;

      // Try different activity feed filters to get more posts
      const activityFilters = [
        '/recent-activity/all/', // All activity (default)
        '/recent-activity/posts/', // Posts only
        '/recent-activity/articles/', // Articles only
        '/recent-activity/documents/' // Documents/PDFs
      ];
      const filterContentTypeMap: Record<string, ContentSourceType> = {
        '/recent-activity/all/': 'post',
        '/recent-activity/posts/': 'post',
        '/recent-activity/articles/': 'article',
        '/recent-activity/documents/': 'document'
      };

      for (const filter of activityFilters) {
        if (postsScraped >= config.postLimit) break;

        console.log(`🔍 Trying activity filter: ${filter}`);
        const filterUrl = `https://www.linkedin.com/in/${config.linkedinUsername}${filter}`;
        const currentContentType = filterContentTypeMap[filter] || 'post';

        try {
          await this.page.goto(filterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Reset scroll attempts for each filter
          scrollAttempts = 0;
          consecutiveNoNewPosts = 0;
          lastPostCount = postsScraped;

          while (postsScraped < config.postLimit && scrollAttempts < maxScrollAttempts && consecutiveNoNewPosts < 5) {
            // Check if we're still on the correct page
            const currentUrl = this.page.url();

            if (!currentUrl.includes(`/in/${config.linkedinUsername}/recent-activity`)) {
              console.log(`🔄 Page redirected to: ${currentUrl}`);
              console.log(`🔄 Navigating back to: ${filterUrl}`);

              await this.page.goto(filterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
              await new Promise(resolve => setTimeout(resolve, 3000));

              // Verify we're back on the right page
              const newUrl = this.page.url();
              if (!newUrl.includes(`/in/${config.linkedinUsername}/recent-activity`)) {
                console.log('❌ Unable to stay on target page, LinkedIn may be blocking. Moving to next filter...');
                break;
              }
            }

            // First, click all "see more" buttons to expand posts
            await this.expandAllPosts();

            // Look for and click "Show more" or pagination buttons to load more posts
            const paginationClicked = await this.clickShowMoreButtons();

            // If we successfully clicked a pagination button, wait longer for content to load
            if (paginationClicked) {
              console.log('📄 Pagination button clicked, waiting for new posts to load...');
              await new Promise(resolve => setTimeout(resolve, 5000)); // Longer wait for pagination
            }

        // Wait for content to load after expansion
        await new Promise(resolve => setTimeout(resolve, 2000));

            // Extract posts using browser execution for better accuracy
        console.log('🔍 Starting post extraction from page...');

        let extractedPosts = [];
        try {
          extractedPosts = await this.page.evaluate(({ filterType }) => {
            console.log('🔍 Inside browser evaluation...');
            const posts = [];

            // Try multiple selectors to find post elements
            let postElements = document.querySelectorAll('[data-urn*="urn:li:activity"]');
            if (postElements.length === 0) {
              postElements = document.querySelectorAll('.feed-shared-update-v2');
            }
            if (postElements.length === 0) {
              postElements = document.querySelectorAll('.occludable-update');
            }
            if (postElements.length === 0) {
              postElements = document.querySelectorAll('article');
            }

            console.log('Found', postElements.length, 'post elements');

            function getEngagementCount(element: Element, selectors: string[]): number {
              for (let j = 0; j < selectors.length; j++) {
                const selector = selectors[j];
                const el = element.querySelector(selector);
                if (el && el.textContent) {
                  const text = el.textContent.trim();
                  // First try to extract just numbers
                  const match = text.match(/\d+/);
                  if (match) return parseInt(match[0]);

                  // Handle "K" notation (e.g., "1.2K")
                  if (text.includes('K')) {
                    const num = parseFloat(text.replace(/[^\d.]/g, ''));
                    if (!isNaN(num)) return Math.floor(num * 1000);
                  }
                }
              }
              return 0;
            }

            function normalizeUrl(href: string): string {
              if (!href) return '';
              if (href.startsWith('javascript')) return '';
              if (href.startsWith('#')) return '';
              try {
                if (href.startsWith('/')) {
                  const url = new URL(href, window.location.origin);
                  return url.toString();
                }
                return new URL(href).toString();
              } catch (e) {
                return '';
              }
            }

            function extractActualUrl(href: string): string {
              if (!href) return '';
              try {
                const decoded = decodeURIComponent(href);
                const redirectMatch = decoded.match(/url=([^&]+)&?/);
                if (decoded.includes('linkedin.com/redir') && redirectMatch) {
                  return normalizeUrl(redirectMatch[1]);
                }
              } catch (e) {
                // noop
              }
              return normalizeUrl(href);
            }

            function detectContentTypeFromUrl(url: string, defaultType: string): string {
              if (!url) return defaultType;
              if (url.includes('/pulse/')) return 'article';
              if (url.includes('/document/')) return 'document';
              if (url.includes('/newsletter/')) return 'post';
              return defaultType;
            }

            for (let i = 0; i < postElements.length; i++) {
              try {
                const element = postElements[i];

                // Extract URN/ID
                const urn = element.getAttribute('data-urn') || element.getAttribute('data-id') || element.id;
                const id = urn ? (urn.includes(':') ? urn.split(':').pop() : urn) : 'post_' + i;

                // Extract full post content with more broad selectors
                const contentSelectors = [
                  '.feed-shared-text',
                  '.attributed-text-segment-list__content',
                  '.feed-shared-update-v2__description',
                  '.update-components-text',
                  'span[dir="ltr"]',
                  '.break-words'
                ];

                let content = '';
                let foundSelector = '';

                for (let k = 0; k < contentSelectors.length; k++) {
                  const selector = contentSelectors[k];
                  const contentEl = element.querySelector(selector);
                  if (contentEl && contentEl.textContent) {
                    const text = contentEl.textContent.trim();
                    if (text.length > content.length) {
                      content = text;
                      foundSelector = selector;
                    }
                  }
                }

                // Try getting text from the entire element if nothing found
                if (!content && element.textContent) {
                  const allText = element.textContent.trim();
                  if (allText.length > 50) {
                    content = allText.substring(0, 1000); // Limit to prevent huge text blocks
                    foundSelector = 'element.textContent';
                  }
                }

                // Extract engagement metrics
                const likes = getEngagementCount(element, [
                  '.social-counts-reactions span',
                  '.reactions-count',
                  '[aria-label*="reaction"]',
                  '.react-count'
                ]);

                const comments = getEngagementCount(element, [
                  '.social-counts-comments span',
                  '.comments-count',
                  '[aria-label*="comment"]',
                  '.comment-count'
                ]);

                const shares = getEngagementCount(element, [
                  '.social-counts-shares span',
                  '.shares-count',
                  '[aria-label*="share"]',
                  '.share-count'
                ]);

                // Extract timestamp
                const timeEl = element.querySelector('time');
                const publishedAt = timeEl ? (timeEl.getAttribute('datetime') || timeEl.getAttribute('title') || timeEl.textContent || '') : '';

                const anchorEls = Array.from(element.querySelectorAll('a[href]')) as HTMLAnchorElement[];
                const links: string[] = [];
                let canonicalUrl = '';
                for (const anchor of anchorEls) {
                  const actualUrl = extractActualUrl(anchor.getAttribute('href') || '');
                  if (!actualUrl) continue;
                  if (!links.includes(actualUrl)) {
                    links.push(actualUrl);
                  }
                  if (!canonicalUrl && actualUrl.includes('linkedin.com/pulse/')) {
                    canonicalUrl = actualUrl;
                  }
                }

                // Extract image URLs from the post
                const imageEls = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
                const imageUrls: string[] = [];
                for (const img of imageEls) {
                  const src = img.getAttribute('src') || img.getAttribute('data-delayed-url') || '';
                  // Filter out UI icons, profile photos, and small images
                  if (src &&
                      !src.includes('data:image') &&
                      !src.includes('profile-photo') &&
                      !src.includes('profile-displayphoto') &&
                      !src.includes('ghost-person') &&
                      !src.includes('static.licdn.com/aero-v1/sc/h/') &&
                      !src.includes('static.licdn.com/sc/h/')) {
                    imageUrls.push(src);
                  }
                }

                if (!canonicalUrl) {
                  const activityAnchor = anchorEls.find(a => (a.getAttribute('href') || '').includes('activity/'));
                  if (activityAnchor) {
                    canonicalUrl = normalizeUrl(activityAnchor.getAttribute('href') || '');
                  }
                }

                const postUrl = canonicalUrl || `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
                const detectedContentType = detectContentTypeFromUrl(postUrl, filterType);

                if (content && content.length > 10) {
                  posts.push({
                    id: id,
                    content: content,
                    publishedAt: publishedAt,
                    engagement: { likes: likes, comments: comments, shares: shares },
                    foundSelector: foundSelector,
                    elementIndex: i,
                    url: postUrl,
                    links,
                    imageUrls,
                    contentType: detectedContentType
                  });
                  console.log('✅ Extracted post', i + 1, '- Length:', content.length, 'Likes:', likes, 'Images:', imageUrls.length, 'Selector:', foundSelector);
                } else {
                  console.log('❌ Skipped post', i + 1, '- No content found');
                }
              } catch (error: any) {
                console.log('❌ Error processing post', i + 1, ':', error.message);
                continue;
              }
            }

            console.log('🎯 Total posts extracted:', posts.length);
            return posts;
          }, { filterType: currentContentType }) as any[];
        } catch (evalError: any) {
          console.error('❌ JavaScript evaluation error:', evalError.message);
          console.log('🔍 Falling back to cheerio-based extraction...');

          // Fallback: use cheerio to parse the page content
          const pageContent = await this.page.content();
          console.log('📄 Page content length:', pageContent.length);

          const $ = cheerio.load(pageContent);

          // Try different selectors for posts
          const postSelectors = ['[data-urn*="urn:li:activity"]', '.feed-shared-update-v2', '.occludable-update', 'article'];
          let $posts = $();

          for (const selector of postSelectors) {
            $posts = $(selector);
            if ($posts.length > 0) {
              console.log(`✅ Found ${$posts.length} posts using selector: ${selector}`);
              break;
            }
          }

          if ($posts.length === 0) {
            console.log('❌ No posts found with any selector');
          }

          // Extract posts with cheerio
          $posts.each((index, element) => {

            const $post = $(element);

            // Extract ID
            const urn = $post.attr('data-urn') || $post.attr('data-id') || $post.attr('id');
            const id = urn ? (urn.includes(':') ? urn.split(':').pop() : urn) : `post_${index}`;

            // Extract content with multiple selectors - focus on main post content only
            const contentSelectors = [
              '.feed-shared-text',
              '.attributed-text-segment-list__content',
              '.feed-shared-update-v2__description',
              '.update-components-text'
            ];

            let content = '';
            let foundSelector = '';

            for (const selector of contentSelectors) {
              const text = $post.find(selector).first().text().trim();
              if (text.length > content.length) {
                content = text;
                foundSelector = selector;
              }
            }

            // Clean up content to remove duplicated names and metadata
            if (content) {
              // Remove repeated "Samantha McKenna" at the beginning
              content = content.replace(/^(Samantha McKenna\s*){2,}/, '');

              // Remove profile metadata that often appears
              content = content.replace(/^\s*(View profile|Follow|Connect)\s*/, '');

              // Remove action buttons text that might be captured
              content = content.replace(/\s*(Like|Comment|Share|Send)\s*$/i, '');

              // Clean up any remaining artifacts
              content = content.trim();
            }

            // Skip if content is too short after cleaning
            if (!content || content.length < 20) {
              console.log(`❌ Cheerio skipped post ${index + 1} - Content too short after cleaning: "${content}"`);
              return;
            }

            // Extract engagement with cheerio
            const extractNumber = (text: string): number => {
              const match = text.match(/\d+/);
              if (match) return parseInt(match[0]);
              if (text.includes('K')) {
                const num = parseFloat(text.replace(/[^\d.]/g, ''));
                return Math.floor(num * 1000);
              }
              return 0;
            };

            const likesText = $post.find('.social-counts-reactions, .reactions-count, [aria-label*="reaction"]').text();
            const commentsText = $post.find('.social-counts-comments, .comments-count, [aria-label*="comment"]').text();
            const sharesText = $post.find('.social-counts-shares, .shares-count, [aria-label*="share"]').text();

            const likes = extractNumber(likesText);
            const comments = extractNumber(commentsText);
            const shares = extractNumber(sharesText);

            // Extract timestamp
            const timeEl = $post.find('time');
            const publishedAt = timeEl.attr('datetime') || timeEl.attr('title') || timeEl.text() || '';

            const extractActualUrl = (href: string): string => {
              if (!href) return '';
              try {
                const decoded = decodeURIComponent(href);
                const redirectMatch = decoded.match(/url=([^&]+)&?/);
                if (decoded.includes('linkedin.com/redir') && redirectMatch) {
                  return redirectMatch[1];
                }
              } catch (e) {
                // noop
              }
              if (href.startsWith('/')) {
                return `https://www.linkedin.com${href}`;
              }
              return href;
            };

            const uniqueLinks = new Set<string>();
            $post.find('a[href]').each((_, anchor) => {
              const href = $(anchor).attr('href') || '';
              const normalized = extractActualUrl(href);
              if (normalized && !normalized.startsWith('javascript')) {
                uniqueLinks.add(normalized);
              }
            });

            // Extract image URLs
            const imageUrls: string[] = [];
            $post.find('img').each((_, img) => {
              const src = $(img).attr('src') || $(img).attr('data-delayed-url') || '';
              // Filter out UI icons, profile photos, and small images
              if (src &&
                  !src.includes('data:image') &&
                  !src.includes('profile-photo') &&
                  !src.includes('profile-displayphoto') &&
                  !src.includes('ghost-person') &&
                  !src.includes('static.licdn.com/aero-v1/sc/h/') &&
                  !src.includes('static.licdn.com/sc/h/')) {
                imageUrls.push(src);
              }
            });

            let canonicalUrl = '';
            for (const link of uniqueLinks) {
              if (link.includes('linkedin.com/pulse/')) {
                canonicalUrl = link;
                break;
              }
            }
            if (!canonicalUrl) {
              const activityLink = Array.from(uniqueLinks).find(link => link.includes('/feed/update/'));
              if (activityLink) {
                canonicalUrl = activityLink;
              }
            }

            const postUrl = canonicalUrl || `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
            const detectedContentType: ContentSourceType = postUrl.includes('/pulse/') ? 'article' : (filterContentTypeMap?.[filter] || 'post');

            if (content && content.length > 10) {
              extractedPosts.push({
                id: id,
                content: content,
                publishedAt: publishedAt,
                engagement: { likes, comments, shares },
                foundSelector: foundSelector,
                elementIndex: index,
                url: postUrl,
                links: Array.from(uniqueLinks),
                imageUrls,
                contentType: detectedContentType
              });
              console.log(`✅ Cheerio extracted post ${index + 1} - Length: ${content.length}, Likes: ${likes}, Images: ${imageUrls.length}, Selector: ${foundSelector}`);
            } else {
              console.log(`❌ Cheerio skipped post ${index + 1} - No content found`);
            }
          });
        }

        console.log(`📊 PAGINATION DEBUG: Found ${extractedPosts.length} posts with content on page`);
        console.log(`📊 PAGINATION DEBUG: Current total scraped: ${postsScraped}`);
        console.log(`📊 PAGINATION DEBUG: Posts before this scroll: ${lastPostCount}`);

        // Process extracted posts
        for (const extractedPost of extractedPosts) {
          if (postsScraped >= config.postLimit) break;

          if (!posts.find(p => p.id === extractedPost.id)) {
            const postUrl = extractedPost.url || `https://www.linkedin.com/posts/${config.linkedinUsername}_${extractedPost.id}`;
            const post = {
              id: extractedPost.id,
              content: extractedPost.content,
              publishedAt: extractedPost.publishedAt,
              engagement: extractedPost.engagement,
              url: postUrl,
              author: config.linkedinUsername,
              contentType: extractedPost.contentType || currentContentType,
              links: extractedPost.links || [],
              imageUrls: extractedPost.imageUrls || []
            } as LinkedInPost;

            posts.push(post);
            postsScraped++;
            console.log(`✅ Scraped post ${postsScraped}/${config.postLimit}: "${post.content.substring(0, 50)}..." (${post.engagement.likes} likes, ${post.engagement.comments} comments)`);
          } else {
            console.log(`🔄 Skipping duplicate post: ${extractedPost.id}`);
          }
        }

        if (postsScraped >= config.postLimit) break;

        // Gentle scrolling to avoid triggering LinkedIn's anti-bot measures
        console.log(`Scroll attempt ${scrollAttempts + 1}/${maxScrollAttempts}`);

        // Scroll gradually instead of jumping to bottom
        await this.page.evaluate(() => {
          const scrollStep = window.innerHeight * 0.8; // Scroll less than full screen
          window.scrollBy(0, scrollStep);
        });

        // Wait between scrolls to mimic human behavior (but not too long to avoid timeout)
        await new Promise(resolve => setTimeout(resolve, 3000)); // Balanced delay

            // Track if we got new posts to detect end of pagination
            const newPostsFound = postsScraped - lastPostCount;
            if (newPostsFound === 0) {
              consecutiveNoNewPosts++;
              console.log(`🔄 No new posts found (attempt ${consecutiveNoNewPosts}/5)`);
            } else {
              consecutiveNoNewPosts = 0;
              lastPostCount = postsScraped;
              console.log(`📈 Found ${newPostsFound} new posts (total: ${postsScraped})`);
            }

            scrollAttempts++;
          }

          console.log(`✅ Finished ${filter} - scraped ${postsScraped - lastPostCount} posts`);

        } catch (filterError: any) {
          console.log(`❌ Error with filter ${filter}:`, filterError.message);
          continue; // Try next filter
        }
      }

    } catch (error) {
      console.error('Error scraping LinkedIn posts:', error);
      console.log('💡 Tip: LinkedIn may require manual login or may be blocking automated access.');
    }

    console.log(`✅ Successfully scraped ${posts.length} posts`);
    return posts.slice(0, config.postLimit);
  }

  private async expandAllPosts(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized for expanding posts');
    }
    try {
      // Look for and click all "see more" buttons
      const seeMoreButtons = await this.page.$$('button[aria-label*="see more"], .feed-shared-inline-show-more-text button, .feed-shared-text .see-more');

      console.log(`Found ${seeMoreButtons.length} "see more" buttons to click`);

      for (const button of seeMoreButtons) {
        try {
          // Check if button is visible and clickable
          const isVisible = await button.isVisible();
          if (isVisible) {
            await button.click();
            // Small delay to let content expand
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error: any) {
          // Continue if individual button click fails
          console.log('Could not click see more button:', error.message);
        }
      }

      // Also try JavaScript approach for stubborn elements
      await this.page.evaluate(() => {
        const buttons = document.querySelectorAll(
          'button[aria-label*="see more"], ' +
          'button[aria-label*="See more"], ' +
          '.feed-shared-inline-show-more-text button, ' +
          '.see-more-less-toggle button, ' +
          '.feed-shared-text button'
        );

        for (let i = 0; i < buttons.length; i++) {
          try {
            const button = buttons[i] as HTMLElement;
            if (button && button.offsetParent !== null) { // Check if visible
              button.click();
            }
          } catch (e) {
            // Continue if click fails
          }
        }
      });
    } catch (error: any) {
      console.log('Error expanding posts:', error.message);
    }
  }

  private async clickShowMoreButtons(): Promise<boolean> {
    let buttonClicked = false;
    if (!this.page) {
      throw new Error('Page not initialized for pagination control');
    }
    try {
      // Debug: Log all buttons found on page
      const allButtonsDebug = await this.page.evaluate(() => {
        const allButtons = document.querySelectorAll('button');
        const buttonTexts = [];
        for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
          const button = allButtons[i] as HTMLElement;
          const text = button.textContent?.trim();
          const ariaLabel = button.getAttribute('aria-label');
          const dataTestId = button.getAttribute('data-test-id');
          if (text || ariaLabel || dataTestId) {
            buttonTexts.push({
              text: text || '',
              ariaLabel: ariaLabel || '',
              dataTestId: dataTestId || '',
              visible: button.offsetParent !== null
            });
          }
        }
        return buttonTexts;
      });

      console.log('🔍 DEBUG: First 20 buttons found on page:');
      allButtonsDebug.forEach((btn, i) => {
        if (btn.text.toLowerCase().includes('more') || btn.ariaLabel.toLowerCase().includes('more')) {
          console.log(`  [${i}] 🎯 POTENTIAL: "${btn.text}" | aria-label: "${btn.ariaLabel}" | data-test-id: "${btn.dataTestId}" | visible: ${btn.visible}`);
        } else {
          console.log(`  [${i}] "${btn.text}" | aria-label: "${btn.ariaLabel}" | data-test-id: "${btn.dataTestId}" | visible: ${btn.visible}`);
        }
      });
      // Look for LinkedIn's actual "See More Results" pagination buttons
      const showMoreSelectors = [
        // Primary "See More Results" button selectors
        'button[data-test-id="pagination-show-more"]',
        'button[data-test-id="profile-activity-pagination"]',
        'button[aria-label*="See more"]',
        'button[aria-label*="see more"]',
        'button[aria-label*="Show more"]',
        'button[aria-label*="show more"]',

        // Text-based selectors for pagination buttons
        'button:contains("See more")',
        'button:contains("See More")',
        'button:contains("Show more")',
        'button:contains("Show More")',
        'button:contains("See more results")',
        'button:contains("See More Results")',

        // Generic pagination selectors
        '.scaffold-finite-scroll__load-button button',
        '.profile-activity__pagination button',
        '.pv-profile-section__card-action-bar button',
        '.artdeco-button--secondary[aria-label*="more"]',

        // Fallback activity overview selectors
        '.activity-overview__show-more button',
        '.show-more-less-toggle button',
        'button[data-test-id="show-more-activity"]'
      ];

      for (const selector of showMoreSelectors) {
        try {
          const buttons = await this.page.$$(selector);
          console.log(`Found ${buttons.length} "${selector}" buttons`);

          for (const button of buttons) {
            try {
              const isVisible = await button.isVisible();
              if (isVisible) {
                await button.click();
                buttonClicked = true;
                console.log(`✅ Clicked show more button: ${selector}`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for content to load
                break; // Only click one pagination button per attempt
              }
            } catch (clickError: any) {
              console.log(`Could not click button ${selector}:`, clickError.message);
            }
          }
          if (buttonClicked) break; // Exit selector loop if we clicked a button
        } catch (selectorError: any) {
          // Continue to next selector
        }
      }

      // Try JavaScript approach for stubborn elements if no button was clicked yet
      if (!buttonClicked) {
          const jsButtonClicked = await this.page.evaluate(() => {
          let clicked = false;

          // First try standard selectors
          const buttons = document.querySelectorAll(
            'button[data-test-id="pagination-show-more"], ' +
            'button[data-test-id="profile-activity-pagination"], ' +
            'button[aria-label*="See more"], ' +
            'button[aria-label*="Show more"], ' +
            '.scaffold-finite-scroll__load-button button, ' +
            '.profile-activity__pagination button, ' +
            '.artdeco-button--secondary[aria-label*="more"], ' +
            '.activity-overview__show-more button'
          );

          for (let i = 0; i < buttons.length && !clicked; i++) {
            try {
              const button = buttons[i] as HTMLElement;
              if (button.offsetParent !== null) { // Check if visible
                button.click();
                clicked = true;
                console.log('✅ JS clicked pagination button:', button.textContent?.trim());
                break;
              }
            } catch (e) {
              // Continue if click fails
            }
          }

          // Also search for buttons by text content if no button clicked yet
          if (!clicked) {
            const allButtons = document.querySelectorAll('button');
            for (let i = 0; i < allButtons.length && !clicked; i++) {
              try {
                const button = allButtons[i] as HTMLElement;
                const text = button.textContent?.toLowerCase().trim();
                if (text && (
                  text.includes('see more') ||
                  text.includes('show more') ||
                  text.includes('see more results') ||
                  text.includes('show more results')
                ) && button.offsetParent !== null) {
                  button.click();
                  clicked = true;
                  console.log('✅ JS clicked text-based button:', text);
                  break;
                }
              } catch (e) {
                // Continue if click fails
              }
            }
          }

          return clicked;
        });

        if (jsButtonClicked) {
          buttonClicked = true;
        }
      }

    } catch (error: any) {
      console.log('Error clicking show more buttons:', error.message);
    }

    return buttonClicked;
  }

  async scrapeLinkedInArticles(posts: LinkedInPost[], limit: number = 5): Promise<ExternalArticle[]> {
    if (!this.browser) {
      console.log('⚠️ Browser not initialized; cannot scrape LinkedIn articles.');
      return [];
    }

    const articleUrls = new Set<string>();
    for (const post of posts) {
      if (post.url && post.url.includes('linkedin.com/pulse/')) {
        articleUrls.add(post.url.split('?')[0]);
      }
      if (post.links && post.links.length > 0) {
        for (const link of post.links) {
          if (link.includes('linkedin.com/pulse/')) {
            articleUrls.add(link.split('?')[0]);
          }
        }
      }
    }

    const targets = Array.from(articleUrls).slice(0, limit);
    if (targets.length === 0) {
      console.log('ℹ️ No LinkedIn article URLs discovered for scraping.');
      return [];
    }

    const articlePage = await this.browser.newPage();
    await articlePage.setViewport({ width: 1280, height: 720 });

    const articles: ExternalArticle[] = [];

    for (const url of targets) {
      try {
        console.log(`📰 Fetching LinkedIn article: ${url}`);
        await articlePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await articlePage.waitForSelector('article', { timeout: 5000 }).catch(() => {});

        const articleData = await articlePage.evaluate(() => {
          const titleEl = document.querySelector('h1');
          const title = titleEl ? titleEl.textContent?.trim() || '' : document.title;
          const timeEl = document.querySelector('time');
          const publishedAt = timeEl?.getAttribute('datetime') || timeEl?.getAttribute('title') || '';

          const collectText = (root: Element | null): string => {
            if (!root) return '';
            const paragraphs = Array.from(root.querySelectorAll('p'))
              .map(p => p.textContent?.trim() || '')
              .filter(Boolean);
            return paragraphs.join('\n\n');
          };

          const articleEl = document.querySelector('article');
          let content = collectText(articleEl as Element);
          if (!content) {
            const mainEl = document.querySelector('main');
            content = collectText(mainEl as Element);
          }

          const excerpt = content ? content.split('\n\n').slice(0, 2).join(' ') : '';
          return { title, publishedAt, content, excerpt };
        });

        if (articleData && articleData.content?.trim()) {
          let sourceDomain = 'linkedin.com';
          try {
            sourceDomain = new URL(url).hostname;
          } catch (error) {
            // Ignore URL parsing errors
          }

          articles.push({
            url,
            title: articleData.title || 'LinkedIn Article',
            excerpt: articleData.excerpt || articleData.content.slice(0, 200),
            content: articleData.content,
            sourceType: 'article',
            sourceDomain,
            publishedAt: articleData.publishedAt || undefined,
            fetchedAt: new Date().toISOString()
          });
        } else {
          console.log(`⚠️ LinkedIn article contained no scrapeable content: ${url}`);
        }
      } catch (error: any) {
        console.log(`❌ Failed to scrape LinkedIn article ${url}:`, error.message);
      }
    }

    await articlePage.close();
    return articles;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
