import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
export class RemoteScraper {
    constructor(options) {
        this.browser = null;
        this.page = null;
        this.options = options;
    }
    async init() {
        if (this.browser)
            return;
        const endpoint = `${this.options.wsEndpoint}?token=${this.options.token}`;
        this.browser = await puppeteer.connect({
            browserWSEndpoint: endpoint,
            ignoreHTTPSErrors: true,
            defaultViewport: { width: 1280, height: 720 },
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1440, height: 900 });
        await this.applyCookies();
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }
    toCookieParams(cookies) {
        return cookies.map((cookie) => {
            const param = {
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite,
            };
            if (cookie.expires > 0) {
                param.expires = cookie.expires;
            }
            return param;
        });
    }
    async applyCookies() {
        if (!this.page)
            return;
        const params = this.toCookieParams(this.options.cookies);
        if (params.length) {
            await this.page.setCookie(...params);
        }
    }
    async scrapeProfiles(profileUrls, postLimit, focusTopics) {
        if (!this.page)
            throw new Error('Remote scraper not initialized');
        const allPosts = [];
        const byExpert = {};
        for (const profileUrl of profileUrls) {
            const username = profileUrl
                .replace(/^https:\/\/www\.linkedin\.com\/in\//, '')
                .replace(/\/$/, '');
            const posts = await this.scrapeProfile(username, postLimit);
            byExpert[username] = posts;
            allPosts.push(...posts);
        }
        return { allPosts, byExpert };
    }
    async ensureLoggedIn() {
        if (!this.page)
            return;
        await this.page.goto('https://www.linkedin.com/feed/', {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
        });
        const nav = await this.page.$('.global-nav__primary-link, .scaffold-layout__nav');
        if (!nav) {
            throw new Error('LinkedIn session invalid');
        }
    }
    async scrapeProfile(username, postLimit) {
        if (!this.page)
            throw new Error('Remote scraper not initialized');
        await this.ensureLoggedIn();
        const profileUrl = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
        await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await this.page.waitForTimeout(2000);
        for (let i = 0; i < 6; i++) {
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(2000);
        }
        const html = await this.page.content();
        return this.extractPosts(html, username).slice(0, postLimit);
    }
    extractPosts(html, username) {
        const $ = cheerio.load(html);
        const elements = $('[data-urn*="urn:li:activity"]');
        const posts = [];
        elements.each((index, element) => {
            const urn = $(element).attr('data-urn') ?? '';
            const content = $(element).find('[dir="ltr"]').text().trim();
            if (!urn || !content)
                return;
            const likes = this.extractNumber($(element), [
                '[aria-label*="reaction"]',
                '.social-counts-reactions span',
            ]);
            const comments = this.extractNumber($(element), [
                '[aria-label*="comment"]',
                '.social-counts-comments span',
            ]);
            const shares = this.extractNumber($(element), [
                '[aria-label*="share"]',
                '.social-counts-shares span',
            ]);
            const publishedAt = $(element).find('time').attr('datetime') ?? new Date().toISOString();
            const url = `https://www.linkedin.com/feed/update/${urn}`;
            posts.push({
                id: urn,
                content,
                publishedAt,
                engagement: { likes, comments, shares },
                url,
                author: username,
            });
        });
        return posts;
    }
    extractNumber(element, selectors) {
        for (const selector of selectors) {
            const text = element.find(selector).first().text().trim();
            if (!text)
                continue;
            const digits = text.match(/\d+(\.\d+)?/);
            if (digits) {
                const value = parseFloat(digits[0]);
                if (text.includes('K'))
                    return Math.round(value * 1000);
                if (text.includes('M'))
                    return Math.round(value * 1000000);
                return Math.round(value);
            }
        }
        return 0;
    }
    async exportCookies() {
        if (!this.page)
            return [];
        return this.page.cookies('https://www.linkedin.com/');
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
