/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        ink: '#0F172A',
        steel: '#64748B',
        slate: {
          DEFAULT: '#94A3B8',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
        },
        whisper: '#E2E8F0',
        accent: '#2563EB',
        accentDark: '#1D4ED8',
        accentLight: '#DBEAFE',
        success: '#10B981',
        successBg: '#D1FAE5',
        danger: '#E11D48',
        dangerBg: '#FFE4E6',
        warning: '#F59E0B',
        warningBg: '#FEF3C7',
      },
    },
  },
  plugins: []
}
