const express = require('express');
const path = require('path');
const ghostApi = require('./ghost-api');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store submissions per book index
const submissions = new Map();

// Store book data passed from CLI
let booksData = [];

function setBooks(books) {
  booksData = books;
}

function getBooks() {
  return booksData;
}

// Serve the notes page
app.get('/notes/:bookIndex', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'notes.html'));
});

// Get book data for a specific index
app.get('/api/book/:bookIndex', (req, res) => {
  const bookIndex = parseInt(req.params.bookIndex, 10);
  const book = booksData[bookIndex];

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.json(book);
});

// Search Ghost pages
app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  try {
    const pages = await ghostApi.searchPages(query);
    // Parse tags for each page
    const results = pages.map(page => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      url: page.url,
      ...ghostApi.parsePageTags(page)
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search Ghost tags (for @ mentions)
app.get('/api/tags', async (req, res) => {
  const query = req.query.q || '';
  try {
    const tags = await ghostApi.searchTags(query);
    res.json(tags.map(tag => ({
      name: tag.name,
      slug: tag.slug,
      url: `https://www.bramadams.dev/tag/${tag.slug}/`
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new Ghost page
app.post('/api/create-page', async (req, res) => {
  const { characterOrSetting, bookTitle, author, content } = req.body;

  console.log('Create page request:', { characterOrSetting, bookTitle, author, content });

  if (!characterOrSetting || !bookTitle || !author || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const page = await ghostApi.createPage({
      characterOrSetting,
      bookTitle,
      author,
      content
    });
    console.log('Page created successfully:', page);
    res.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        url: page.url
      }
    });
  } catch (error) {
    console.error('Error in create-page route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update an existing Ghost page
app.post('/api/update-page', async (req, res) => {
  const { pageId, content } = req.body;

  if (!pageId || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const page = await ghostApi.updatePage({ pageId, content });
    res.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        url: page.url
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit notes for a book
app.post('/api/submit/:bookIndex', (req, res) => {
  const bookIndex = parseInt(req.params.bookIndex, 10);
  const { notes, updates, whatHappened } = req.body;

  // Store the submission
  submissions.set(bookIndex, { notes, updates, whatHappened, submitted: true });

  res.json({ success: true });
});

// Get submission status for a book
app.get('/api/submission/:bookIndex', (req, res) => {
  const bookIndex = parseInt(req.params.bookIndex, 10);
  const submission = submissions.get(bookIndex);

  if (submission) {
    res.json(submission);
  } else {
    res.json({ submitted: false });
  }
});

// Clear a submission
app.delete('/api/submission/:bookIndex', (req, res) => {
  const bookIndex = parseInt(req.params.bookIndex, 10);
  submissions.delete(bookIndex);
  res.json({ success: true });
});

// Get all submissions
function getSubmissions() {
  return submissions;
}

// Clear all submissions
function clearSubmissions() {
  submissions.clear();
}

// Start server
function startServer(port = 3456) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      resolve(server);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        startServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = {
  app,
  startServer,
  setBooks,
  getBooks,
  getSubmissions,
  clearSubmissions
};
