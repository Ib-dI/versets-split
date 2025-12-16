const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Enregistre la police personnalisée
registerFont(path.join(__dirname, 'surah-name-v4.ttf'), { family: 'SuraFont' });

const outputDir = path.join(__dirname, 'outputDark');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Génère les noms : surah001 → surah114
const surahNames = Array.from({ length: 114 }, (_, i) => {
  const n = i + 1;
  return `surah${n.toString().padStart(3, '0')}`;
});

surahNames.forEach((glyphName) => {
  const fontSize = 100; // Taille haute résolution
  const scale = 2; // HiDPI (x2 pour netteté)

  // Crée un canvas temporaire pour mesurer le texte
  const tempCanvas = createCanvas(0, 0);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = `${fontSize}px "SuraFont"`;
  const textWidth = tempCtx.measureText(glyphName).width;
  const textHeight = fontSize * 1.2;

  // Applique la taille finale (avec marges) + scale
  const padding = 20;
  const canvasWidth = Math.ceil((textWidth + padding * 2) * scale);
  const canvasHeight = Math.ceil((textHeight + padding * 2) * scale);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // HiDPI
  ctx.scale(scale, scale);

  // Anticrénelage
  ctx.antialias = 'subpixel';

  // Fond 
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvasWidth / scale, canvasHeight / scale);

  // Texte 
  ctx.font = `${fontSize}px "SuraFont"`;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyphName, canvasWidth / scale / 2, canvasHeight / scale / 2);

  const buffer = canvas.toBuffer('image/png');
  const filename = `${glyphName}.png`;
  fs.writeFileSync(path.join(outputDir, filename), buffer);

  console.log(`✅ Généré : ${filename}`);
});

console.log('🎉 Tous les PNG haute qualité ont été créés dans /output');
