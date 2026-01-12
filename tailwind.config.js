/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                brand: {
                    bg: '#020617',      // Slate 950 - Deep Background
                    panel: '#0f172a',   // Slate 900 - High Contrast Cards
                    surface: '#1e293b', // Slate 800 - Secondary Elements
                    primary: '#8b5cf6', // Violet 500 - Main Action
                    success: '#10b981', // Emerald 500 - Success/Internal
                    danger: '#f43f5e',  // Rose 500 - Danger/External
                    highlight: '#ffffff', // Pure White
                }
            },
            animation: {
                'blob': 'blob 7s infinite',
                'marquee': 'marquee 30s linear infinite',
                'spotlight': 'spotlight 2s ease .75s 1 forwards',
                'shimmer': 'shimmer 2s linear infinite',
                'meteor': 'meteor 5s linear infinite',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                spotlight: {
                    '0%': { opacity: 0, transform: 'translate(-72%, -62%) scale(0.5)' },
                    '100%': { opacity: 1, transform: 'translate(-50%,-40%) scale(1)' },
                },
                shimmer: {
                    from: { backgroundPosition: '0 0' },
                    to: { backgroundPosition: '-200% 0' },
                },
                meteor: {
                    '0%': { transform: 'rotate(215deg) translateX(0)', opacity: 1 },
                    '70%': { opacity: 1 },
                    '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: 0 },
                },
            },
        },
    },
    plugins: [],
}
