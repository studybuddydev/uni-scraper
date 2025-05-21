echo "Staring"
echo "Did you remember to set up config.ts?"
echo ""

echo "Running 10"
ts-node src/descrapper/10-courses.ts

echo "Running 11"
ts-node src/descrapper/11-courses-parse.ts

echo "Running 20"
ts-node src/descrapper/20-course-exams.ts

echo "Running 21"
ts-node src/descrapper/21-courses-exam-parser.ts

echo "Running 30"
ts-node src/descrapper/30-exams.ts

echo "Running 31"
ts-node src/descrapper/31-analysis-exams.ts

echo "Running 32"
ts-node src/descrapper/32-analysis-courses.ts

echo "Done"