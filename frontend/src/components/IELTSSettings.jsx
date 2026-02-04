import { useState } from 'react';

/** IELTS Settings Panel for brightness, text size, and theme customization */
export default function IELTSSettings({ brightness, setBrightness, textSize, setTextSize, theme, setTheme }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="ielts-settings-btn">
      <button 
        className="btn btn-ghost btn-sm" 
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
      >
        ⚙️ Settings
      </button>
      
      {isOpen && (
        <div className="ielts-settings-panel">
          <div className="settings-section">
            <h4>Brightness</h4>
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
            <h4>Text Size</h4>
            <div className="text-size-options">
              <button
                className={`settings-option ${textSize === 'regular' ? 'active' : ''}`}
                onClick={() => setTextSize('regular')}
              >
                Regular
              </button>
              <button
                className={`settings-option ${textSize === 'large' ? 'active' : ''}`}
                onClick={() => setTextSize('large')}
              >
                Large
              </button>
              <button
                className={`settings-option ${textSize === 'extra-large' ? 'active' : ''}`}
                onClick={() => setTextSize('extra-large')}
              >
                Extra Large
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h4>Background Color</h4>
            <div className="theme-options">
              <button
                className={`settings-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                Black on White
              </button>
              <button
                className={`settings-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                White on Black
              </button>
              <button
                className={`settings-option ${theme === 'yellow' ? 'active' : ''}`}
                onClick={() => setTheme('yellow')}
              >
                Yellow on Black
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
