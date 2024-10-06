# uni-scraper
scrape syllabus and list of exams from cineca, tra UNIBS e UNITN controlla bene URL base e il bottone 'insegnamenti' 

## Theere are different steps in the scraping process:
1) get courses

this url is the starting point, it contains the list of all courses of a university in a specific academic year
```
https://unibs.coursecatalogue.cineca.it/corsi/2024?gruppo=1617109934164


output: 
courseUrls.json 

for each course we now have a list of urls, one per year, because we have to look at the anno di offerta, so first year exams will be available at 2024/2025, second year at 2023/2024, there could be multiple for one year becuase of different course path 


```json
"[0115G] Amministrazione Aziendale e Diritto": {
    "2024/2025": [
        "https://unitn.coursecatalogue.cineca.it/corsi/2024/10126/insegnamenti/50482?schemaid=8270",
        "https://unitn.coursecatalogue.cineca.it/corsi/2024/10126/insegnamenti/50483?schemaid=8268"
    ],
    "2023/2024": [
        "https://unitn.coursecatalogue.cineca.it/corsi/2023/10126/insegnamenti/50287?schemaid=8455",
        "https://unitn.coursecatalogue.cineca.it/corsi/2023/10126/insegnamenti/50343?schemaid=8457"
    ],
    "2022/2023": [
        "https://unitn.coursecatalogue.cineca.it/corsi/2022/10126/insegnamenti/49341?schemaid=8458",
        "https://unitn.coursecatalogue.cineca.it/corsi/2022/10126/insegnamenti/49340?schemaid=8460"
    ],
    "2021/2022": [
        "https://unitn.coursecatalogue.cineca.it/corsi/2021/10126/insegnamenti/49338?schemaid=7902",
        "https://unitn.coursecatalogue.cineca.it/corsi/2021/10126/insegnamenti/49337?schemaid=7904"
    ],
    "2020/2021": [
        "https://unitn.coursecatalogue.cineca.it/corsi/2020/10126/insegnamenti/49335?schemaid=7319",
        "https://unitn.coursecatalogue.cineca.it/corsi/2020/10126/insegnamenti/49334?schemaid=7320"
    ]
}
```

2) get exam
