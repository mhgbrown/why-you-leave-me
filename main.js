#!/usr/bin/env node

var _ = require('lodash'),
  Twitter = require('twitter'),
  opts = require('commander'),
  GoogleSpreadsheet = require('google-spreadsheet');

  opts.version('0.0.1')
  .option('-v, --verbose', 'Log some debug info to the console')
  .parse(process.argv);

var FEEDBACK_SHEET_ID = process.env.FEEDBACK_SHEET_ID;

var GOOGLE_CREDS = {
  client_email: process.env.GOOGLE_SERVICE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_SERVICE_PRIVATE_KEY
};

var TWITTER_CREDS = {
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
};

var TWITTER = new Twitter(TWITTER_CREDS);
var FEEDBACK_SHEET = new GoogleSpreadsheet(FEEDBACK_SHEET_ID);

var CHECK_FOLLOWERS_INTERVAL = 60000;
var ELICITING_QUESTION = 'thanks for following! Could I ask why you unfollowed?';
var BOT_APPENDAGE = '[bot produced: https://github.com/mhgbrown/why-you-leave-me]';

var account;
var followers = [];

function saveFeedback(tweetData) {
  console.log('Saving feedback...');
  try {
    FEEDBACK_SHEET.useServiceAccountAuth(GOOGLE_CREDS, function(authError) {
      if(authError) {
        throw authError;
      }

      FEEDBACK_SHEET.addRow(1, {
        'username': tweetData.user.screen_name,
        'userid': tweetData.user.id_str,
        'name': tweetData.user.name,
        'location': tweetData.user.location,
        'url': tweetData.user.url,
        'description': tweetData.user.description,
        'followers': tweetData.user.followers_count,
        'date': tweetData.created_at,
        'feedback': tweetData.text,
        'myfollowers': followers.length + ''
      });

      console.log('Successfully saved feedback');
      if(!opts.verbose) {
        return;
      }

      FEEDBACK_SHEET.getInfo(function(sheetInfoError, sheetInfo) {
        if(sheetInfoError) {
          throw sheetInfoError;
        }

        // FIXME hopefully this worksheet exists
        var sheet1 = sheetInfo.worksheets[0];
        sheet1.getRows(function(rowsError, rows) {
          if(rowsError) {
            throw rowsError;
          }

          rows.forEach(function(row) {
            console.log('row: ' + JSON.stringify(row))
          });
        });
      });
    });

  } catch(error) {
    console.error('Failed to save feedback!');
    console.error(error);
  }
}

function isTweetForMe(data) {
  return data.in_reply_to_screen_name && data.in_reply_to_screen_name.indexOf(account.screen_name) >= 0;
}

function composeQuestion(user) {
  return ['@' + user.screen_name, ELICITING_QUESTION, BOT_APPENDAGE].join(' ');
}

function elicitFeedback(user) {
  TWITTER.post('statuses/update', { 'status':  composeQuestion(user) }, function(error, tweet, response) {
    if(error) return console.error(error);

    if(opts.verbose) {
      console.log('elicit feedback: ' + JSON.stringify(response));
    }
    // that's it! Now we wait...
  });
}

function checkFollowers() {
  // FIXME if this is > 5000, need to start paginating
  TWITTER.get('followers/ids', { 'stringify_ids': true }, function(error, data, response) {
    if(error) return console.error(error);

    if(opts.verbose) {
      console.log('check followers: ' + JSON.stringify(response));
    }

    var followerIds = data.ids;
    var difference = _.difference(followers, followerIds);
    followers = followerIds;
    // difference gives me exactly those people which are not found
    // in my new list of followers, aka the people who left me :(
    if(!difference.length) {
      return;
    }

    console.log('eliciting feedback...')
    TWITTER.get('users/lookup', { 'user_id': difference.join(',') }, function(error, data, response) {
      if(error) return console.error(error);

      _.each(data, function(user) {
        elicitFeedback(user);
      });
    });
  });
}

// Verify the credentials
TWITTER.get('/account/verify_credentials', function(error, data, response) {
  if(error) return console.error(error);

  if(opts.verbose) {
    console.log('credentials: ' + JSON.stringify(data));
  }

  account = data;
});

// Set followers for the first time
TWITTER.get('followers/ids', { 'stringify_ids': true }, function(error, data, response) {
  if(error) return console.error(error);

  if(opts.verbose) {
    console.log('follower ids: ' + JSON.stringify(data));
  }

  followers = data.ids;
});

// process user stream events, in particular, mentions of us
TWITTER.stream('user', { 'with': 'user' }, function(stream) {
  stream.on('data', function(streamData) {

    if(opts.verbose) {
      console.log('user stream data: ' + JSON.stringify(streamData));
    }

    // if the tweet isn't for me, we don't care
    if(!isTweetForMe(streamData)) {
      return;
    }

    // if it's not in reply to another status (the eliciting status),
    // then we don't care
    if(!streamData.in_reply_to_status_id_str) {
      return;
    }

    // check to see if the tweet they replied to was the one with the eliciting
    // question
    TWITTER.get('/statuses/show', { id: streamData.in_reply_to_status_id_str }, function(error, tweetData, reponse) {
      if(error) return console.error(error);

      if(opts.verbose) {
        console.log('reply tweet data: ' + JSON.stringify(streamData));
      }

      if(tweetData.text.indexOf(ELICITING_QUESTION) > -1) {
        saveFeedback(streamData);
      }
    });
  });

  stream.on('error', function(error) {
    console.error(error);
  });
});

setInterval(checkFollowers, CHECK_FOLLOWERS_INTERVAL);

// Handle exit signals
process.on('SIGINT', function(){
  process.exit(1);
});

process.on('exit', function(){
  console.log('Exiting...');
});
