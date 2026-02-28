/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#0f49bd",
                "background-light": "#f6f6f8",
                "background-dark": "#101622",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                inter: ['Inter', 'sans-serif'],
                display: ["Inter", "sans-serif"],
            },
        },
    },
    plugins: [
        require('@tailwindcss/container-queries'),
    ],
}
