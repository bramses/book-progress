// Get book index from URL
const pathParts = window.location.pathname.split('/');
const bookIndex = parseInt(pathParts[pathParts.length - 1], 10);

// Book data
let bookData = null;

// Selected page for "Add to Existing"
let selectedPage = null;

// Stored updates (page references created/updated during this session)
const updates = [];

// @ mention tracking
const mentions = new Map(); // Maps display text to tag info

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadBookData();
  setupMentionDetection();
});

async function loadBookData() {
  try {
    const response = await fetch(`/api/book/${bookIndex}`);
    if (!response.ok) {
      throw new Error('Book not found');
    }
    bookData = await response.json();
    document.getElementById('book-title').textContent = bookData.title;
    document.getElementById('book-author').textContent = `by ${bookData.author}`;

    // Pre-fill create modal
    document.getElementById('create-book-title').value = bookData.title;
    document.getElementById('create-author').value = bookData.author;
  } catch (error) {
    document.getElementById('book-title').textContent = 'Error loading book';
    console.error(error);
  }
}

// @ Mention Detection
function setupMentionDetection() {
  const textarea = document.getElementById('notes-textarea');
  const dropdown = document.getElementById('mention-dropdown');
  let mentionStartPos = -1;
  let selectedIndex = -1;
  let currentResults = [];

  textarea.addEventListener('input', async (e) => {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Find @ symbol before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
      // Check if there's a space after @ (mention completed)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        mentionStartPos = lastAtPos;
        const query = textAfterAt;

        // Search for tags
        const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
        currentResults = await response.json();

        if (currentResults.length > 0) {
          showMentionDropdown(currentResults, textarea, lastAtPos);
          selectedIndex = -1;
        } else {
          hideMentionDropdown();
        }
        return;
      }
    }

    hideMentionDropdown();
    mentionStartPos = -1;
  });

  textarea.addEventListener('keydown', (e) => {
    if (dropdown.style.display !== 'block') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateDropdownSelection(selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateDropdownSelection(selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectMention(currentResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      hideMentionDropdown();
    }
  });

  function showMentionDropdown(results, textarea, atPos) {
    dropdown.innerHTML = results.map((tag, index) => `
      <div class="mention-item" data-index="${index}" onclick="selectMentionByIndex(${index})">
        ${tag.name}
      </div>
    `).join('');

    // Position dropdown near cursor
    const rect = textarea.getBoundingClientRect();
    dropdown.style.left = '16px';
    dropdown.style.top = '60px';
    dropdown.style.display = 'block';
  }

  function updateDropdownSelection(index) {
    const items = dropdown.querySelectorAll('.mention-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
  }

  window.selectMentionByIndex = (index) => {
    selectMention(currentResults[index]);
  };

  function selectMention(tag) {
    const textarea = document.getElementById('notes-textarea');
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    // Replace @query with @TagName
    const newText = text.substring(0, lastAtPos) + '@' + tag.name + ' ' + text.substring(cursorPos);
    textarea.value = newText;

    // Store mention for later conversion
    mentions.set(tag.name, tag);

    // Move cursor after the mention
    const newCursorPos = lastAtPos + tag.name.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    hideMentionDropdown();
  }

  function hideMentionDropdown() {
    dropdown.style.display = 'none';
  }
}

// Create Modal
function openCreateModal() {
  document.getElementById('create-modal').classList.add('active');
  document.getElementById('create-success').classList.remove('active');
  document.getElementById('create-error').classList.remove('active');
}

function closeCreateModal() {
  document.getElementById('create-modal').classList.remove('active');
  document.getElementById('create-character').value = '';
  document.getElementById('create-content').value = '';
}

async function createPage() {
  const bookTitle = document.getElementById('create-book-title').value.trim();
  const author = document.getElementById('create-author').value.trim();
  const characterOrSetting = document.getElementById('create-character').value.trim();
  const content = document.getElementById('create-content').value.trim();

  if (!characterOrSetting || !content) {
    document.getElementById('create-error').textContent = 'Please fill in all fields';
    document.getElementById('create-error').classList.add('active');
    return;
  }

  try {
    const response = await fetch('/api/create-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterOrSetting, bookTitle, author, content })
    });

    const result = await response.json();

    if (result.success) {
      // Add to updates list
      updates.push({
        type: 'create',
        name: characterOrSetting,
        bookTitle,
        author,
        content,
        page: result.page
      });
      updateUpdatesList();

      document.getElementById('create-success').textContent = `Page created: ${result.page.title}`;
      document.getElementById('create-success').classList.add('active');
      document.getElementById('create-error').classList.remove('active');

      // Clear form
      document.getElementById('create-character').value = '';
      document.getElementById('create-content').value = '';

      // Close modal after delay
      setTimeout(closeCreateModal, 1500);
    } else {
      throw new Error(result.error || 'Failed to create page');
    }
  } catch (error) {
    document.getElementById('create-error').textContent = error.message;
    document.getElementById('create-error').classList.add('active');
    document.getElementById('create-success').classList.remove('active');
  }
}

// Add to Existing Modal
function openAddExistingModal() {
  document.getElementById('add-existing-modal').classList.add('active');
  document.getElementById('add-success').classList.remove('active');
  document.getElementById('add-error').classList.remove('active');
  selectedPage = null;
  document.getElementById('search-pages').value = '';
  document.getElementById('selected-page-info').classList.remove('active');
  document.getElementById('add-content-group').style.display = 'none';
  document.getElementById('add-to-page-btn').disabled = true;
}

function closeAddExistingModal() {
  document.getElementById('add-existing-modal').classList.remove('active');
  document.getElementById('search-pages').value = '';
  document.getElementById('add-content').value = '';
  document.getElementById('search-results').classList.remove('active');
  selectedPage = null;
}

let searchTimeout = null;

async function searchPages() {
  const query = document.getElementById('search-pages').value.trim();
  const resultsDiv = document.getElementById('search-results');

  if (query.length < 2) {
    resultsDiv.classList.remove('active');
    return;
  }

  // Debounce
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const pages = await response.json();

      if (pages.length === 0) {
        resultsDiv.innerHTML = '<div class="autocomplete-item">No results found</div>';
      } else {
        resultsDiv.innerHTML = pages.map((page, index) => `
          <div class="autocomplete-item" onclick="selectPage(${index})">
            <div class="autocomplete-item-name">${page.characterOrSetting}</div>
            <div class="autocomplete-item-context">${page.bookTitle} by ${page.author}</div>
          </div>
        `).join('');
      }

      resultsDiv.classList.add('active');

      // Store results for selection
      window.searchResults = pages;
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300);
}

function selectPage(index) {
  const page = window.searchResults[index];
  selectedPage = page;

  // Update UI
  document.getElementById('search-pages').value = page.characterOrSetting;
  document.getElementById('search-results').classList.remove('active');
  document.getElementById('selected-page-info').classList.add('active');
  document.getElementById('selected-page-name').textContent = page.characterOrSetting;
  document.getElementById('selected-page-context').textContent = `${page.bookTitle} by ${page.author}`;
  document.getElementById('add-content-group').style.display = 'block';
  document.getElementById('add-to-page-btn').disabled = false;
}

async function addToPage() {
  if (!selectedPage) return;

  const content = document.getElementById('add-content').value.trim();

  if (!content) {
    document.getElementById('add-error').textContent = 'Please enter content to add';
    document.getElementById('add-error').classList.add('active');
    return;
  }

  try {
    const response = await fetch('/api/update-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: selectedPage.id, content })
    });

    const result = await response.json();

    if (result.success) {
      // Add to updates list
      updates.push({
        type: 'update',
        name: selectedPage.characterOrSetting,
        bookTitle: selectedPage.bookTitle,
        author: selectedPage.author,
        content,
        page: result.page
      });
      updateUpdatesList();

      document.getElementById('add-success').textContent = `Content added to: ${result.page.title}`;
      document.getElementById('add-success').classList.add('active');
      document.getElementById('add-error').classList.remove('active');

      // Clear form
      document.getElementById('add-content').value = '';
      selectedPage = null;
      document.getElementById('selected-page-info').classList.remove('active');
      document.getElementById('add-content-group').style.display = 'none';
      document.getElementById('add-to-page-btn').disabled = true;

      // Close modal after delay
      setTimeout(closeAddExistingModal, 1500);
    } else {
      throw new Error(result.error || 'Failed to update page');
    }
  } catch (error) {
    document.getElementById('add-error').textContent = error.message;
    document.getElementById('add-error').classList.add('active');
    document.getElementById('add-success').classList.remove('active');
  }
}

// Updates list
function updateUpdatesList() {
  const container = document.getElementById('updates-container');
  const listDiv = document.getElementById('updates-list');

  if (updates.length === 0) {
    listDiv.style.display = 'none';
    return;
  }

  listDiv.style.display = 'block';
  container.innerHTML = updates.map((update, index) => `
    <div class="update-item">
      <div class="update-item-info">
        <div class="update-item-name">${update.name}</div>
        <div class="update-item-book">${update.bookTitle} by ${update.author}</div>
      </div>
      <button class="btn btn-danger" onclick="removeUpdate(${index})" style="padding: 4px 8px; font-size: 12px;">Remove</button>
    </div>
  `).join('');
}

function removeUpdate(index) {
  updates.splice(index, 1);
  updateUpdatesList();
}

// Process @ mentions in text and convert to HTML
function processTextWithMentions(text) {
  // First escape HTML in the text
  let processedText = escapeHtmlForNotes(text);

  // Replace @mentions with links (need to escape the name for regex)
  mentions.forEach((tag, name) => {
    const escapedName = escapeHtmlForNotes(name);
    const regex = new RegExp(`@${escapeRegex(escapedName)}\\b`, 'g');
    processedText = processedText.replace(regex, `<a href="${tag.url}">${escapedName}</a>`);
  });

  // Convert newlines to <br>
  processedText = processedText.replace(/\n/g, '<br>');

  return processedText;
}

// Escape HTML for notes (different from the one used for updates)
function escapeHtmlForNotes(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generate "What Happened" content as HTML
function generateWhatHappenedContent() {
  const notes = document.getElementById('notes-textarea').value.trim();
  const processedNotes = processTextWithMentions(notes);

  if (updates.length === 0 && !notes) {
    return null;
  }

  let content = '';

  if (updates.length > 0) {
    content += '<strong>Updates</strong><br><br>';
    updates.forEach(update => {
      const slug = update.page.slug || update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const pageUrl = `https://www.bramadams.dev/${slug}/`;
      const truncatedContent = update.content.substring(0, 50) + (update.content.length > 50 ? '...' : '');
      content += `- <a href="${pageUrl}">${escapeHtmlForNotes(update.name)}</a>...${escapeHtmlForNotes(truncatedContent)}<br>`;
    });
  }

  if (notes) {
    if (content) content += '<br>';
    content += processedNotes;
  }

  return content;
}


// Submit notes
async function submitNotes() {
  const whatHappened = generateWhatHappenedContent();

  try {
    const response = await fetch(`/api/submit/${bookIndex}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: document.getElementById('notes-textarea').value,
        updates: updates,
        whatHappened
      })
    });

    if (response.ok) {
      // Show success and close window
      alert('Notes submitted! You can close this tab and press Enter in the CLI.');
      window.close();
    } else {
      throw new Error('Failed to submit');
    }
  } catch (error) {
    alert('Error submitting notes: ' + error.message);
  }
}

// Skip and close
function skipAndClose() {
  fetch(`/api/submit/${bookIndex}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: '', updates: [], whatHappened: null })
  }).then(() => {
    window.close();
  });
}

// Expose functions to global scope for inline onclick handlers
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.createPage = createPage;
window.openAddExistingModal = openAddExistingModal;
window.closeAddExistingModal = closeAddExistingModal;
window.searchPages = searchPages;
window.selectPage = selectPage;
window.addToPage = addToPage;
window.removeUpdate = removeUpdate;
window.submitNotes = submitNotes;
window.skipAndClose = skipAndClose;
