/* jshint esnext: true */

let Parser = require('rss-parser'),
  Entities = require('html-entities').AllHtmlEntities,
 csvWriter = require('csv-write-stream'),
 striptags = require('striptags'),
        fs = require('fs'),
    outdir = 'output'; // CONFIGURE output path here


// Load the blogs from here
require('./blogs.json')
.forEach((source, index) => {

  let counter = 1;

  const http = require('http');

  function getBetterURL(callback) {

    return http.get(source.url, (res) => {

      let body = [];

      res.on('data', (chunk) => {
        body.push(chunk);
      });

      res.on('end', (e) => {
        try {
          let response = /(?:<link rel='self' type='application\/atom\+xml' href=')(.*?)(?='\s?\/>)/.exec(body.join(''))[1];
          callback(response + '?max-results=9999&alt=rss&prettyprint=true');
          if (!fs.existsSync(outdir)) fs.mkdirSync(outdir);
        }
        catch(err) {
          console.error(body.join());
        }
      });

    }).on('error', (e) => {
      console.error(e);
      callback(source.url);
    });
  }

  getBetterURL((response) => {
    if(response) {
      parseFeed({ name: source.name, url: response }, counter);
    } else {
      parseFeed(source, counter);
    }
  });
});

function parseFeed(source, counter) {

  let parser = new Parser();
   
  (async () => {
   
    let feed = await parser.parseURL(source.url);
     
    console.log('\n' + feed.title.replace(/^Page \d{1,} – /, ''), '\n' + source.url);

    if (!feed.items.length) return;
   
    feed.items.reverse().forEach((item, index) => {

      console.log(index + 1, item.title);
      
      var entities = new Entities();
      var body = entities.decode(item.content) || entities.decode(item['content:encoded']);

      var writer = csvWriter({
        separator: ',',
        newline: '\n',
        headers: ['blog', 'title', 'date', 'text'],
        sendHeaders: true
      });
      writer.pipe(fs.createWriteStream(outdir + '/' + source.name + '-' + pad(counter, 3) + '.csv'));
      writer.write({
        blog: feed.title.replace(/^Page \d{1,} – /, ''),
        // Fallback to publication date when title is empty
        title: (typeof item.title === 'string') ? item.title : new Date(item.published || item.pubDate).toUTCString(),
        date: item.pubDate || item.published,
        text: striptags(body).trim()
      });
      writer.end();

      counter++;
    });
   
  })();

}

function pad(number, size) {
  var s = String(number);
  while (s.length < (size || 2)) { s = "0" + s; }
  return s;
}
