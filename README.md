# Twitter Statuses Stream Boilerplate
A simple node script that demonstrates connecting to Twitter's Streaming API for statuses (aka tweets). It also lends itself to easy deployment on [Heroku](https://www.heroku.com/).

## Requirements
You must have [Node.js and npm installed](http://nodejs.org/).

## Setup
These steps are Mac OS X oriented, but they should be similar for other platforms.

1. ```npm install``` (install dependencies)
2. ```cp .env.example .env``` (make a real .env)
3. [Create a new "App"](https://apps.twitter.com/) and copy your credentials into .env
3. ```source .env``` (load the twitter credentials into your environment)
4. ```node main.js -v``` (let the tweets flow!)