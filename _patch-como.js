const fs = require('fs');
const s = fs.readFileSync('index.html', 'utf8');
const a = s.indexOf('<section class="section" id="como-funciona">');
const b = s.indexOf('</section> <!-- FORM / FLUJO');
if (a === -1 || b === -1) {
  console.error('HTML markers', a, b);
  process.exit(1);
}
const oldSec = s.slice(a, b + '</section>'.length);
console.log('HTML len', oldSec.length);
fs.writeFileSync('_como-old.html', oldSec);

const cssStart = s.indexOf('#como-funciona {');
const cssEndMarker = '/* ── FORM SECTION ── */';
const cssEnd = s.indexOf(cssEndMarker);
if (cssStart === -1 || cssEnd === -1) {
  console.error('CSS markers', cssStart, cssEnd);
  process.exit(1);
}
// #como-funciona might appear in @media too - we need the first block that is the main como-funciona styles
// Actually the SECTIONS COMUNES block comes before #como-funciona in file order - let me find
