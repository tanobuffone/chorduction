import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'build/chorduction.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: false,
  sourcemap: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    '__VERSION__': JSON.stringify(pkg.version),
  },
  banner: {
    js: [
      `// Chorduction v${pkg.version}`,
      `// Real-time chord detection for Spotify — https://github.com/user/chorduction`,
      `// MIT License`,
      ``,
    ].join('\n'),
  },
  logLevel: 'info',
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length) {
    console.error('Build failed:', result.errors);
    process.exit(1);
  }
  console.log(`Build complete: build/chorduction.js`);
}
