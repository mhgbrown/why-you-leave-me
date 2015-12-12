# Why You Leave Me?
A Twitter bot that elicits feedback from unfollowers and saves it in a Google Sheet. It lends itself to easy deployment on [Heroku](https://www.heroku.com/).

[Here's my feedback](https://docs.google.com/spreadsheets/d/1sa7rdQANt8wzMdLJDFUL9cFLQ9o8ZfJzLQ4Vj53MigU/edit?usp=sharing)

## Requirements
You must have [Node.js and npm installed](http://nodejs.org/).

## Setup
These steps are Mac OS X oriented, but they should be similar for other platforms.

1. ```npm install``` (install dependencies)
2. ```cp .env.example .env``` (make a real .env)
3. [Create a new "App"](https://apps.twitter.com/) and copy your credentials into .env
4. [Follow these instructions](https://github.com/theoephraim/node-google-spreadsheet#service-account-recommended-method) to set up the Google Sheet
5. ```source .env``` (load the twitter credentials into your environment)
6. ```node main.js -v``` (wait for feedback...)
