import './env.js';
import { SearchService } from './search-service.js';

async function testSearchService() {
  console.log('🧪 Testing Search Service...');

  const searchService = new SearchService();

  // Test search for Sam McKenna
  try {
    console.log('🔍 Searching for external content for Sam McKenna...');
    const results = await searchService.searchForPersonContent('Sam McKenna');

    console.log('✅ Search Results:');
    console.log('📝 Personal Blog URLs:', results.personalBlogUrls.length);
    results.personalBlogUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('🏢 Company Blog URLs:', results.companyBlogUrls.length);
    results.companyBlogUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('📰 Article URLs:', results.articleUrls.length);
    results.articleUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('🔗 Resource URLs:', results.resourceUrls.length);
    results.resourceUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

  } catch (error: any) {
    console.error('❌ Search test failed:', error.message);
    if (error.message.includes('BRAVE_SEARCH_API_KEY')) {
      console.log('💡 Please set your BRAVE_SEARCH_API_KEY environment variable');
      console.log('💡 You can get a free API key at https://api.search.brave.com/');
    }
  }
}

testSearchService().catch(console.error);