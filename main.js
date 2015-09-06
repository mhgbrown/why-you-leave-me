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

// Verify the credentials
twitter.get('/account/verify_credentials', function(data) {

  if(opts.verbose) {
    process.stdout.write("credentials: " + JSON.stringify(data));
  }

});

twitter.stream('user', { 'with' : 'user' }, function(stream) {
    stream.on('data', function(data) {
        process.stdout.write("credentials: " + JSON.stringify(data));
    });
});

// Handle exit signals
process.on('SIGINT', function(){
  process.exit(1);
});

process.on('exit', function(){
  process.stdout.write("Exiting...");
});
