const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const regex = /<div class="speaker-notes-box"[\s\S]*?<\/div>/g;
  const matches = content.match(regex);
  console.log(`Found ${matches ? matches.length : 0} speaker notes in ${filePath}`);
  content = content.replace(regex, '');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

cleanFile(path.join(__dirname, '..', 'presentation.html'));
cleanFile(path.join(__dirname, '..', 'docs', 'apresentacao', 'apresentacao-camera-geolocalizacao.html'));

