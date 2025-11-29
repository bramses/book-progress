#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');

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

    const progressData = [];

    console.log('📚 Book Progress Tracker\n');

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

      progressData.push({
        ...book,
        startProgress: startNum,
        endProgress: endNum
      });
    }

    rl.close();

    generateHTML(progressData);
    console.log('\n✅ HTML file generated: book-progress.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}

function generateHTML(progressData) {
  const uniqueId = 'book-progress-' + Date.now();

  const html = `<div id="${uniqueId}" style="font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px;">
  <h2 style="text-align: center; color: #333; margin-bottom: 30px;">📚 Book Reading Progress</h2>

  <div style="margin-bottom: 20px; text-align: center;">
    <button id="animate-${uniqueId}" style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

        <div style="margin-bottom: 8px;">
          <div style="
            width: 100%;
            height: 20px;
            background: #ecf0f1;
            border-radius: 10px;
            overflow: hidden;
            position: relative;
          ">
            <div id="progress-bar-${uniqueId}-${index}" style="
              height: 100%;
              background: linear-gradient(90deg, #3498db, #2ecc71);
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
        </div>

      </div>
    </div>
    `).join('')}
  </div>

  <script>
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
        progressBar.style.width = book.startProgress + '%';
        progressText.textContent = book.startProgress + '%';

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
  </script>
</div>`;

  fs.writeFileSync(path.join(__dirname, 'book-progress.html'), html);
}

main();