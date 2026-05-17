/**
 * EkoGokhan Multimodal Transit Models
 * This file contains the SVG definitions and animations for various vehicle types.
 */

window.getVehicleModel = function(type, mainColor, shadowColor) {
  let modelHtml = '';
  
  // Animation for connected wagons (Subtle swaying/pulsing effect)
  const wagonAnimation = `
    <style>
      @keyframes wagonPull {
        0% { transform: translateX(0); }
        25% { transform: translateX(-1px); }
        50% { transform: translateX(0); }
        75% { transform: translateX(0.5px); }
        100% { transform: translateX(0); }
      }
      @keyframes connectorStretch {
        0%, 100% { transform: scaleX(1); }
        50% { transform: scaleX(1.15); opacity: 0.8; }
      }
      .wagon-part {
        animation: wagonPull 2.5s infinite ease-in-out;
      }
      .wagon-connector {
        animation: connectorStretch 2.5s infinite ease-in-out;
        transform-origin: left;
      }
    </style>
  `;

  switch(type) {
    case 2: // TRAMVAY (2 Vagonlu)
      modelHtml = `
        <rect class="wagon-part" x="2" y="24" width="30" height="20" rx="4" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2"/>
        <rect class="wagon-part" x="34" y="24" width="30" height="20" rx="4" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2" style="animation-delay: 0.5s;"/>
        <rect class="wagon-connector" x="30" y="32" width="6" height="4" fill="#64748b"/>
        <rect x="5" y="27" width="8" height="6" rx="1" fill="#e2e8f0" opacity="0.8"/>
        <rect x="15" y="27" width="8" height="6" rx="1" fill="#e2e8f0" opacity="0.8"/>
        <rect x="44" y="27" width="8" height="6" rx="1" fill="#e2e8f0" opacity="0.8"/>
      `;
      break;
    case 3: // METRO/TREN (3 Vagonlu)
      modelHtml = `
        <rect class="wagon-part" x="-2" y="24" width="22" height="20" rx="3" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2"/>
        <rect class="wagon-part" x="22" y="24" width="22" height="20" rx="3" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2" style="animation-delay: 0.4s;"/>
        <rect class="wagon-part" x="46" y="24" width="22" height="20" rx="3" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2" style="animation-delay: 0.8s;"/>
        <rect class="wagon-connector" x="18" y="32" width="6" height="3" fill="#475569" style="animation-delay: 0.2s;"/>
        <rect class="wagon-connector" x="42" y="32" width="6" height="3" fill="#475569" style="animation-delay: 0.6s;"/>
        <rect x="52" y="27" width="10" height="6" rx="1" fill="#fff" opacity="0.6"/>
      `;
      break;
    case 4: // FUNİKÜLER (Eğimli)
      modelHtml = `
        <rect class="wagon-part" x="15" y="24" width="40" height="26" rx="6" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2" transform="skewX(-10)"/>
        <rect x="25" y="28" width="12" height="10" rx="2" fill="#fff" opacity="0.7"/>
        <rect x="40" y="28" width="12" height="10" rx="2" fill="#fff" opacity="0.7"/>
      `;
      break;
    case 5: // DENİZ OTOBÜSÜ / VAPUR (Gemi Formu)
      modelHtml = `
        <path class="wagon-part" d="M10 45 L60 45 L70 25 L15 25 Z" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2"/>
        <rect x="25" y="15" width="25" height="12" rx="2" fill="white" opacity="0.9"/>
        <rect x="35" y="8" width="5" height="8" fill="#334155"/>
      `;
      break;
    case 6: // AĞIR TREN / YHT (Çok Vagonlu)
      modelHtml = `
        <rect class="wagon-part" x="-10" y="24" width="18" height="20" rx="2" fill="${mainColor}" stroke="${shadowColor}" stroke-width="1.5"/>
        <rect class="wagon-part" x="10" y="24" width="18" height="20" rx="2" fill="${mainColor}" stroke="${shadowColor}" stroke-width="1.5" style="animation-delay: 0.2s;"/>
        <rect class="wagon-part" x="30" y="24" width="18" height="20" rx="2" fill="${mainColor}" stroke="${shadowColor}" stroke-width="1.5" style="animation-delay: 0.4s;"/>
        <rect class="wagon-part" x="50" y="24" width="18" height="20" rx="2" fill="${mainColor}" stroke="${shadowColor}" stroke-width="1.5" style="animation-delay: 0.6s;"/>
        <rect class="wagon-connector" x="5" y="32" width="8" height="3" fill="#334155"/>
        <rect class="wagon-connector" x="25" y="32" width="8" height="3" fill="#334155"/>
        <rect class="wagon-connector" x="45" y="32" width="8" height="3" fill="#334155"/>
        <rect x="58" y="27" width="8" height="5" rx="1" fill="#fff" opacity="0.5"/>
      `;
      break;
    default: // OTOBÜS (ESKİ MODEL)
      modelHtml = `
        <rect x="12" y="20" width="48" height="28" rx="8" fill="${mainColor}" stroke="${shadowColor}" stroke-width="2"/>
        <rect x="18" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <rect x="31" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <rect x="44" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <circle cx="24" cy="52" r="6" fill="#1f2937" stroke="#111827" stroke-width="2"/>
        <circle cx="48" cy="52" r="6" fill="#1f2937" stroke="#111827" stroke-width="2"/>
        <circle cx="24" cy="52" r="3" fill="#4b5563"/>
        <circle cx="48" cy="52" r="3" fill="#4b5563"/>
        <circle cx="60" cy="34" r="3" fill="#fde047" stroke="#eab308" stroke-width="1"/>
        <rect x="12" y="26" width="48" height="3" rx="1" fill="#5eead4" opacity="0.7"/>
      `;
  }
  
  return wagonAnimation + modelHtml;
};
