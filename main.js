var Twitter = require('twitter'),   // Twitter API wrapper: https://github.com/jdub/node-twitter
  opts = require('commander');      // Parse command line arguments

  opts.version('0.0.1')
  .option('-v, --verbose', 'Log some debug info to the console')
  .parse(process.argv);

// Initialize Twitter API keys
var twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// IDEA use google sheets as the database
// as you make tweets, map URLs to rows in google sheets

var RECIPES = [
  {
    url: 'http://www.cookinglight.com/food/quick-healthy/5-ingredient-pantry-recipes/simple-seared-scallops',
    name: 'Quinoa and Potato Croquettes',
    ingredients: ['BREAD', 'QUINOA', 'POTATOES']
  }
];

var SCREEN_NAME = 'DinnerCardGame',
  KICKSTARTER_URL = 'https://www.kickstarter.com/projects',
  REPLY_SENTINEL = 'What should I have for dinner?';

function isTweetForMe(data) {
  return data['in_reply_to_screen_name'] && data['in_reply_to_screen_name'].indexOf(SCREEN_NAME) >= 0;
}

function containsSentinel(data) {
  var regex = new RegExp(REPLY_SENTINEL, 'i');
  return regex.test(data['text']);
}

function constructRecipeTweet(userData) {
  var userMention = '@' +  userData['screen_name'];
  // TODO link to recipe
  return [userMention, RECIPES[0].name, RECIPES[0].url].join(' ');
}

function constructIngredientTweet(userData) {
  var userMention = '@' +  userData['screen_name'],
    preTweet = [userMention].concat(RECIPES[0].ingredients);

  preTweet.push(KICKSTARTER_URL);
  // TODO first three ingredients of recipe and kickstarter link
  return preTweet.join('\n');
}

// Verify the credentials
twitter.get('/account/verify_credentials', function(data) {
  if(opts.verbose) {
    console.log('credentials: ' + JSON.stringify(data));
  }
});

// process user stream events, in particular, mentions of us
twitter.stream('user', { 'with' : 'user' }, function(stream) {
  stream.on('data', function(streamData) {

    if(opts.verbose) {
      console.log('user stream data: ' + JSON.stringify(streamData));
    }

    // if the tweet isn't for me, we don't care
    if(!isTweetForMe(streamData)) {
      return;
    }

    // if they are asking about what to eat for dinner, give them
    // a recipe link
    if(containsSentinel(streamData)) {
      var tweet = constructRecipeTweet(streamData['user']);

      twitter.post('/statuses/update', { 'status' : tweet }, function(tweetData) {
        if(opts.verbose) {
          console.log('recipe tweet data: ' + JSON.stringify(tweetData));
        }
      });
    // if they are replying to a recipe link, give them the first 3 ingredients
    // and a link to the project's kickstarter
    } else if(streamData['in_reply_to_status_id_str'] !== null) {
      twitter.get('/statuses/show', { id: streamData['in_reply_to_status_id_str'] }, function(_parseBug, receivedTweetData) {

        if(opts.verbose) {
          console.log('received tweet data: ' + JSON.stringify(receivedTweetData));
        }

        // TODO refine search for recipe url
        if(receivedTweetData['text'].indexOf('http') >= 0) {
          var tweet = constructIngredientTweet(streamData['user']);

          twitter.post('/statuses/update', { 'status' : tweet }, function(updateTweetData) {
            if(opts.verbose) {
              console.log('ingredient tweet data: ' + JSON.stringify(updateTweetData));
            }
          });
        }
      });
    }
  });
});

// Handle exit signals
process.on('SIGINT', function(){
  process.exit(1);
});

process.on('exit', function(){
  console.log('Exiting...');
});
