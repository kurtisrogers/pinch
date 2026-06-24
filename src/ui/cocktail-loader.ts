export function cocktailLoaderHtml(fillPercent?: number): string {
  const pct = fillPercent ?? 100;
  const fillHeight = Math.min(100, Math.max(8, pct));

  return `
    <div class="cocktail-loader" aria-hidden="true">
      <svg class="cocktail-svg" viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="glass-clip">
            <path d="M18 28 L32 88 L46 28 Z" />
          </clipPath>
          <linearGradient id="liquid-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="#ff006e"/>
            <stop offset="50%" stop-color="#ff6ec7"/>
            <stop offset="100%" stop-color="#00f5ff"/>
          </linearGradient>
        </defs>
        <!-- stem & base -->
        <rect x="30" y="88" width="4" height="6" fill="#00f5ff" opacity="0.8"/>
        <ellipse cx="32" cy="94" rx="10" ry="2.5" fill="#00f5ff" opacity="0.6"/>
        <!-- glass outline -->
        <path d="M16 26 L32 90 L48 26 Z" fill="none" stroke="#ff6ec7" stroke-width="2.5" stroke-linejoin="round"/>
        <!-- liquid fill -->
        <g clip-path="url(#glass-clip)">
          <rect class="cocktail-fill" x="10" y="${100 - fillHeight}" width="44" height="${fillHeight + 10}" fill="url(#liquid-grad)"/>
        </g>
        <!-- garnish -->
        <circle cx="44" cy="24" r="4" fill="#ff006e"/>
        <rect x="42" y="12" width="3" height="14" rx="1.5" fill="#7bffb3" transform="rotate(15 43 19)"/>
        <!-- umbrella -->
        <path d="M12 20 Q22 8 32 18" fill="none" stroke="#00f5ff" stroke-width="2"/>
        <line x1="22" y1="14" x2="22" y2="26" stroke="#00f5ff" stroke-width="1.5"/>
      </svg>
    </div>`;
}

export function showCocktailStatus(message: string, fillPercent?: number): void {
  const status = document.getElementById("status");
  if (!status) return;
  status.classList.remove("hidden", "error");
  status.innerHTML = `
    ${cocktailLoaderHtml(fillPercent)}
    <p class="cocktail-message">${escapeHtml(message)}</p>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
