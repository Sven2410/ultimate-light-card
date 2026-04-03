/**
 * Ultimate Light Card
 * A custom Lovelace card for Home Assistant
 * Supports dimmable, switchable, color temp and RGB lights
 *
 * Version: 1.0.1
 */

/* ============================================================
   EDITOR
   ============================================================ */
class UltimateLightCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  get _entity() {
    return this._config.entity || "";
  }

  get _name() {
    return this._config.name || "";
  }

  _render() {
    if (!this._hass) return;

    // Only render once, then update values
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .editor-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        ha-entity-picker, ha-textfield {
          display: block;
          width: 100%;
        }
      </style>
      <div class="editor-row">
        <label>Entiteit (alleen lampen)</label>
        <ha-entity-picker
          .hass=${this._hass}
          .value="${this._entity}"
          .includeDomains=${["light"]}
          allow-custom-entity
        ></ha-entity-picker>
      </div>
      <div class="editor-row">
        <label>Naam</label>
        <ha-textfield
          .value="${this._name}"
          placeholder="Bijv. Spots"
          .configValue=${"name"}
        ></ha-textfield>
      </div>
    `;

    // Wire up entity picker
    const entityPicker = this.shadowRoot.querySelector("ha-entity-picker");
    if (entityPicker) {
      entityPicker.hass = this._hass;
      entityPicker.value = this._entity;
      entityPicker.includeDomains = ["light"];
      entityPicker.addEventListener("value-changed", (ev) => {
        if (!this._config || !this._hass) return;
        const newEntity = ev.detail.value;
        if (newEntity !== this._entity) {
          this._config = { ...this._config, entity: newEntity };
          this._fireChanged();
        }
      });
    }

    // Wire up name field
    const nameField = this.shadowRoot.querySelector("ha-textfield");
    if (nameField) {
      nameField.value = this._name;
      nameField.addEventListener("change", (ev) => {
        if (!this._config || !this._hass) return;
        const newName = ev.target.value;
        if (newName !== this._name) {
          this._config = { ...this._config, name: newName };
          this._fireChanged();
        }
      });
    }
  }

  _fireChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }
}
customElements.define("ultimate-light-card-editor", UltimateLightCardEditor);

/* ============================================================
   MAIN CARD
   ============================================================ */
class UltimateLightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._dragging = false;
    this._moved = false;
    this._startX = 0;
    this._currentPct = 0;
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._interactionLock = 0; // timestamp: ignore HA updates until cooldown
  }

  /* --- HA required interface --- */

  static getConfigElement() {
    return document.createElement("ultimate-light-card-editor");
  }

  static getStubConfig() {
    return { entity: "", name: "" };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Je moet een light entiteit kiezen");
    }
    this._config = { ...config };
    this._buildStructure();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    return 1;
  }

  /* --- Build DOM once --- */

  _buildStructure() {
    const root = this.shadowRoot;
    root.innerHTML = `
      <ha-card>
        <div class="ls-wrap">
          <div class="ls" id="mainRow">
            <div class="ls-icon" id="iconWrap">
              <ha-icon icon="mdi:lightbulb" id="icon"></ha-icon>
            </div>
            <div class="ls-info">
              <span class="ls-name" id="cardName"></span>
              <span class="ls-st" id="stateText"></span>
            </div>
          </div>
          <div class="ls-extra ls-extra-ct" id="ctRow" style="display:none;">
            <span class="ls-extra-lbl">
              <ha-icon icon="mdi:thermometer" class="lbl-icon"></ha-icon>
              Kleurtemperatuur
            </span>
            <input type="range" class="ls-ct-slider" id="ctSlider">
          </div>
          <div class="ls-extra ls-color-row" id="colorRow" style="display:none;">
            <span class="ls-extra-lbl">
              <ha-icon icon="mdi:palette" class="lbl-icon"></ha-icon>
              Kleur
            </span>
            <input type="color" class="ls-color-picker" id="colorPicker">
          </div>
        </div>
      </ha-card>
      ${this._styles()}
    `;

    // Cache refs
    this._els = {
      mainRow: root.getElementById("mainRow"),
      iconWrap: root.getElementById("iconWrap"),
      icon: root.getElementById("icon"),
      cardName: root.getElementById("cardName"),
      stateText: root.getElementById("stateText"),
      ctRow: root.getElementById("ctRow"),
      ctSlider: root.getElementById("ctSlider"),
      colorRow: root.getElementById("colorRow"),
      colorPicker: root.getElementById("colorPicker"),
    };

    this._attachEvents();
  }

  /* --- Styles --- */

  _styles() {
    return `<style>
      :host { display:block; }
      ha-card {
        background: none;
        border-radius: 28px;
        overflow: hidden;
        backdrop-filter: blur(3px) saturate(120%);
        -webkit-backdrop-filter: blur(3px) saturate(120%);
        box-shadow:
          inset 0 1px 2px rgba(255,255,255,0.35),
          inset 0 2px 4px rgba(0,0,0,0.15),
          0 2px 6px rgba(0,0,0,0.45);
        padding: 0 !important;
      }
      .ls-wrap {
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
      }
      .ls {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 7px 14px;
        box-sizing: border-box;
        width: 100%;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        transition: background 0.4s ease;
        touch-action: none;
      }
      .ls-icon {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        pointer-events: none;
        transition: all 0.3s;
      }
      .ls-icon ha-icon {
        --mdc-icon-size: 20px;
        display: block;
      }
      .ls-info {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex: 1;
        min-width: 0;
        pointer-events: none;
      }
      .ls-name {
        font-size: 14px;
        font-weight: 700;
        color: rgba(255,255,255,0.92);
        font-family: var(--primary-font-family, sans-serif);
      }
      .ls-st {
        font-size: 12.5px;
        font-weight: 500;
        color: rgba(255,255,255,0.45);
        font-family: var(--primary-font-family, sans-serif);
      }
      .ls-pct {
        font-weight: 600;
        color: rgba(255,255,255,0.6);
      }
      .ls-extra {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px;
        box-sizing: border-box;
      }
      .ls-extra-lbl {
        font-size: 9.5px;
        color: rgba(255,255,255,0.35);
        font-family: var(--primary-font-family, sans-serif);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .lbl-icon {
        --mdc-icon-size: 11px;
        color: rgba(255,255,255,0.4);
        vertical-align: middle;
      }
      .ls-extra-ct { padding: 6px 14px 10px; }
      .ls-ct-slider {
        flex: 1;
        height: 8px;
        -webkit-appearance: none;
        appearance: none;
        background: linear-gradient(90deg, #ff9a3c, #fff5e0, #d0eaff);
        border-radius: 3px;
        outline: none;
        cursor: pointer;
        border: none;
        padding: 0;
        margin: 0;
      }
      .ls-ct-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 26px; height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 4px rgba(0,0,0,0.4);
        cursor: pointer;
      }
      .ls-ct-slider::-moz-range-thumb {
        width: 26px; height: 26px;
        border-radius: 50%;
        background: #fff;
        border: none;
        cursor: pointer;
      }
      .ls-color-row { padding-top: 0; padding-bottom: 10px; }
      .ls-color-picker {
        flex: 1;
        height: 22px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        padding: 0;
        background: none;
        outline: none;
        -webkit-appearance: none;
      }
      .ls-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
      .ls-color-picker::-webkit-color-swatch {
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
      }
    </style>`;
  }

  /* --- Event handlers --- */

  _attachEvents() {
    const row = this._els.mainRow;

    // Touch
    row.addEventListener("touchstart", (e) => this._onTouchStart(e), { passive: false });
    row.addEventListener("touchmove", (e) => this._onTouchMove(e), { passive: false });
    row.addEventListener("touchend", (e) => this._onTouchEnd(e));

    // Mouse
    row.addEventListener("mousedown", (e) => this._onMouseDown(e));
    document.addEventListener("mousemove", this._boundMouseMove);
    document.addEventListener("mouseup", this._boundMouseUp);

    // Color temp slider
    this._els.ctSlider.addEventListener("click", (e) => e.stopPropagation());
    this._els.ctSlider.addEventListener("touchstart", (e) => e.stopPropagation());
    this._els.ctSlider.addEventListener("change", (e) => {
      e.stopPropagation();
      this._interactionLock = Date.now() + 2000;
      this._callService("light", "turn_on", {
        entity_id: this._config.entity,
        color_temp_kelvin: parseInt(e.target.value),
        transition: 0,
      });
    });

    // Color picker
    this._els.colorPicker.addEventListener("click", (e) => e.stopPropagation());
    this._els.colorPicker.addEventListener("touchstart", (e) => e.stopPropagation());
    this._els.colorPicker.addEventListener("change", (e) => {
      e.stopPropagation();
      const hex = e.target.value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this._interactionLock = Date.now() + 2000;
      this._callService("light", "turn_on", {
        entity_id: this._config.entity,
        rgb_color: [r, g, b],
        transition: 0,
      });
    });
  }

  /* Touch handlers */
  _onTouchStart(e) {
    this._dragging = true;
    this._moved = false;
    this._startX = e.touches[0].clientX;
    this._currentPct = this._getPct();
  }

  _onTouchMove(e) {
    if (!this._dragging) return;
    e.preventDefault();
    const rect = this._els.mainRow.getBoundingClientRect();
    const pct = this._clampPct(e.touches[0].clientX, rect);
    this._moved = true;
    this._currentPct = pct;
    this._updateSliderVisual(pct);
  }

  _onTouchEnd() {
    if (!this._dragging) return;
    this._dragging = false;
    if (this._moved && this._isDimmable()) {
      this._setBrightness(this._currentPct);
    } else if (!this._moved) {
      this._toggleLight();
    }
  }

  /* Mouse handlers */
  _onMouseDown(e) {
    this._dragging = true;
    this._moved = false;
    this._startX = e.clientX;
    this._currentPct = this._getPct();
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const rect = this._els.mainRow.getBoundingClientRect();
    const pct = this._clampPct(e.clientX, rect);
    this._moved = true;
    this._currentPct = pct;
    if (this._isDimmable()) {
      this._updateSliderVisual(pct);
    }
  }

  _onMouseUp() {
    if (!this._dragging) return;
    this._dragging = false;
    if (this._moved && this._isDimmable()) {
      this._setBrightness(this._currentPct);
    } else if (!this._moved) {
      this._toggleLight();
    }
  }

  /* --- Helpers --- */

  _clampPct(clientX, rect) {
    return Math.min(100, Math.max(1, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }

  _getState() {
    if (!this._hass || !this._config.entity) return null;
    return this._hass.states[this._config.entity];
  }

  _isOn() {
    const s = this._getState();
    return s ? s.state === "on" : false;
  }

  _getModes() {
    const s = this._getState();
    return (s && s.attributes.supported_color_modes) || [];
  }

  _isDimmable() {
    return this._getModes().filter((m) => m !== "onoff").length > 0;
  }

  _hasCT() {
    return this._getModes().includes("color_temp");
  }

  _hasColor() {
    const modes = this._getModes();
    return ["rgb", "hs", "xy", "rgbw", "rgbww"].some((m) => modes.includes(m));
  }

  _getPct() {
    const s = this._getState();
    if (!s || !s.attributes.brightness) return 0;
    return Math.round((s.attributes.brightness / 255) * 100);
  }

  _getRGB() {
    const s = this._getState();
    if (s && s.attributes.rgb_color) return s.attributes.rgb_color;
    return [255, 200, 120];
  }

  _getHexColor() {
    const [r, g, b] = this._getRGB();
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  _updateSliderVisual(pct) {
    const [r, g, b] = this._getRGB();
    this._els.mainRow.style.background = `linear-gradient(90deg, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) ${pct}%, rgba(0,0,0,0) ${pct}%)`;
    const pctSpan = this.shadowRoot.querySelector(".ls-pct");
    if (pctSpan) pctSpan.textContent = pct + "%";
  }

  _callService(domain, service, data) {
    if (this._hass) {
      this._hass.callService(domain, service, data);
    }
  }

  _toggleLight() {
    this._callService("light", "toggle", { entity_id: this._config.entity });
  }

  _setBrightness(pct) {
    this._interactionLock = Date.now() + 2000;
    this._callService("light", "turn_on", {
      entity_id: this._config.entity,
      brightness: Math.round((pct / 100) * 255),
      transition: 0,
    });
  }

  /* --- Update DOM with current state --- */

  _update() {
    if (!this._els || !this._hass || !this._config.entity) return;

    const stateObj = this._getState();
    if (!stateObj) {
      this._els.cardName.textContent = this._config.name || "?";
      this._els.stateText.textContent = "Niet beschikbaar";
      this._els.mainRow.style.background = "transparent";
      this._els.ctRow.style.display = "none";
      this._els.colorRow.style.display = "none";
      return;
    }

    const isOn = this._isOn();
    const isDimmable = this._isDimmable();
    const hasCT = this._hasCT();
    const hasColor = this._hasColor();
    const pct = this._getPct();
    const [r, g, b] = this._getRGB();

    // Name
    const displayName =
      this._config.name ||
      stateObj.attributes.friendly_name ||
      this._config.entity;
    this._els.cardName.textContent = displayName;

    // State text
    let stText = isOn ? "Aan" : "Uit";
    if (isOn && isDimmable) {
      stText += ` \u00b7 <span class="ls-pct">${pct}%</span>`;
    }
    this._els.stateText.innerHTML = stText;

    // Icon color
    this._els.icon.style.color = isOn
      ? "rgba(255,255,255,0.9)"
      : "rgba(255,255,255,0.35)";

    // Skip visual updates during interaction cooldown (prevents jerky transitions)
    const locked = Date.now() < this._interactionLock;

    // Background
    if (!this._dragging && !locked) {
      if (isDimmable && isOn) {
        this._els.mainRow.style.background = `linear-gradient(90deg, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) ${pct}%, rgba(0,0,0,0) ${pct}%)`;
      } else if (isOn) {
        this._els.mainRow.style.background = `rgba(${r},${g},${b},0.25)`;
      } else {
        this._els.mainRow.style.background = "transparent";
      }
    }

    // Color temp row
    if (isOn && hasCT) {
      this._els.ctRow.style.display = "";
      if (!locked) {
        const ctK =
          stateObj.attributes.color_temp_kelvin ||
          4000;
        const minK =
          stateObj.attributes.min_color_temp_kelvin ||
          2000;
        const maxK =
          stateObj.attributes.max_color_temp_kelvin ||
          6500;
        this._els.ctSlider.min = minK;
        this._els.ctSlider.max = maxK;
        this._els.ctSlider.value = ctK;
      }
    } else {
      this._els.ctRow.style.display = "none";
    }

    // Color picker row
    if (isOn && hasColor) {
      this._els.colorRow.style.display = "";
      if (!locked) {
        this._els.colorPicker.value = this._getHexColor();
      }
    } else {
      this._els.colorRow.style.display = "none";
    }
  }

  /* Cleanup */
  disconnectedCallback() {
    document.removeEventListener("mousemove", this._boundMouseMove);
    document.removeEventListener("mouseup", this._boundMouseUp);
  }
}

customElements.define("ultimate-light-card", UltimateLightCard);

/* ============================================================
   REGISTER WITH HA
   ============================================================ */
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ultimate-light-card",
  name: "Ultimate Light Card",
  description:
    "Een veelzijdige lichtkaart met helderheidsslider, kleurtemperatuur en kleurkiezer.",
  preview: true,
  documentationURL: "https://github.com/Sven2410/ultimate-light-card",
});

console.info(
  "%c ULTIMATE-LIGHT-CARD %c v1.0.1 ",
  "color:#fff;background:#7c4dff;font-weight:bold;padding:2px 6px;border-radius:4px 0 0 4px;",
  "color:#7c4dff;background:#f0f0f0;font-weight:bold;padding:2px 6px;border-radius:0 4px 4px 0;"
);
