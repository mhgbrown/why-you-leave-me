var Twitter = require('twitter'),  // Twitter API wrapper: https://github.com/jdub/node-twitter
  opts = require('commander'), // Parse command line arguments
  GoogleSpreadsheet = require("google-spreadsheet");

  opts.version('0.0.1')
  .option('-v, --verbose', 'Log some debug info to the console')
  .parse(process.argv);

var SCREEN_NAME = 'DinnerCardGame',
  KICKSTARTER_URL = 'http://dinnersreadygame.com/',
  REPLY_SENTINEL = 'What should I have for dinner?',
  RECIPE_SHEET_ID = '1XLmKJCayaLHlBMWFF91qZ9R3Ch3ZBH09X0esmp7xGtc',
  UPDATE_RECIPES_INTERVAL = 60000;

var GOOGLE_CREDS = {
  client_email: process.env.GOOGLE_SERVICE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_SERVICE_PRIVATE_KEY
};

// Initialize Twitter API keys
var twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

var RECIPE_SHEET = new GoogleSpreadsheet(RECIPE_SHEET_ID);

// always have one recipe here so we have something to work with
var recipes = {
  'http://www.epicurious.com/recipes/food/views/wild-rice-apple-and-dried-cranberry-stuffing-108759': {
    name: 'Wild Rice Stuffing',
    ingredients: [
      '1 cup wild rice',
      '1/2 lb white bread',
      '1 stick butter',
      '2 cups onion',
      '2 cups celery',
      '2 cups apple'
    ]
  }
};

function isTweetForMe(data) {
  return data['in_reply_to_screen_name'] && data['in_reply_to_screen_name'].indexOf(SCREEN_NAME) >= 0;
}

function containsSentinel(data) {
  var regex = new RegExp(REPLY_SENTINEL, 'i');
  return regex.test(data['text']);
}

function constructRecipeTweet(userData) {
  var userMention = '@' +  userData['screen_name'],
    recipeInfo = randomRecipe();

  return [userMention, recipeInfo[1].name, recipeInfo[0]].join(' ');
}

function constructIngredientTweet(userData, recipe) {
  var userMention = '@' +  userData['screen_name'],
    preTweet = [userMention].concat(recipe.ingredients.slice(0, 3));

  // TODO real kickstarter link
  preTweet.push('& more!');
  preTweet.push(KICKSTARTER_URL);
  return preTweet.join('\n');
}

function randomRecipe() {
    var keys = Object.keys(recipes),
      key = keys[ keys.length * Math.random() << 0];
    return [key, recipes[key]];
}

function containsRecipe(tweetData) {
  var urls = tweetData.entities.urls;
  return urls && urls.length && recipes[urls[0]['expanded_url']];
}

function updateRecipes() {
  console.log('Updating recipes...');
  try {
    RECIPE_SHEET.useServiceAccountAuth(GOOGLE_CREDS, function(authError) {
      if(authError) {
        throw authError;
      }

      RECIPE_SHEET.getInfo(function(sheetInfoError, sheetInfo) {
        if(sheetInfoError) {
          throw sheetInfoError;
        }

        // FIXME hopefully this worksheet exists
        var sheet1 = sheetInfo.worksheets[0];

        sheet1.getRows(function(rowsError, rows) {
          if(rowsError) {
            throw rowsError;
          }

          rows.forEach(function(recipeRow) {
            if(recipeRow.recipename && recipeRow.recipename.length &&
              recipeRow.link && recipeRow.link.length && recipeRow.link.indexOf('http') > -1) {
              recipes[recipeRow.link] = {
                name: recipeRow.recipename,
                ingredients: recipeRow.ingredients.split('\n')
              };
            }
          });
          console.log("Successfully updated " + Object.keys(recipes).length + " recipes");
        });
      });
    });

  } catch(error) {
    console.error('Failed to update recipes: ');
    console.error(error);
  }
}

// get those recipes updated
updateRecipes();
setInterval(updateRecipes, UPDATE_RECIPES_INTERVAL);


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

        var containedRecipe = containsRecipe(receivedTweetData);

        if(containedRecipe) {
          var tweet = constructIngredientTweet(streamData['user'], containedRecipe);

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
