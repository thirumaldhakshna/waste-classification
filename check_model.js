const https = require('https');
https.get("https://teachablemachine.withgoogle.com/models/UVSr7Uv0z/metadata.json", res => {
  let data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => console.log(Buffer.concat(data).toString()));
});
