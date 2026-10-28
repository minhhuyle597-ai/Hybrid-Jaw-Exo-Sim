import {defineConfig} from 'vite';
// Relative assets work both at localhost / and the GitHub Pages repository path.
// https://vite.dev/guide/build.html#relative-base
export default defineConfig({base:'./',build:{emptyOutDir:false}});
