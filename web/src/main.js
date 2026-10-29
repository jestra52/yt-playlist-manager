import { mount } from 'svelte';
import './styles/tailwind.css'; // Tailwind + daisyUI themes (plain CSS)
import './styles/main.scss'; // our Sass layer
import { applyTheme, savedTheme } from './domains/ui/theme.js';
import App from './App.svelte';

applyTheme(savedTheme());

export default mount(App, { target: document.getElementById('app') });
