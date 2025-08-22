# Website Evaluator

A tool for evaluating websites against accessibility and usability criteria.

## How It Works

### Workflow

1. **Enter Website URL**: Input the website URL you want to evaluate
2. **Scrape Website**: Click the "Scrape" button to analyze the website and extract all available sections
3. **Review Sections**: Browse through the first 6 sections (click "Show More" to see all)
4. **Select Sections**: Choose one or more sections that you want to evaluate
5. **Evaluate**: Click "Evaluate Selected Sections" to send the chosen sections through the API for evaluation
6. **View Results**: See the evaluation results for each selected criterion

### Features

- **Smart Section Detection**: Automatically identifies main content areas, headers, navigation, and other important sections
- **Section Pagination**: Shows first 6 sections by default with option to expand to see all
- **Multi-Section Selection**: Choose multiple sections to evaluate together
- **Content Preview**: Click the eye icon to view full content in a large modal
- **Real-time Preview**: See a live preview of the website being evaluated
- **Criteria-based Evaluation**: Evaluate against customizable accessibility and usability criteria
- **API Integration**: Supports both local scraping and external API endpoints

### Technical Details

The application uses:
- **Client-side scraping** as a fallback when no API is available
- **CSS selector detection** to identify meaningful content sections
- **Text extraction** with intelligent length limiting
- **Duplicate removal** to avoid redundant evaluations
- **Content pagination** to manage large numbers of sections

### Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

```bash
npm run build
```

## Previous Workflow (Legacy)

The original workflow allowed users to:
- Enter a URL and selector
- Directly evaluate specific content areas
- View results immediately

This has been replaced with the more intuitive section-based approach.

# Trigger workflow
# Manual trigger for GitHub Actions
# GitHub Actions enabled - triggering deployment
# Final trigger for GitHub Actions deployment
