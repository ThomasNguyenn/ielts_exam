import { useState } from 'react';

/** IELTS Settings Panel for brightness, text size, and theme customization */
export default function IELTSSettings({ brightness, setBrightness, textSize, setTextSize, theme, setTheme }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="ielts-settings-wrapper">
      <button
        className="btn-settings-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
      >
        <span>⚙️</span> Settings
      </button>

      {isOpen && <div className="settings-overlay" onClick={() => setIsOpen(false)} />}

      <div className={`ielts-settings-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <label>Brightness</label>
            <div className="brightness-control">
              <input
                type="range"
                className="brightness-slider"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
              />
              <span className="brightness-value">{brightness}%</span>
            </div>
          </div>

          <div className="settings-section">
            <label>Text Size</label>
            <div className="text-size-options">
              <button
                className={`settings-option-btn ${textSize === 'regular' ? 'active' : ''}`}
                onClick={() => setTextSize('regular')}
              >
                Regular
              </button>
              <button
                className={`settings-option-btn ${textSize === 'large' ? 'active' : ''}`}
                onClick={() => setTextSize('large')}
              >
                Large
              </button>
              <button
                className={`settings-option-btn ${textSize === 'extra-large' ? 'active' : ''}`}
                onClick={() => setTextSize('extra-large')}
              >
                Extra Large
              </button>
            </div>
          </div>

          <div className="settings-section">
            <label>Background Color</label>
            <div className="theme-options">
              <button
                className={`settings-option-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                Black on White
              </button>
              <button
                className={`settings-option-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                White on Black
              </button>
              <button
                className={`settings-option-btn ${theme === 'yellow' ? 'active' : ''}`}
                onClick={() => setTheme('yellow')}
              >
                Yellow on Black
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
