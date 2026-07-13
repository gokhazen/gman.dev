/**
 * EkoGokhan Multimodal Transit Models — Pseudo-3D (Gradient Depth)
 * Araçlar kuş bakışı + gradient derinlik ile çizilir.
 * Bearing rotasyonu map.js'de uygulanır; aracın önü bearing yönüne bakar.
 * Her çağrıda benzersiz gradient ID üretilir (çoklu marker çakışmasını önler).
 */

let _modelSeq = 0;

window.getVehicleModel = function(type, mainColor, shadowColor) {
  const uid = 'vm' + (_modelSeq++);
  const topColor = shadeColor(mainColor, 25);
  const midColor = mainColor;
  const botColor = shadeColor(mainColor, -15);
  const windowColor = '#e0f2fe';
  const windowEdge = '#bae6fd';
  const wheelColor = '#0f172a';
  const wheelRim = '#475563';
  const headlightColor = '#fde047';
  const headlightEdge = '#eab308';

  const groundShadow = `<ellipse cx="32" cy="50" rx="22" ry="4" fill="rgba(0,0,0,0.18)"/>`;

  const defs = `
    <defs>
      <linearGradient id="body-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${topColor}"/>
        <stop offset="0.5" stop-color="${midColor}"/>
        <stop offset="1" stop-color="${botColor}"/>
      </linearGradient>
      <linearGradient id="roof-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shadeColor(topColor, 8)}"/>
        <stop offset="1" stop-color="${topColor}"/>
      </linearGradient>
    </defs>
  `;

  const wheel = (cx, cy, r) => `
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r*0.85}" fill="${wheelColor}"/>
    <ellipse cx="${cx}" cy="${cy-0.5}" rx="${r*0.55}" ry="${r*0.45}" fill="${wheelRim}"/>
    <ellipse cx="${cx}" cy="${cy-1}" rx="${r*0.25}" ry="${r*0.2}" fill="${shadeColor(wheelRim, 20)}"/>
  `;

  const wagonAnimation = `
    <style>
      @keyframes wagonPull${uid} {
        0% { transform: translateX(0); }
        25% { transform: translateX(-0.8px); }
        50% { transform: translateX(0); }
        75% { transform: translateX(0.4px); }
        100% { transform: translateX(0); }
      }
      .wp-${uid} { animation: wagonPull${uid} 2.5s infinite ease-in-out; }
    </style>
  `;

  let modelHtml = '';

  switch(type) {
    case 2: // TRAMVAY (2 Vagon)
      modelHtml = `
        ${groundShadow}
        <g class="wp-${uid}">
          <rect x="4" y="22" width="24" height="22" rx="6" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="7" y="25" width="7" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="16" y="25" width="7" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="5" y="36" width="22" height="3" rx="1" fill="${shadeColor(topColor, 15)}" opacity="0.6"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.5s">
          <rect x="34" y="22" width="24" height="22" rx="6" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="37" y="25" width="7" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="46" y="25" width="7" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="35" y="36" width="22" height="3" rx="1" fill="${shadeColor(topColor, 15)}" opacity="0.6"/>
        </g>
        <rect x="28" y="31" width="6" height="4" fill="#64748b" rx="1"/>
        ${wheel(12, 46, 5)}
        ${wheel(50, 46, 5)}
      `;
      break;

    case 3: // METRO/TREN (3 Vagon)
      modelHtml = `
        ${groundShadow}
        <g class="wp-${uid}">
          <rect x="2" y="22" width="18" height="22" rx="5" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="5" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="12" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.4s">
          <rect x="23" y="22" width="18" height="22" rx="5" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="26" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="33" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.8s">
          <rect x="44" y="22" width="18" height="22" rx="5" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="47" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="54" y="25" width="6" height="9" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <rect x="20" y="31" width="3" height="4" fill="#475569" rx="1"/>
        <rect x="41" y="31" width="3" height="4" fill="#475569" rx="1"/>
        ${wheel(10, 46, 4)}
        ${wheel(32, 46, 4)}
        ${wheel(54, 46, 4)}
      `;
      break;

    case 4: // FÜNİKÜLER (Eğimli tek gövde)
      modelHtml = `
        ${groundShadow}
        <rect x="12" y="20" width="44" height="26" rx="8" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5" transform="skewX(-8)"/>
        <rect x="18" y="24" width="10" height="11" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5" transform="skewX(-8)"/>
        <rect x="32" y="24" width="10" height="11" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5" transform="skewX(-8)"/>
        <rect x="46" y="24" width="6" height="11" rx="2" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5" transform="skewX(-8)"/>
        ${wheel(20, 48, 5)}
        ${wheel(48, 48, 5)}
      `;
      break;

    case 5: // VAPUR / DENİZ OTOBÜSÜ
      modelHtml = `
        ${groundShadow}
        <path d="M8,38 L56,38 L50,48 L14,48 Z" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
        <path d="M8,38 L56,38 L54,34 L10,34 Z" fill="url(#roof-${uid})" stroke="${shadowColor}" stroke-width="1"/>
        <rect x="20" y="18" width="24" height="14" rx="2" fill="url(#roof-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
        <rect x="24" y="20" width="6" height="9" rx="1" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        <rect x="33" y="20" width="6" height="9" rx="1" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        <rect x="42" y="20" width="2" height="9" rx="1" fill="${windowColor}" opacity="0.6"/>
        <rect x="30" y="10" width="4" height="8" rx="1" fill="#334155"/>
        <circle cx="32" cy="9" r="1.5" fill="#f87171"/>
      `;
      break;

    case 6: // AĞIR TREN / YHT (4 Vagon, aerodinamik ön)
      modelHtml = `
        ${groundShadow}
        <g class="wp-${uid}">
          <path d="M2,22 L14,22 L14,44 L2,44 Q0,44 2,42 Z" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <path d="M2,22 L14,22 L12,28 L2,28 Z" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.2s">
          <rect x="16" y="22" width="16" height="22" rx="4" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="19" y="25" width="5" height="9" rx="1.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="26" y="25" width="5" height="9" rx="1.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.4s">
          <rect x="34" y="22" width="16" height="22" rx="4" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <rect x="37" y="25" width="5" height="9" rx="1.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
          <rect x="44" y="25" width="5" height="9" rx="1.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        <g class="wp-${uid}" style="animation-delay:0.6s">
          <path d="M52,22 L62,22 Q64,22 62,26 L62,44 L52,44 Z" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
          <path d="M54,25 L60,25 L58,30 L54,30 Z" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.5"/>
        </g>
        ${wheel(8, 46, 4)}
        ${wheel(24, 46, 4)}
        ${wheel(42, 46, 4)}
        ${wheel(58, 46, 4)}
      `;
      break;

    default: // OTOBÜS
      modelHtml = `
        ${groundShadow}
        <rect x="8" y="18" width="48" height="28" rx="9" fill="url(#body-${uid})" stroke="${shadowColor}" stroke-width="1.5"/>
        <rect x="8" y="18" width="48" height="14" rx="9" fill="url(#roof-${uid})" stroke="${shadowColor}" stroke-width="0" opacity="0.5"/>
        <rect x="13" y="22" width="9" height="10" rx="2.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.6"/>
        <rect x="24" y="22" width="9" height="10" rx="2.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.6"/>
        <rect x="35" y="22" width="9" height="10" rx="2.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.6"/>
        <rect x="46" y="22" width="7" height="10" rx="2.5" fill="${windowColor}" stroke="${windowEdge}" stroke-width="0.6"/>
        <rect x="9" y="32" width="46" height="3" rx="1.5" fill="${shadeColor(topColor, 18)}" opacity="0.5"/>
        <rect x="8" y="40" width="48" height="5" rx="2" fill="${botColor}" opacity="0.4"/>
        ${wheel(20, 47, 5.5)}
        ${wheel(44, 47, 5.5)}
        <circle cx="53" cy="34" r="2" fill="${headlightColor}" stroke="${headlightEdge}" stroke-width="0.6"/>
        <rect x="54" y="26" width="2" height="6" rx="1" fill="${windowColor}" opacity="0.8"/>
      `;
  }

  return defs + wagonAnimation + modelHtml;
};

function shadeColor(color, percent) {
  let R, G, B;
  if (color.startsWith('#')) {
    R = parseInt(color.slice(1,3), 16);
    G = parseInt(color.slice(3,5), 16);
    B = parseInt(color.slice(5,7), 16);
  } else if (color.startsWith('rgb')) {
    const m = color.match(/\d+/g);
    R = parseInt(m[0]); G = parseInt(m[1]); B = parseInt(m[2]);
  } else {
    return color;
  }
  R = Math.max(0, Math.min(255, Math.round(R + (R * percent / 100))));
  G = Math.max(0, Math.min(255, Math.round(G + (G * percent / 100))));
  B = Math.max(0, Math.min(255, Math.round(B + (B * percent / 100))));
  return `#${R.toString(16).padStart(2,'0')}${G.toString(16).padStart(2,'0')}${B.toString(16).padStart(2,'0')}`;
}
