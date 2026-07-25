/**
 * Casper Avatar System
 * Provides the friendly ghost SVG avatar for Casper AI Assistant
 */

const CasperAvatar = {
  /**
   * Get Casper ghost SVG with customizable options
   * @param {Object} options - Configuration options
   * @param {number} options.size - Size in pixels (default: 32)
   * @param {string} options.theme - 'light' or 'dark' (default: 'light')
   * @param {string} options.className - Additional CSS class (default: 'casper-avatar')
   * @returns {string} SVG markup
   */
  getSVG(options = {}) {
    const { size = 32, theme = "light", className = "casper-avatar" } = options;

    // Color scheme based on theme
    const colors =
      theme === "dark"
        ? { body: "#58a6ff", eyes: "#1e2124", smile: "#1e2124" }
        : { body: "#0a66c2", eyes: "white", smile: "white" };

    return `
      <svg class="${className}" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4 C10 4 6 8 6 14 V24 L9 22 L12 24 L16 22 L20 24 L23 22 L26 24 V14 C26 8 22 4 16 4 Z" 
              fill="${colors.body}"/>
        <circle cx="13" cy="13" r="2" fill="${colors.eyes}"/>
        <circle cx="19" cy="13" r="2" fill="${colors.eyes}"/>
        <path d="M12 17 Q16 20 20 17" 
              stroke="${colors.smile}" 
              stroke-width="1.8" 
              fill="none" 
              stroke-linecap="round"/>
      </svg>
    `.trim();
  },

  /**
   * Convenience method for small avatar (24px)
   */
  small(theme = "light") {
    return this.getSVG({
      size: 24,
      theme,
      className: "casper-avatar casper-avatar-sm",
    });
  },

  /**
   * Convenience method for medium avatar (32px)
   */
  medium(theme = "light") {
    return this.getSVG({
      size: 32,
      theme,
      className: "casper-avatar casper-avatar-md",
    });
  },

  /**
   * Convenience method for large avatar (48px)
   */
  large(theme = "light") {
    return this.getSVG({
      size: 48,
      theme,
      className: "casper-avatar casper-avatar-lg",
    });
  },

  /**
   * Compact inline icon for ATS / AI headers (matches analyze ghost)
   */
  icon(size = 20, theme = "light") {
    return this.getSVG({
      size,
      theme,
      className: "casper-avatar casper-inline-icon",
    });
  },
};

// Make available globally immediately
window.CasperAvatar = CasperAvatar;
console.log("Casper: Avatar module loaded");
