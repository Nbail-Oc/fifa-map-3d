import { cn } from '../lib/utils.js';

// Card templates
import cardV1 from '../assets/card_assets/Civilian_card_version1.png';
import cardV2 from '../assets/card_assets/Civilian_card_version2.png';
import cardV3 from '../assets/card_assets/Civilian_card_version3.png';

// Cutout Objects
import appleIcon from '../assets/card_assets/apple.png';
import coinIcon from '../assets/card_assets/gold_coin.png';
import redPotionIcon from '../assets/card_assets/red_potion.png';
import bluePotionIcon from '../assets/card_assets/blue_potion.png';
import mushroomIcon from '../assets/card_assets/mushroom.png';
import wingIcon from '../assets/card_assets/butterfly_wing.png';
import gemIcon from '../assets/card_assets/jem.png';

const cardConfigs = {
  v1: {
    bg: cardV1,
    cutoutClass: 'absolute top-[35px] left-[35px] right-[35px] h-[155px] rounded-t-[50px]',
    ribbonClass: 'absolute top-[204px] left-[30px] right-[30px] h-[34px]',
    scrollClass: 'absolute top-[248px] left-[38px] right-[38px] bottom-[30px]',
  },
  v2: {
    bg: cardV2,
    cutoutClass: 'absolute top-[52px] left-[35px] right-[35px] h-[162px] rounded-b-[45px]',
    ribbonClass: 'absolute top-[12px] left-[30px] right-[30px] h-[34px]',
    scrollClass: 'absolute top-[260px] left-[38px] right-[38px] bottom-[30px]',
  },
  v3: {
    bg: cardV3,
    cutoutClass: 'absolute top-[30px] left-[35px] right-[35px] h-[160px] rounded-t-[10px]',
    ribbonClass: 'absolute top-[200px] left-[25px] right-[25px] h-[36px]',
    scrollClass: 'absolute top-[270px] left-[38px] right-[38px] bottom-[30px]',
  }
};

const rpgDescriptions = {
  gate: 'Fast-travel portal to enter/exit the stadium grounds.',
  seat: 'A resting spot to watch the legendary match unfold.',
  food: 'Delicious provisions to restore your energy.',
  restroom: 'A quiet chamber to refresh your spirit.',
  medical: 'A sanctuary to heal wounds and recover.',
  merch: 'Trade gold coins for rare gear and souvenirs.'
};


const iconMap = {
  gate: 'door-open',
  seat: 'chair',
  food: 'pizza',
  restroom: 'toilet',
  medical: 'first-aid',
  merch: 'shopping-bag'
};

// Helper to create phosphor icon
function createIcon(name, className = '', size = 20, weight = 'regular') {
  const i = document.createElement('i');
  i.className = cn(`ph ph-${name}`, className);
  i.style.fontSize = `${size}px`;
  i.style.fontWeight = weight;
  return i;
}

export default class DestinationPanel {
  constructor(pois, handlers) {
    this.pois = pois;
    this.handlers = handlers;
    this.recentlyVisited = this.loadRecentlyVisited();
    
    // Create main container elements directly on body
    this.createSearchContainer();
    this.createPoiCard();
    this.createFloatingControls();
    this.createMySeatModal();
    this.createMultiplayerModal();
    this.createToast();

    this.mode = 'staff';
    this.el = document.createElement('div');
  }

  // --- Search Bar & Autocomplete ---
  createSearchContainer() {
    this.searchContainer = document.createElement('div');
    // Width: on mobile shrink only to clear the floating controls (80px) + left margin (16px)
    // On sm+ snap to fixed widths from the design system
    this.searchContainer.className = 'fixed top-[12px] left-4 z-[1001] w-[calc(100%-100px)] max-w-[calc(100vw-24px)] xs:w-[calc(100%-90px)] sm:w-[320px] md:w-[380px]';
    this.searchContainer.innerHTML = `
      <div class="relative">
        <div class="flex items-center gap-3 bg-card border border-border rounded-full px-4 py-3 shadow-xl">
          <i class="ph ph-magnifying-glass text-muted-foreground text-lg"></i>
          <input type="text" class="search-input flex-1 bg-transparent border-none text-foreground text-sm outline-none placeholder:text-muted-foreground" placeholder="Search seats, gates, food..." />
          <button class="search-clear-btn p-1 text-muted-foreground hover:text-foreground transition-colors" type="button" hidden>
            <i class="ph ph-x text-base"></i>
          </button>
        </div>
        
        <div class="search-dropdown hidden absolute top-full mt-2 left-0 right-0 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-lg max-h-[calc(100vh-100px)] overflow-y-auto">
          <div class="p-5 sm:p-6 space-y-4 sm:space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
            <div class="mode-toggle-section space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <button class="mode-button active px-4 py-2 text-xs font-semibold rounded-lg border transition-all" type="button" data-mode="staff">Staff Mode</button>
                <button class="mode-button px-4 py-2 text-xs font-semibold rounded-lg border transition-all" type="button" data-mode="fan">Fan Mode</button>
              </div>
              <label class="fallback-toggle flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" class="w-3 h-3" />
                <span>Keyboard / WASD fallback</span>
              </label>
            </div>
            
            <div class="gps-panel hidden space-y-3">
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <select class="calibration-select bg-background border border-input rounded-md px-3 py-2 text-xs text-foreground"></select>
                <button class="calibration-button px-3 py-2 text-xs font-semibold bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors" type="button">I am here</button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button class="clear-calibration-button px-3 py-2 text-xs font-semibold bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors" type="button">Recalibrate</button>
                <button class="heading-button px-3 py-2 text-xs font-semibold bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors" type="button">Compass</button>
              </div>
              <div class="gps-status px-3 py-2 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400">GPS inactive</div>
              <div class="heading-status px-3 py-2 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400">Compass inactive</div>
            </div>
            
            <div class="h-px bg-border"></div>
            
            <div class="suggestions-section">
              <h3 class="text-[10px] uppercase text-muted-foreground font-bold tracking-wide mb-2">Suggested Categories</h3>
              <div class="flex flex-wrap gap-2 suggestions-chips-container">
                <button type="button" class="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-secondary/80 transition-all" data-type="gate">
                  <i class="ph ph-door-open text-sm"></i>
                  <span>Gates</span>
                </button>
                <button type="button" class="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-secondary/80 transition-all" data-type="seat">
                  <i class="ph ph-chair text-sm"></i>
                  <span>Seats</span>
                </button>
                <button type="button" class="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-secondary/80 transition-all" data-type="food">
                  <i class="ph ph-pizza text-sm"></i>
                  <span>Food</span>
                </button>
                <button type="button" class="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-secondary/80 transition-all" data-type="restroom">
                  <i class="ph ph-toilet text-sm"></i>
                  <span>Restrooms</span>
                </button>
              </div>
            </div>

            <div class="recent-section hidden">
              <div class="h-px bg-border mb-3"></div>
              <h3 class="text-[10px] uppercase text-muted-foreground font-bold tracking-wide mb-2">Recently Visited</h3>
              <ul class="recent-list space-y-1"></ul>
            </div>
          </div>
        </div>
        
        <ul class="autocomplete-list hidden absolute top-full mt-2 left-0 right-0 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-lg max-h-96 overflow-y-auto"></ul>
      </div>
    `;

    this.searchInput = this.searchContainer.querySelector('.search-input');
    this.searchClearBtn = this.searchContainer.querySelector('.search-clear-btn');
    this.searchDropdown = this.searchContainer.querySelector('.search-dropdown');
    this.autocompleteList = this.searchContainer.querySelector('.autocomplete-list');
    
    // GPS elements
    this.modeButtons = this.searchContainer.querySelectorAll('.mode-button');
    this.fallbackInput = this.searchContainer.querySelector('.fallback-toggle input');
    this.gpsPanel = this.searchContainer.querySelector('.gps-panel');
    this.calibrationSelect = this.searchContainer.querySelector('.calibration-select');
    this.gpsStatus = this.searchContainer.querySelector('.gps-status');
    this.headingStatus = this.searchContainer.querySelector('.heading-status');

    // Populate calibration dropdown
    this.pois.forEach((poi) => {
      const option = document.createElement('option');
      option.value = poi.id;
      option.textContent = poi.name;
      this.calibrationSelect.appendChild(option);
    });

    // Wire up events
    this.searchInput.addEventListener('focus', () => {
      this.showDropdown();
    });

    this.searchInput.addEventListener('input', () => {
      this.handleSearchInput();
    });

    this.searchClearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.handleSearchInput();
      this.searchInput.focus();
    });

    // Hide search dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.searchContainer.contains(e.target)) {
        this.searchDropdown.classList.add('hidden');
        this.autocompleteList.classList.add('hidden');
      }
    });

    // Handle suggested category chip clicks
    this.searchContainer.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        this.searchInput.value = chip.querySelector('span').textContent;
        this.handleSearchInput();
      });
    });

    // Handlers wiring
    this.modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        this.mode = mode;
        this.setMode(mode);
        this.handlers.onModeChange?.(mode);
      });
    });

    this.fallbackInput.addEventListener('change', () => this.handlers.onFallbackChange?.(this.fallbackInput.checked));
    this.searchContainer.querySelector('.calibration-button').addEventListener('click', () => this.handlers.onCalibrate?.(this.calibrationSelect.value));
    this.searchContainer.querySelector('.clear-calibration-button').addEventListener('click', this.handlers.onClearCalibration);
    this.searchContainer.querySelector('.heading-button').addEventListener('click', this.handlers.onEnableHeading);

    document.body.appendChild(this.searchContainer);
    this.updateMySeatOption();
  }

  updateMySeatOption() {
    let seatInfo = null;
    try {
      seatInfo = JSON.parse(localStorage.getItem('stadium-my-seat'));
    } catch {}

    const container = this.searchContainer.querySelector('.suggestions-chips-container');
    if (!container) return;

    const oldChip = container.querySelector('[data-type="my-seat"]');
    if (oldChip) {
      oldChip.remove();
    }

    if (seatInfo && seatInfo.section) {
      const mySeatChip = document.createElement('button');
      mySeatChip.type = 'button';
      mySeatChip.dataset.type = 'my-seat';
      mySeatChip.className = 'chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-yellow-500/50 text-amber-300 text-xs font-black hover:from-amber-500/30 hover:to-yellow-600/30 transition-all cursor-pointer';
      mySeatChip.innerHTML = `
        <i class="ph ph-star-fill text-sm text-yellow-400 animate-pulse"></i>
        <span>My Seat (Sec ${seatInfo.section}, Row ${seatInfo.row}, Seat ${seatInfo.seat})</span>
      `;
      
      mySeatChip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.searchDropdown.classList.add('hidden');
        this.autocompleteList.classList.add('hidden');
        this.handlers.onGoToMySeat?.();
      });

      container.insertBefore(mySeatChip, container.firstChild);
    }
  }

  showDropdown() {
    this.autocompleteList.classList.add('hidden');
    this.searchDropdown.classList.remove('hidden');
    this.renderRecentList();
  }

  handleSearchInput() {
    const query = this.searchInput.value.trim().toLowerCase();
    this.searchClearBtn.hidden = query.length === 0;

    if (query.length === 0) {
      this.showDropdown();
      return;
    }

    this.searchDropdown.classList.add('hidden');
    
    // Filter matching POIs
    const matches = this.pois.filter(
      (poi) => poi.name.toLowerCase().includes(query) || poi.type.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      this.autocompleteList.innerHTML = `
        <li class="px-4 py-6 text-center text-muted-foreground text-sm">
          <i class="ph ph-magnifying-glass-minus text-2xl mb-2 block"></i>
          No results found
        </li>
      `;
    } else {
      this.autocompleteList.innerHTML = '';
      matches.slice(0, 8).forEach((poi) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/50 transition-colors';
        
        const icon = document.createElement('i');
        icon.className = `ph ph-${iconMap[poi.type] || 'map-pin'} text-primary text-lg flex-shrink-0`;
        
        const details = document.createElement('div');
        details.className = 'flex flex-col flex-1 min-w-0';
        details.innerHTML = `
          <span class="text-sm font-semibold text-foreground truncate">${poi.name}</span>
          <span class="text-[10px] uppercase text-muted-foreground font-bold tracking-wide">${poi.type}</span>
        `;
        
        li.appendChild(icon);
        li.appendChild(details);
        
        li.addEventListener('click', () => {
          this.searchInput.value = poi.name;
          this.searchDropdown.classList.add('hidden');
          this.autocompleteList.classList.add('hidden');
          this.saveRecent(poi.id);
          this.handlers.onPoiSelect?.(poi);
        });
        this.autocompleteList.appendChild(li);
      });
    }
    this.autocompleteList.classList.remove('hidden');
  }

  // --- Recently Visited ---
  loadRecentlyVisited() {
    try {
      return JSON.parse(localStorage.getItem('stadium-recent-visited')) ?? [];
    } catch {
      return [];
    }
  }

  saveRecent(id) {
    this.recentlyVisited = this.recentlyVisited.filter((v) => v !== id);
    this.recentlyVisited.unshift(id);
    this.recentlyVisited = this.recentlyVisited.slice(0, 5); // Keep last 5
    localStorage.setItem('stadium-recent-visited', JSON.stringify(this.recentlyVisited));
  }

  renderRecentList() {
    const list = this.searchContainer.querySelector('.recent-list');
    const section = this.searchContainer.querySelector('.recent-section');
    
    if (this.recentlyVisited.length === 0) {
      section.classList.add('hidden');
      return;
    }

    list.innerHTML = '';
    this.recentlyVisited.forEach((id) => {
      const poi = this.pois.find((p) => p.id === id);
      if (!poi) return;

      const li = document.createElement('li');
      li.className = 'flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors';
      
      const icon = document.createElement('i');
      icon.className = 'ph ph-clock text-muted-foreground text-sm flex-shrink-0';
      
      const name = document.createElement('span');
      name.className = 'text-sm text-foreground truncate';
      name.textContent = poi.name;
      
      li.appendChild(icon);
      li.appendChild(name);
      
      li.addEventListener('click', () => {
        this.searchInput.value = poi.name;
        this.searchDropdown.classList.add('hidden');
        this.autocompleteList.classList.add('hidden');
        this.saveRecent(poi.id);
        this.handlers.onPoiSelect?.(poi);
      });
      list.appendChild(li);
    });
    section.classList.remove('hidden');
  }

  // --- POI Details Card ---
  createPoiCard() {
    this.poiCard = document.createElement('div');
    // Position at the bottom, centering the card horizontally, letting clicks pass through outside the card
    this.poiCard.className = 'poi-card fixed bottom-0 left-0 right-0 z-[1001] pointer-events-none flex justify-center pb-4 hidden';
    this.poiCard.innerHTML = ''; // Will be populated by showPoiCard
    document.body.appendChild(this.poiCard);
  }

  showPoiCard(poi) {
    this.activePoi = poi;
    this.isMaximized = false; // Start minimized

    let rating = 99;
    let typeAbbr = 'POI';
    let objectIcon = '';
    let stats = [];

    let isMySeat = false;
    let savedSeatInfo = null;
    try {
      savedSeatInfo = JSON.parse(localStorage.getItem('stadium-my-seat'));
      if (savedSeatInfo && savedSeatInfo.section && poi.type === 'seat') {
        const secStr = savedSeatInfo.section.toLowerCase();
        isMySeat = poi.name.toLowerCase().includes(secStr) || poi.id.toLowerCase().includes(secStr);
      }
    } catch {}

    switch (poi.type) {
      case 'gate':
        rating = 99;
        typeAbbr = 'GT';
        objectIcon = wingIcon;
        stats = [
          { name: 'DIS', val: 99 },
          { name: 'ACC', val: 95 },
          { name: 'SPD', val: 90 }
        ];
        break;
      case 'seat':
        rating = isMySeat ? 99 : 88;
        typeAbbr = isMySeat ? 'MY' : 'ST';
        objectIcon = mushroomIcon;
        stats = [
          { name: 'DIS', val: isMySeat ? 99 : 78 },
          { name: 'COM', val: 95 },
          { name: 'VW', val: 92 }
        ];
        break;
      case 'food':
        rating = 95;
        typeAbbr = 'FD';
        objectIcon = appleIcon;
        stats = [
          { name: 'QLY', val: 94 },
          { name: 'HP', val: 85 },
          { name: 'NRG', val: 99 }
        ];
        break;
      case 'restroom':
        rating = 90;
        typeAbbr = 'RR';
        objectIcon = bluePotionIcon;
        stats = [
          { name: 'CLN', val: 92 },
          { name: 'AVB', val: 85 },
          { name: 'SPD', val: 78 }
        ];
        break;
      case 'medical':
        rating = 97;
        typeAbbr = 'MD';
        objectIcon = redPotionIcon;
        stats = [
          { name: 'HP', val: 99 },
          { name: 'ACC', val: 95 },
          { name: 'SPD', val: 90 }
        ];
        break;
      case 'merch':
        rating = 92;
        typeAbbr = 'MC';
        objectIcon = gemIcon;
        stats = [
          { name: 'VAL', val: 95 },
          { name: 'RAR', val: 88 },
          { name: 'NRG', val: 75 }
        ];
        break;
      default:
        rating = 90;
        typeAbbr = 'PI';
        objectIcon = coinIcon;
        stats = [
          { name: 'DIS', val: 85 },
          { name: 'NAV', val: 90 },
          { name: 'POP', val: 80 }
        ];
    }

    const desc = isMySeat && savedSeatInfo 
      ? `Your reserved seat: Row ${savedSeatInfo.row}, Seat ${savedSeatInfo.seat}.` 
      : (rpgDescriptions[poi.type] || 'Walkway access is available.');
    
    const cardTitle = isMySeat && savedSeatInfo ? `${poi.name} (My Seat)` : poi.name;

    this.poiCard.innerHTML = `
      <div class="fifa-card pointer-events-auto relative fifa-card-shield bg-gradient-to-b from-amber-200 via-yellow-500 to-amber-600 p-[3px] select-none shadow-2xl animate-slide-up">
        <div class="fifa-card-inner fifa-card-inner-shield w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between p-3.5 relative overflow-hidden border border-yellow-500/10">
          
          <!-- Background radial highlight -->
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.06)_0%,transparent_75%)] pointer-events-none"></div>

          <!-- Header Section (Always Visible) -->
          <div class="flex items-start justify-between z-10">
            <!-- Rating and Abbreviation -->
            <div class="flex flex-col items-center select-text">
              <span class="text-2xl font-black text-amber-400 leading-none tracking-tight">${rating}</span>
              <span class="text-[9px] font-black text-amber-200/80 tracking-widest uppercase">${typeAbbr}</span>
            </div>

            <!-- Centered POI Name in Minimized State -->
            <div class="fifa-minimized-only flex-1 px-3 pt-1 text-center select-text">
              <h3 class="text-sm font-black text-white tracking-wide truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                ${cardTitle}
              </h3>
            </div>

            <!-- Controls -->
            <div class="flex items-center gap-1">
              <button class="fifa-card-toggle-btn p-1.5 text-amber-400 hover:text-amber-200 transition-colors" type="button" title="Maximize/Minimize">
                <i class="ph ph-caret-up text-base font-bold"></i>
              </button>
              <button class="fifa-card-close-btn p-1.5 text-red-400 hover:text-red-300 transition-colors" type="button" title="Close">
                <i class="ph ph-x text-base font-bold"></i>
              </button>
            </div>
          </div>

          <!-- Maximized-Only Content Section -->
          <div class="fifa-maximized-only flex flex-col items-center justify-between flex-1 py-1 z-10">
            <!-- Player Portrait (POI Object Icon) -->
            <div class="relative w-20 h-20 rounded-full bg-slate-900/80 border-2 border-amber-400/30 flex items-center justify-center shadow-inner overflow-hidden my-1">
              <div class="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent"></div>
              <img src="${objectIcon}" class="w-12 h-12 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] animate-bounce" style="image-rendering: pixelated; animation-duration: 3s;" />
            </div>

            <!-- POI Name in Maximized State -->
            <h3 class="text-base font-black text-white tracking-wide text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-tight px-1 select-text">
              ${cardTitle}
            </h3>

            <!-- Stats and Details Area -->
            <div class="grid grid-cols-[auto_1fr] gap-4 w-full px-2 pt-2 pb-1 border-t border-amber-400/20 mt-1.5 select-text">
              <!-- Stats list (FUT Style) -->
              <div class="flex flex-col justify-center border-r border-amber-400/15 pr-3.5 space-y-0.5 text-left font-mono">
                ${stats.map(s => `
                  <div class="flex items-center gap-1 text-[10px] leading-tight">
                    <span class="font-black text-white">${s.val}</span>
                    <span class="font-bold text-amber-400/80">${s.name}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Description and coordinates -->
              <div class="flex flex-col justify-center text-left pl-1 space-y-0.5 max-h-[64px] overflow-y-auto">
                <p class="text-[9px] font-black text-amber-400/60 uppercase tracking-wider">${poi.type}</p>
                <p class="text-[10px] text-amber-200 leading-tight">
                  Coords: X: ${poi.tileX}, Y: ${poi.tileY}
                </p>
                <p class="text-[10px] text-white/80 leading-normal italic line-clamp-2">
                  "${desc}"
                </p>
              </div>
            </div>
          </div>

          <!-- Actions Section (Always Visible) -->
          <div class="w-full pt-1.5 z-10">
            <button class="poi-card-route-btn w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-2 rounded shadow-md border border-amber-300/40 text-[11px] tracking-widest transition-all active:scale-[0.98] uppercase flex items-center justify-center gap-1.5" type="button">
              <i class="ph ph-navigation-arrow-fill text-xs"></i>
              Directions
            </button>
          </div>

        </div>
      </div>
    `;

    const cardEl = this.poiCard.querySelector('.fifa-card');
    const toggleBtn = this.poiCard.querySelector('.fifa-card-toggle-btn');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMaximized = !this.isMaximized;
      if (this.isMaximized) {
        cardEl.classList.add('maximized');
        toggleBtn.innerHTML = '<i class="ph ph-caret-down text-base font-bold"></i>';
      } else {
        cardEl.classList.remove('maximized');
        toggleBtn.innerHTML = '<i class="ph ph-caret-up text-base font-bold"></i>';
      }
    });

    this.poiCard.querySelector('.fifa-card-close-btn').addEventListener('click', () => {
      this.poiCard.classList.add('hidden');
    });

    this.poiCard.querySelector('.poi-card-route-btn').addEventListener('click', () => {
      this.poiCard.classList.add('hidden');
      this.handlers.onSelect(poi);
    });

    this.poiCard.classList.remove('hidden');
  }

  // --- Floating Controls (Recenter & My Seat) ---
  createFloatingControls() {
    this.floatingControls = document.createElement('div');
    // bottom: clears the iOS home-bar (safe-area-inset-bottom) + 1rem gap
    // right: 1rem on mobile (xs), 1.5rem on sm+
    this.floatingControls.className = 'fixed right-4 sm:right-6 flex flex-col gap-2 sm:gap-3 z-[1001]';
    this.floatingControls.style.bottom = 'max(1rem, env(safe-area-inset-bottom, 0px))';
    this.floatingControls.innerHTML = `
      <button class="gyro-btn w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card border-2 border-border hover:bg-accent hover:border-primary shadow-xl transition-all active:scale-95 flex items-center justify-center" type="button" title="Toggle Tilt Control">
        <i class="ph ph-arrows-out-cardinal text-xl sm:text-2xl text-muted-foreground"></i>
      </button>
      <button class="multiplayer-btn w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card border-2 border-border hover:bg-accent hover:border-primary shadow-xl transition-all active:scale-95 flex items-center justify-center" type="button" title="Multiplayer Lobby">
        <i class="ph ph-users text-xl sm:text-2xl text-muted-foreground"></i>
      </button>
      <button class="my-seat-btn w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card border-2 border-border hover:bg-accent hover:border-primary shadow-xl transition-all active:scale-95 flex items-center justify-center" type="button" title="Set my seat">
        <i class="ph ph-chair text-xl sm:text-2xl text-primary"></i>
      </button>
      <button class="recenter-btn w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-card border-2 border-border hover:bg-accent hover:border-primary shadow-xl transition-all active:scale-95 flex items-center justify-center" type="button" title="Recenter on player">
        <i class="ph ph-compass text-xl sm:text-2xl text-primary"></i>
      </button>
    `;

    this.floatingControls.querySelector('.recenter-btn').addEventListener('click', () => {
      this.handlers.onRecenter?.();
    });

    this.floatingControls.querySelector('.my-seat-btn').addEventListener('click', () => {
      const storedSeat = localStorage.getItem('stadium-my-seat');
      if (storedSeat) {
        this.handlers.onGoToMySeat?.();
      } else {
        this.openMySeatModal();
      }
    });

    this.floatingControls.querySelector('.gyro-btn').addEventListener('click', () => {
      this.handlers.onToggleGyro?.();
    });

    this.floatingControls.querySelector('.multiplayer-btn').addEventListener('click', () => {
      this.openMultiplayerModal();
    });

    document.body.appendChild(this.floatingControls);
  }

  setGyroActive(active) {
    const icon = this.floatingControls?.querySelector('.gyro-btn i');
    const button = this.floatingControls?.querySelector('.gyro-btn');
    if (!icon) return;
    if (active) {
      icon.className = 'ph ph-arrows-out-cardinal text-2xl text-primary';
      button.classList.add('border-primary');
    } else {
      icon.className = 'ph ph-arrows-out-cardinal text-2xl text-muted-foreground';
      button.classList.remove('border-primary');
    }
  }
  createMultiplayerModal() {
    this.multiplayerModal = document.createElement('div');
    this.multiplayerModal.className = 'multiplayer-modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] hidden flex items-end sm:items-center justify-center';
    this.multiplayerModal.innerHTML = `
      <div class="multiplayer-modal w-full max-w-md bg-card border-t-2 sm:border-2 border-primary sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div class="p-5 sm:p-6 space-y-4 sm:space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
          <!-- Header -->
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-primary flex items-center gap-2">
              <i class="ph ph-users"></i> Multiplayer
            </h2>
            <button class="close-multiplayer-btn p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all" type="button">
              <i class="ph ph-x text-lg"></i>
            </button>
          </div>

          <!-- ERROR banner (hidden by default) -->
          <div class="mp-error hidden bg-destructive/15 border border-destructive/40 text-destructive text-xs p-3 rounded-lg flex items-center gap-2">
            <i class="ph ph-warning-circle text-base flex-shrink-0"></i>
            <span class="mp-error-text"></span>
          </div>

          <!-- STATE 1: Name entry + choose action -->
          <div class="mp-step-name space-y-4">
            <div class="space-y-2">
              <label for="mp-username" class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Your Nickname</label>
              <input type="text" id="mp-username" placeholder="e.g. Stadium Fan" maxlength="20"
                class="w-full bg-background/80 border border-input rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" class="mp-create-btn flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2">
                <i class="ph ph-plus-circle text-lg"></i> Create Room
              </button>
              <button type="button" class="mp-join-btn flex-1 bg-secondary hover:bg-accent text-foreground font-bold py-3 px-4 rounded-lg border border-border transition-all flex items-center justify-center gap-2">
                <i class="ph ph-sign-in text-lg"></i> Join Room
              </button>
            </div>
          </div>

          <!-- STATE 2a: Join with code (hidden) -->
          <div class="mp-step-join hidden space-y-4">
            <p class="text-xs text-muted-foreground">Ask the room creator for their 6-letter code.</p>
            <div class="space-y-2">
              <label for="mp-join-code" class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Room Code</label>
              <input type="text" id="mp-join-code" placeholder="e.g. ABC123" maxlength="8" style="text-transform:uppercase; letter-spacing:0.15em;"
                class="w-full bg-background/80 border border-input rounded-lg px-4 py-3 text-foreground text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
            </div>
            <div class="flex gap-3">
              <button type="button" class="mp-back-btn px-4 py-3 bg-secondary border border-border text-foreground hover:bg-accent rounded-lg text-sm font-semibold transition-all">
                <i class="ph ph-arrow-left"></i>
              </button>
              <button type="button" class="mp-do-join-btn flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 px-4 rounded-lg shadow-lg transition-all">
                Connect
              </button>
            </div>
          </div>

          <!-- STATE 2b: Loading (hidden) -->
          <div class="mp-step-loading hidden space-y-4 text-center py-4">
            <div class="flex items-center justify-center gap-3 text-muted-foreground">
              <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm mp-loading-text">Connecting...</span>
            </div>
          </div>

          <!-- STATE 3: Connected Lobby (hidden) -->
          <div class="mp-step-lobby hidden space-y-4">
            <!-- Room code display with copy -->
            <div class="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center space-y-1">
              <p class="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Room Code — Share this!</p>
              <div class="flex items-center justify-center gap-3">
                <span class="room-display text-3xl font-black text-primary tracking-[0.25em]">------</span>
                <button type="button" class="mp-copy-btn p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Copy code">
                  <i class="ph ph-copy text-base"></i>
                </button>
              </div>
              <div class="flex items-center justify-center gap-1.5 pt-1">
                <span class="flex h-1.5 w-1.5 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                <span class="text-[10px] text-green-500 font-bold uppercase tracking-wider">Live</span>
              </div>
            </div>

            <!-- Bot Controls -->
            <div class="flex gap-2">
              <button type="button" class="add-bot-btn flex-1 py-2 px-3 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5">
                <i class="ph ph-robot text-base"></i> Add Bot
              </button>
              <button type="button" class="clear-bots-btn px-3 py-2 bg-secondary border border-border text-muted-foreground hover:bg-accent rounded-lg text-xs font-semibold transition-all">
                Clear Bots
              </button>
            </div>

            <!-- Player list -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Players Online (<span class="player-count">1</span>/50)</label>
              <div class="player-list max-h-48 overflow-y-auto space-y-1 bg-background/40 rounded-lg border border-border/50 p-2">
              </div>
            </div>

            <button type="button" class="leave-room-btn w-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 font-bold py-3 px-4 rounded-lg transition-all">
              <i class="ph ph-door-open"></i> Leave Room
            </button>
          </div>
        </div>
      </div>
    `;

    // --- Wire up all events ---
    const m = this.multiplayerModal;

    const nameInput = m.querySelector('#mp-username');
    const joinCodeInput = m.querySelector('#mp-join-code');

    // Pre-fill saved name
    const randId = Math.floor(1000 + Math.random() * 9000);
    nameInput.value = localStorage.getItem('stadium-mp-name') || `Fan_${randId}`;

    const showStep = (step) => {
      ['mp-step-name', 'mp-step-join', 'mp-step-loading', 'mp-step-lobby'].forEach(cls => {
        m.querySelector(`.${cls}`).classList.add('hidden');
      });
      m.querySelector(`.${step}`).classList.remove('hidden');
    };

    const showError = (msg) => {
      const banner = m.querySelector('.mp-error');
      m.querySelector('.mp-error-text').textContent = msg;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 4000);
    };

    const getName = () => nameInput.value.trim();

    // Close
    m.querySelector('.close-multiplayer-btn').addEventListener('click', () => this.closeMultiplayerModal());
    m.addEventListener('click', (e) => { if (e.target === m) this.closeMultiplayerModal(); });

    // Create Room
    m.querySelector('.mp-create-btn').addEventListener('click', () => {
      const name = getName();
      if (!name) { showError('Please enter a nickname first.'); return; }
      localStorage.setItem('stadium-mp-name', name);
      // Generate a random 6-char code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      showStep('mp-step-loading');
      m.querySelector('.mp-loading-text').textContent = `Creating room ${code}...`;
      this.handlers.onJoinRoom?.(code, name);
    });

    // Go to Join step
    m.querySelector('.mp-join-btn').addEventListener('click', () => {
      const name = getName();
      if (!name) { showError('Please enter a nickname first.'); return; }
      showStep('mp-step-join');
      joinCodeInput.value = '';
      joinCodeInput.focus();
    });

    // Back from join step
    m.querySelector('.mp-back-btn').addEventListener('click', () => showStep('mp-step-name'));

    // Do Join
    m.querySelector('.mp-do-join-btn').addEventListener('click', () => {
      const name = getName();
      const code = joinCodeInput.value.trim().toUpperCase();
      if (!code || code.length < 4) { showError('Enter a valid room code.'); return; }
      localStorage.setItem('stadium-mp-name', name);
      showStep('mp-step-loading');
      m.querySelector('.mp-loading-text').textContent = `Joining room ${code}...`;
      this.handlers.onJoinRoom?.(code, name);
    });

    // Also allow Enter key in join code input
    joinCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') m.querySelector('.mp-do-join-btn').click();
    });

    // Copy room code
    m.querySelector('.mp-copy-btn').addEventListener('click', () => {
      const code = m.querySelector('.room-display').textContent;
      navigator.clipboard?.writeText(code).then(() => {
        const btn = m.querySelector('.mp-copy-btn i');
        btn.className = 'ph ph-check text-base';
        setTimeout(() => { btn.className = 'ph ph-copy text-base'; }, 1500);
      });
    });

    // Leave room
    m.querySelector('.leave-room-btn').addEventListener('click', () => {
      this.handlers.onLeaveRoom?.();
    });

    // Bots
    m.querySelector('.add-bot-btn').addEventListener('click', () => this.handlers.onAddBot?.());
    m.querySelector('.clear-bots-btn').addEventListener('click', () => this.handlers.onClearBots?.());

    document.body.appendChild(this.multiplayerModal);
  }

  openMultiplayerModal() {
    this.multiplayerModal.classList.remove('hidden');
  }

  closeMultiplayerModal() {
    this.multiplayerModal.classList.add('hidden');
  }

  updateMultiplayerLobby(roomCode, playerList, isConnected) {
    const m = this.multiplayerModal;
    if (!m) return;

    const showStep = (step) => {
      ['mp-step-name', 'mp-step-join', 'mp-step-loading', 'mp-step-lobby'].forEach(cls => {
        m.querySelector(`.${cls}`)?.classList.add('hidden');
      });
      m.querySelector(`.${step}`)?.classList.remove('hidden');
    };

    const roomDisplay = m.querySelector('.room-display');
    const playerCount = m.querySelector('.player-count');
    const playerListEl = m.querySelector('.player-list');
    const icon = this.floatingControls?.querySelector('.multiplayer-btn i');
    const button = this.floatingControls?.querySelector('.multiplayer-btn');

    if (isConnected) {
      showStep('mp-step-lobby');
      if (roomDisplay) roomDisplay.innerText = roomCode;
      if (playerCount) playerCount.innerText = String(playerList.length);

      if (playerListEl) {
        playerListEl.innerHTML = '';
        playerList.forEach(player => {
          const item = document.createElement('div');
          item.className = 'flex items-center justify-between py-1.5 px-2 text-xs font-semibold rounded-lg hover:bg-accent/30 transition-colors';
          item.innerHTML = `
            <div class="flex items-center gap-2">
              <i class="ph ph-user-circle text-primary text-base"></i>
              <span>${player.name}${player.isMe ? ' <span class="text-[9px] bg-primary/20 text-primary border border-primary/30 rounded px-1 ml-1">You</span>' : ''}</span>
            </div>
            <span class="text-[10px] text-muted-foreground uppercase">${player.mode || '2d'}</span>
          `;
          playerListEl.appendChild(item);
        });
      }

      button?.classList.add('border-primary');
      if (icon) icon.className = 'ph ph-users text-2xl text-primary';
    } else {
      showStep('mp-step-name');
      button?.classList.remove('border-primary');
      if (icon) icon.className = 'ph ph-users text-2xl text-muted-foreground';
    }
  }

  // --- My Seat Dialogue Modal ---
  createMySeatModal() {
    this.mySeatModal = document.createElement('div');
    this.mySeatModal.className = 'my-seat-modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] hidden flex items-end sm:items-center justify-center';
    this.mySeatModal.innerHTML = `
      <div class="my-seat-modal w-full max-w-md bg-card border-t-2 sm:border-2 border-primary sm:rounded-2xl shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
        <div class="p-5 sm:p-6 space-y-4 sm:space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
          <h2 class="text-xl font-bold text-center text-primary">Set Your Seat Location</h2>
          
          <form class="my-seat-form space-y-4">
            <div class="form-group space-y-2">
              <label for="seat-section" class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Section (e.g. 104 or 202)</label>
              <input type="text" id="seat-section" placeholder="e.g. 104" required 
                class="w-full bg-background/80 border border-input rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group space-y-2">
                <label for="seat-row" class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Row</label>
                <input type="text" id="seat-row" placeholder="e.g. K" required 
                  class="w-full bg-background/80 border border-input rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
              </div>
              <div class="form-group space-y-2">
                <label for="seat-num" class="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Seat</label>
                <input type="text" id="seat-num" placeholder="e.g. 14" required 
                  class="w-full bg-background/80 border border-input rounded-lg px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 pt-2">
              <button type="button" class="btn-cancel px-4 py-3 rounded-lg font-semibold text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors uppercase tracking-wide">
                Cancel
              </button>
              <button type="submit" class="btn-submit px-4 py-3 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wide shadow-lg">
                Save Seat
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.mySeatModal.querySelector('.btn-cancel').addEventListener('click', () => {
      this.mySeatModal.classList.add('hidden');
    });

    this.mySeatModal.querySelector('.my-seat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const section = document.getElementById('seat-section').value.trim();
      const row = document.getElementById('seat-row').value.trim();
      const seat = document.getElementById('seat-num').value.trim();
      
      const seatInfo = { section, row, seat };
      localStorage.setItem('stadium-my-seat', JSON.stringify(seatInfo));
      this.mySeatModal.classList.add('hidden');
      
      // Show success toast
      this.showToast(`Seat saved: Section ${section}, Row ${row}, Seat ${seat}`, 'success');

      this.handlers.onSetMySeat?.(seatInfo);
      this.updateMySeatOption();
    });

    document.body.appendChild(this.mySeatModal);
  }

  openMySeatModal() {
    let active = { section: '', row: '', seat: '' };
    try {
      active = JSON.parse(localStorage.getItem('stadium-my-seat')) ?? active;
    } catch {}

    document.getElementById('seat-section').value = active.section;
    document.getElementById('seat-row').value = active.row;
    document.getElementById('seat-num').value = active.seat;

    this.mySeatModal.classList.remove('hidden');
  }

  // --- Toast Notification ---
  createToast() {
    this.toast = document.createElement('div');
    this.toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[2001] hidden w-max max-w-[calc(100vw-32px)]';
    document.body.appendChild(this.toast);
  }

  showToast(message, type = 'info') {
    const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-card';
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info';
    
    this.toast.innerHTML = `
      <div class="flex items-center gap-3 ${bgColor} text-white px-5 py-3 rounded-xl shadow-2xl border border-white/20 animate-slide-down max-w-sm">
        <i class="ph ph-${icon} text-xl flex-shrink-0"></i>
        <span class="text-sm font-medium">${message}</span>
      </div>
    `;
    
    this.toast.classList.remove('hidden');
    
    setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 3000);
  }

  // --- API / Framework Compatibility Methods ---
  setMode(mode) {
    this.modeButtons.forEach((button) => {
      if (button.dataset.mode === mode) {
        button.classList.add('bg-primary', 'text-primary-foreground', 'border-primary');
        button.classList.remove('bg-secondary', 'text-secondary-foreground', 'border-border');
      } else {
        button.classList.remove('bg-primary', 'text-primary-foreground', 'border-primary');
        button.classList.add('bg-secondary', 'text-secondary-foreground', 'border-border');
      }
    });
    
    if (mode === 'fan') {
      this.gpsPanel.classList.remove('hidden');
      this.fallbackInput.parentElement.classList.remove('hidden');
    } else {
      this.gpsPanel.classList.add('hidden');
      this.fallbackInput.parentElement.classList.add('hidden');
    }
  }

  setGpsStatus(message, isWeak = false) {
    this.gpsStatus.textContent = message;
    if (isWeak) {
      this.gpsStatus.classList.remove('bg-emerald-500/15', 'text-emerald-400');
      this.gpsStatus.classList.add('bg-amber-500/15', 'text-amber-400');
    } else {
      this.gpsStatus.classList.add('bg-emerald-500/15', 'text-emerald-400');
      this.gpsStatus.classList.remove('bg-amber-500/15', 'text-amber-400');
    }
  }

  setHeadingStatus(message, isWeak = false) {
    this.headingStatus.textContent = message;
    if (isWeak) {
      this.headingStatus.classList.remove('bg-emerald-500/15', 'text-emerald-400');
      this.headingStatus.classList.add('bg-amber-500/15', 'text-amber-400');
    } else {
      this.headingStatus.classList.add('bg-emerald-500/15', 'text-emerald-400');
      this.headingStatus.classList.remove('bg-amber-500/15', 'text-amber-400');
    }
  }

  setActive(id) {
    // Autocomplete/search handles selection details card directly now
  }

  setBusy(isBusy) {
    // Safe placeholder
  }

  destroy() {
    this.searchContainer.remove();
    this.poiCard.remove();
    this.floatingControls.remove();
    this.mySeatModal.remove();
    this.toast.remove();
  }
}
