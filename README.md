# uni-scraper

this repository is a mess, a battlefield, we needed the quick and dirty solution and i decided to test agentic mode of copilot, making it access to the previous scraping code asking it to generate a new version of the scraper more robust. 

in the folder agentic_magic there are many files created and edited using claude Sonnet 4 with github copilot in agentic mode, it is probably not the best code ever, but it works and it is a good starting point to improve the scraper in the future. it needs some polish 


1) go in config/scraping.config.json and edit the university section with your university data, you can find the baseUrl in the course catalog of your university, the id is the id of the university in the cineca course catalog, you can find it in the url of the course catalog, for example for unibs it is unibs, for unimi it is unimi, for unibg it is unibg, etc.

2) 
run the following command to build the project and to scrape the data exams :

```bash
 npm run agentic:full 
```


