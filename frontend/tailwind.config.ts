import type { Config } from 'tailwindcss'

module.exports = {
  theme: {
    extend: {
      animation: {
        fadeIn: 'fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
}
/** @type {import('tailwindcss').Config} */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'madimi': ['Madimi One', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Skribble brand colors
        skribble: {
          'sky': '#C6D8FF',      // Sky Light - Primary text, highlights, active states
          'azure': '#71A9F7',     // Azure - Waveform, primary buttons, links
          'purple': '#6B5CA5',    // Royal Purple - Secondary elements, icons
          'plum': '#72195A',      // Deep Plum - Cards, panels, secondary backgrounds
          'dark': '#4C1036',      // Dark Violet - Main background, navigation
        },
        // Additional semantic colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      backgroundImage: {
        'gradient-skribble': 'linear-gradient(135deg, #4C1036 0%, #72195A 100%)',
        'gradient-skribble-reverse': 'linear-gradient(135deg, #72195A 0%, #4C1036 100%)',
        'gradient-primary': 'linear-gradient(45deg, #71A9F7, #6B5CA5)',
        'gradient-waveform': 'linear-gradient(to right, #6B5CA5 0%, #71A9F7 25%, #C6D8FF 50%, #71A9F7 75%, #6B5CA5 100%)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(113, 169, 247, 0.3)',
        'glow-strong': '0 0 30px rgba(113, 169, 247, 0.5)',
        'bubble': '0 4px 12px rgba(113, 169, 247, 0.4)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.16)',
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
        'xl4': '2rem',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      aspectRatio: {
        'waveform': '16 / 3',
        'video': '16 / 9',
        'square': '1 / 1',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}

export default config