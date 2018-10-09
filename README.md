# Travis Scraper

A script to get information about builds for a repository and compute some statistics.

## Use

Clone this repo
```
git clone <repo url>
cd travis-scrape
```

Install dependencies
```
npm install
npm install -g node-ts
```

Run the script
```
npm run scrape
```

Generate documentation, into the doc directory
```
npm install -g typedoc typescript
npm run build-docs
```