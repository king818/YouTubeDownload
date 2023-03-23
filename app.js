const express = require('express');
const https = require('https');
const ytdl = require('ytdl-core');
const ffmpegPath = require('ffmpeg-static').path;
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const app = express();
const port = 3000;

// Set up a static folder to serve index.html
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/', express.urlencoded({ extended: true }), (req, res) => {
    // Get the submitted fields from the request body
    const url = req.body.url;
    const mp4 = req.body.mp4 === 'on';
    const mp3 = req.body.mp3 === 'on';
    const mp4Quality = req.body['mp4-quality'];
    const mp3Quality = req.body['mp3-quality'];
  
  console.log("Received request: " + url , mp4 , mp4Quality, mp3, mp3Quality)
  if (!url) {
    return res.status(400).send('Please provide a valid YouTube video URL.');
  }

  if (!mp4 && !mp3) {
    return res.status(400).send('Please select at least one download format.');
  }

  const outputPath = path.join(__dirname, 'downloads');

  if (!fs.existsSync(outputPath)) {
    try {
      fs.mkdirSync(outputPath);
    } catch (error) {
      console.error(`Error creating downloads folder: ${error}`);
      return res.status(500).send('An error occurred while creating the downloads folder.');
    }
  }

  ytdl.getInfo(url, (error, info) => {
    if (error) {
      console.error(`Error getting video info: ${error}`);
      return res.status(500).send('An error occurred while getting video info.');
    }

    if (mp4) {
      const videoFormat = ytdl.chooseFormat(info.formats, { quality: mp4Quality || 'highest' });
      const videoFilePath = path.join(outputPath, `video-${info.videoId}.mp4`);
      const videoStream = ytdl(url, { format: videoFormat });
      const writeStream = fs.createWriteStream(videoFilePath);

      let startTime;
      let lastPercentage = 0;
      let totalDownloaded = 0;
      let totalSize = parseInt(videoFormat.contentLength);

      videoStream.on('data', chunk => {
        totalDownloaded += chunk.length;

        if (!startTime) {
          startTime = performance.now();
        } else if (performance.now() - startTime > 500) {
          const percentage = Math.floor(totalDownloaded / totalSize * 100);

          if (percentage > lastPercentage) {
            console.log(`Downloaded ${percentage}%`);
            lastPercentage = percentage;
          }

          startTime = performance.now();
        }
      });

      videoStream.on('error', error => {
        console.error(`Error downloading video: ${error}`);
        fs.unlink(videoFilePath, err => {
          if (err) {
            console.error(`Error deleting video file: ${err}`);
          }
        });
      });

      writeStream.on('error', error => {
        console.error(`Error writing video to file: ${error}`);
        fs.unlink(videoFilePath, err => {
          if (err) {
            console.error(`Error deleting video file: ${err}`);
          }
        });
      });

      writeStream.on('finish', () => {
        console.log(`Video downloaded: ${videoFilePath}`);
      });

      videoStream.pipe(writeStream);
    }

    if (mp3) {
      const audioFormat = ytdl.filterFormats(info.formats, 'audioonly')[0];
      const audioFilePath = path.join(outputPath, `audio-${info.videoId}.mp3`);

      ffmpeg.setFfmpegPath(ffmpegPath);

      ffmpeg(ytdl(url, { format: audioFormat }))
        .format('mp3')
        .audioBitrate(mp3Quality || '192k')
        .on('progress', progress => {
          const percentage = Math.floor(progress.percent);
          console.log(`Extracted ${percentage}% of audio`);
        })
        .on('error', error => {
          console.error(`Error converting audio: ${error}`);
          fs.unlink(audioFilePath, err => {
            if (err) {
              console.error(`Error deleting audio file: ${err}`);
            }
          });
        })
        .save(audioFilePath)
        .on('end', () => {
          console.log(`Audio extracted: ${audioFilePath}`);
        });
    }

    res.status(200).send('Downloads started successfully.');
  });
});

// Start the server
/*
https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app)
.listen(port, () => {
  console.log(`YouTube Download server App listening at http://localhost:${port}`);
});
*/

app.listen(port, function() {
    console.log(`YouTube Download server App listening at http://localhost:${port}`);
});

// adding this comment to play with git diff app.js and git checkout app.js to retrieve from local repo to working directory.