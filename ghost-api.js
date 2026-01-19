const GhostAdminAPI = require('@tryghost/admin-api');

let api = null;

function initGhostApi() {
  if (!process.env.GHOST_URL || !process.env.GHOST_ADMIN_KEY) {
    console.warn('Ghost API credentials not configured. Ghost features will be disabled.');
    return null;
  }

  api = new GhostAdminAPI({
    url: process.env.GHOST_URL,
    key: process.env.GHOST_ADMIN_KEY,
    version: 'v5.0'
  });

  return api;
}

function getApi() {
  if (!api) {
    return initGhostApi();
  }
  return api;
}

// Search for pages with the "search" tag
// Returns pages with their tags (character name, book title, author)
async function searchPages(query) {
  const ghostApi = getApi();
  if (!ghostApi) {
    return [];
  }

  try {
    const pages = await ghostApi.pages.browse({
      filter: 'tag:search',
      include: 'tags',
      limit: 'all'
    });

    // Filter by query if provided
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      return pages.filter(page => {
        // Search in title and tags
        if (page.title.toLowerCase().includes(lowerQuery)) return true;
        if (page.tags && page.tags.some(tag => tag.name.toLowerCase().includes(lowerQuery))) return true;
        return false;
      });
    }

    return pages;
  } catch (error) {
    console.error('Error searching Ghost pages:', error.message);
    return [];
  }
}

// Parse tags to extract character name, book title, and author
function parsePageTags(page) {
  const tags = page.tags || [];
  const tagNames = tags.map(t => t.name).filter(t => t !== 'search');

  // Assume first tag is character/setting, second is book title, third is author
  // Or try to infer from title format: "Thoughts on {Character} from {Book} by {Author}"
  const titleMatch = page.title.match(/^Thoughts on (.+?) from (.+?) by (.+)$/);

  if (titleMatch) {
    return {
      characterOrSetting: titleMatch[1],
      bookTitle: titleMatch[2],
      author: titleMatch[3]
    };
  }

  // Fallback to tag-based parsing
  return {
    characterOrSetting: tagNames[0] || 'Unknown',
    bookTitle: tagNames[1] || 'Unknown',
    author: tagNames[2] || 'Unknown'
  };
}

// Create a new page in Ghost
async function createPage({ characterOrSetting, bookTitle, author, content, isHtml = false }) {
  const ghostApi = getApi();
  if (!ghostApi) {
    throw new Error('Ghost API not configured');
  }

  const title = `Thoughts on ${characterOrSetting} from ${bookTitle} by ${author}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Generate the date-based link (same as updatePage)
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`;
  const dateLink = `https://www.bramadams.dev/book-progress-${dateStr}/`;

  // If content is already HTML (pre-processed with @mentions), use it directly
  // Otherwise escape it
  const processedContent = isHtml ? content : escapeHtml(content);
  const htmlContent = `<h2><a href="${dateLink}">${dateStr}</a></h2>\n<p>${processedContent}</p>`;

  try {
    // Use source: 'html' to tell Ghost to convert HTML to internal format
    const page = await ghostApi.pages.add({
      title,
      slug,
      html: htmlContent,
      status: 'published',
      tags: [
        { name: characterOrSetting },
        { name: bookTitle },
        { name: author },
        { name: 'search' }
      ]
    }, { source: 'html' });

    console.log('Created page with HTML:', htmlContent);
    return page;
  } catch (error) {
    console.error('Error creating Ghost page:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Update an existing page by appending content
async function updatePage({ pageId, content, isHtml = false }) {
  const ghostApi = getApi();
  if (!ghostApi) {
    throw new Error('Ghost API not configured');
  }

  try {
    // First, get the existing page with html format
    const existingPage = await ghostApi.pages.read({ id: pageId, formats: ['html'] });

    // Generate the date-based link
    const now = new Date();
    const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`;
    const dateLink = `https://www.bramadams.dev/book-progress-${dateStr}/`;

    // If content is already HTML (pre-processed with @mentions), use it directly
    // Otherwise escape it
    const processedContent = isHtml ? content : escapeHtml(content);

    // Append new content under an H2 with date link
    const existingHtml = existingPage.html || '';
    const newHtml = existingHtml + `\n<h2><a href="${dateLink}">${dateStr}</a></h2>\n<p>${processedContent}</p>`;

    console.log('Updating page with HTML:', newHtml);

    // Use source: 'html' to tell Ghost to convert HTML to internal format
    const updatedPage = await ghostApi.pages.edit({
      id: pageId,
      html: newHtml,
      updated_at: existingPage.updated_at
    }, { source: 'html' });

    return updatedPage;
  } catch (error) {
    console.error('Error updating Ghost page:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Search for tags (for @ mention autocomplete)
async function searchTags(query) {
  const ghostApi = getApi();
  if (!ghostApi) {
    return [];
  }

  try {
    // Fetch tags with a high limit to get all
    const tags = await ghostApi.tags.browse({
      limit: 1000,
      order: 'name ASC'
    });

    console.log(`Fetched ${tags.length} tags, first few:`, tags.slice(0, 5).map(t => t.name));

    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      const filtered = tags.filter(tag => tag.name.toLowerCase().includes(lowerQuery));
      console.log(`Filtered to ${filtered.length} tags for query "${query}"`);
      return filtered;
    }

    return tags;
  } catch (error) {
    console.error('Error searching Ghost tags:', error.message);
    return [];
  }
}

// Convert a tag name to a URL slug
function tagNameToSlug(tagName) {
  return tagName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  initGhostApi,
  getApi,
  searchPages,
  parsePageTags,
  createPage,
  updatePage,
  searchTags,
  tagNameToSlug,
  escapeHtml
};
