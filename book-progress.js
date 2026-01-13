#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { startServer, setBooks, getSubmissions } = require('./server');
const ghostApi = require('./ghost-api');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  try {
    const booksPath = path.join(__dirname, 'books.json');
    const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

    // Initialize Ghost API
    ghostApi.initGhostApi();

    // Start the server
    let server;
    let port = 3456;
    try {
      server = await startServer(port);
      // Extract actual port from server
      port = server.address().port;
    } catch (error) {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    }

    // Set books data for the server
    setBooks(books);

    const progressData = [];

    console.log('📚 Book Progress Tracker\n');
    console.log(`Server running at http://localhost:${port}\n`);

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      console.log(`\n📖 ${book.title} by ${book.author}`);

      const startPct = await question('Start of day percentage (0-100): ');
      const endPct = await question('End of day percentage (0-100): ');

      const startNum = parseFloat(startPct);
      const endNum = parseFloat(endPct);

      if (isNaN(startNum) || isNaN(endNum) || startNum < 0 || startNum > 100 || endNum < 0 || endNum > 100) {
        console.log('❌ Please enter valid percentages between 0 and 100');
        i--;
        continue;
      }

      // Generate and display the notes URL
      const bookTitle = encodeURIComponent(book.title);
      const bookAuthor = encodeURIComponent(book.author);
      const notesUrl = `http://localhost:${port}/notes/${i}?book=${bookTitle}&author=${bookAuthor}`;

      console.log(`\n📝 Add notes (optional):`);
      console.log(`   ${notesUrl}`);
      console.log(`\nPress Enter to continue to next book (or submit notes in browser first)...`);

      // Clear any previous submission for this book
      getSubmissions().delete(i);

      // Wait for user to press Enter
      await question('');

      // Check if there's a submission from the web interface
      const submission = getSubmissions().get(i);
      let whatHappened = null;

      if (submission && submission.whatHappened) {
        whatHappened = submission.whatHappened;
        console.log('✓ Notes received from browser');
      }

      progressData.push({
        ...book,
        startProgress: startNum,
        endProgress: endNum,
        whatHappened
      });
    }

    rl.close();

    // Close the server
    server.close();

    generateHTML(progressData);
    console.log('\n✅ HTML file generated: book-progress.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}


function generateHTML(progressData) {
  const uniqueId = 'book-progress-' + Date.now();
  // Color extraction will happen client-side

  const html = `<div id="${uniqueId}" style="font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px;">
  <h2 style="text-align: center; color: #333; margin-bottom: 30px;">📚 Book Reading Progress</h2>

  <div style="margin-bottom: 20px; text-align: center;">
    <button id="animate-${uniqueId}" style="
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: transform 0.2s;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      ▶️ Animate Progress
    </button>
  </div>

  <div style="display: grid; gap: 20px;">
    ${progressData.map((book, index) => `
    <div style="
      display: flex;
      align-items: center;
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid #e1e5e9;
    ">
      <div style="
        width: 80px;
        height: 120px;
        margin-right: 20px;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      ">
        <img src="${book.cover}" alt="${book.title}" style="
          width: 100%;
          height: 100%;
          object-fit: cover;
        ">
      </div>

      <div style="flex: 1;">
        <h3 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 18px;">${book.title}</h3>
        <p style="margin: 0 0 15px 0; color: #7f8c8d; font-size: 14px;">by ${book.author}</p>

        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
          <div style="
            flex: 1;
            height: 20px;
            background: #ecf0f1;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
          ">
            <div id="progress-bar-${uniqueId}-${index}" style="
              height: 100%;
              background: #3498db;
              border-radius: 10px;
              width: ${book.startProgress}%;
              transition: width 2s ease-in-out;
              position: relative;
            "></div>
            <div style="
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              color: #2c3e50;
              font-size: 12px;
              font-weight: bold;
              pointer-events: none;
            " id="progress-text-${uniqueId}-${index}">
              ${book.startProgress}%
            </div>
          </div>
          <button id="play-${uniqueId}-${index}" style="
            width: 24px;
            height: 24px;
            border: none;
            background: #3498db;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <span style="color: white; font-size: 10px; margin-left: 1px;">▶</span>
          </button>
        </div>
${book.whatHappened ? `
        <details style="margin-top: 10px;">
          <summary style="
            cursor: pointer;
            color: #7f8c8d;
            font-size: 13px;
            font-weight: 500;
            user-select: none;
          ">What Happened</summary>
          <p style="
            margin: 8px 0 0 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            color: #2c3e50;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
          ">${book.whatHappened}</p>
        </details>
` : ''}
      </div>
    </div>
    `).join('')}
  </div>

  <script>
    // Store extracted colors globally
    const extractedColors = {};

    async function extractColorFromImage(imageUrl, index) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;

          ctx.drawImage(img, 0, 0);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            const colorCounts = {};

            // Sample every 10th pixel to improve performance
            for (let i = 0; i < data.length; i += 40) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // Skip transparent or very light pixels
              if (a < 125 || (r > 240 && g > 240 && b > 240)) {
                continue;
              }

              // Group similar colors by rounding to nearest 32
              const rKey = Math.round(r / 32) * 32;
              const gKey = Math.round(g / 32) * 32;
              const bKey = Math.round(b / 32) * 32;

              const key = \`\${rKey},\${gKey},\${bKey}\`;
              colorCounts[key] = (colorCounts[key] || 0) + 1;
            }

            // Find the most common color
            let dominantColor = null;
            let maxCount = 0;

            for (const [color, count] of Object.entries(colorCounts)) {
              if (count > maxCount) {
                maxCount = count;
                dominantColor = color;
              }
            }

            if (dominantColor) {
              let [r, g, b] = dominantColor.split(',').map(Number);
              // Ensure color is dark enough for good contrast
              let brightness = (r * 299 + g * 587 + b * 114) / 1000;
              if (brightness > 200) {
                // Darken bright colors
                const factor = 0.6;
                r = Math.round(r * factor);
                g = Math.round(g * factor);
                b = Math.round(b * factor);
                brightness = (r * 299 + g * 587 + b * 114) / 1000;
              }
              const textColor = brightness < 128 ? '#ffffff' : '#2c3e50';
              resolve({ barColor: \`rgb(\${r}, \${g}, \${b})\`, textColor });
            } else {
              resolve({ barColor: '#3498db', textColor: '#ffffff' }); // fallback
            }
          } catch (error) {
            console.warn('Could not extract color from image:', error);
            resolve({ barColor: '#3498db', textColor: '#ffffff' }); // fallback
          }
        };

        img.onerror = () => {
          console.warn('Could not load image for color extraction');
          resolve({ barColor: '#3498db', textColor: '#ffffff' }); // fallback
        };

        img.src = imageUrl;
      });
    }

    // Extract colors from all book covers on page load
    async function initializeColors() {
      const progressData = ${JSON.stringify(progressData)};

      for (let i = 0; i < progressData.length; i++) {
        const book = progressData[i];
        try {
          const { barColor, textColor } = await extractColorFromImage(book.cover, i);
          extractedColors[i] = { barColor, textColor };

          // Update UI elements with extracted color
          const progressBar = document.getElementById('progress-bar-${uniqueId}-' + i);
          const playButton = document.getElementById('play-${uniqueId}-' + i);

          if (progressBar) progressBar.style.background = barColor;
          if (playButton) playButton.style.background = barColor;
        } catch (error) {
          console.warn(\`Failed to extract color for book \${i}:\`, error);
          extractedColors[i] = { barColor: '#3498db', textColor: '#ffffff' };
        }
      }
    }

    // Initialize colors when DOM is ready
    document.addEventListener('DOMContentLoaded', initializeColors);
    // Also try to initialize immediately in case DOM is already ready
    if (document.readyState !== 'loading') {
      initializeColors();
    }

    document.getElementById('animate-${uniqueId}').addEventListener('click', function() {
      const button = this;
      button.disabled = true;
      button.textContent = '⏳ Animating...';

      const progressData = ${JSON.stringify(progressData)};

      progressData.forEach((book, index) => {
        const progressBar = document.getElementById('progress-bar-${uniqueId}-' + index);
        const progressText = document.getElementById('progress-text-${uniqueId}-' + index);

        // Reset to start position first
        progressBar.style.transition = 'none';
        progressText.style.transition = 'color 0.3s ease';
        progressBar.style.width = book.startProgress + '%';
        progressText.textContent = book.startProgress + '%';
        progressText.style.color = book.startProgress >= 50 ? (extractedColors[index]?.textColor || '#ffffff') : '#2c3e50';

        setTimeout(() => {
          // Re-enable transition and animate
          progressBar.style.transition = 'width 2s ease-in-out';
          progressBar.style.width = book.endProgress + '%';

          const startProgress = book.startProgress;
          const endProgress = book.endProgress;
          const duration = 2000;
          const startTime = Date.now();

          function updateText() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentProgress = startProgress + (endProgress - startProgress) * progress;

            progressText.textContent = Math.round(currentProgress) + '%';
            progressText.style.color = currentProgress >= 50 ? (extractedColors[index]?.textColor || '#ffffff') : '#2c3e50';

            if (progress < 1) {
              requestAnimationFrame(updateText);
            }
          }

          updateText();
        }, index * 200 + 50);
      });

      setTimeout(() => {
        button.disabled = false;
        button.textContent = '🔄 Animate Again';
      }, 2000 + progressData.length * 200);
    });

    function animateIndividualBook(index) {
      const progressData = ${JSON.stringify(progressData)};
      const book = progressData[index];
      const progressBar = document.getElementById('progress-bar-${uniqueId}-' + index);
      const progressText = document.getElementById('progress-text-${uniqueId}-' + index);
      const playButton = document.getElementById('play-${uniqueId}-' + index);

      playButton.disabled = true;

      // Reset to start position first
      progressBar.style.transition = 'none';
      progressText.style.transition = 'color 0.3s ease';
      progressBar.style.width = book.startProgress + '%';
      progressText.textContent = book.startProgress + '%';
      progressText.style.color = book.startProgress >= 50 ? (extractedColors[index]?.textColor || '#ffffff') : '#2c3e50';

      setTimeout(() => {
        // Re-enable transition and animate
        progressBar.style.transition = 'width 2s ease-in-out';
        progressBar.style.width = book.endProgress + '%';

        const startProgress = book.startProgress;
        const endProgress = book.endProgress;
        const duration = 2000;
        const startTime = Date.now();

        function updateText() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentProgress = startProgress + (endProgress - startProgress) * progress;

          progressText.textContent = Math.round(currentProgress) + '%';
          progressText.style.color = currentProgress >= 50 ? (extractedColors[index]?.textColor || '#ffffff') : '#2c3e50';

          if (progress < 1) {
            requestAnimationFrame(updateText);
          } else {
            playButton.disabled = false;
          }
        }

        updateText();
      }, 50);
    }

    // Add event listeners for individual play buttons
    ${progressData.map((_, index) => `
    document.getElementById('play-${uniqueId}-${index}').addEventListener('click', function() {
      animateIndividualBook(${index});
    });`).join('')}
  </script>
</div>`;

  fs.writeFileSync(path.join(__dirname, 'book-progress.html'), html);
}

main();