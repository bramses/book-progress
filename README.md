<img width="1552" height="1746" alt="Screenshot 2025-11-29 16-22-45" src="https://github.com/user-attachments/assets/7c36b646-83ec-455b-8031-731d4c60c167" />

# Book Progress Tracker

A Node.js CLI tool that tracks daily reading progress across multiple books and generates an animated HTML visualization.

## What it does

- Reads book data from `books.json` (title, author, cover image)
- Prompts for start-of-day and end-of-day reading percentages for each book
- Generates an interactive HTML file with:
  - Book covers alongside animated progress bars
  - Progress percentages centered in each bar
  - "Animate Progress" button that smoothly transitions all bars from start to end percentages
  - Staggered animation timing for visual appeal

## Usage

```bash
node book-progress.js
```

The script will:
1. Loop through each book in `books.json`
2. Prompt you to enter start and end percentages (0-100)
3. Generate `book-progress.html` with your progress visualization

## Files

- **books.json** - Book data (title, author, cover URL)
- **book-progress.js** - Main CLI script
- **book-progress.html** - Generated output (created after running script)

## Customization

Edit `books.json` to add/remove books or update cover images. The script automatically adapts to any number of books.