import next from 'eslint-config-next';
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'data-generated/**', '.scratch/**'] },
  ...next,
  ...coreWebVitals,
  ...typescript,
];

export default config;
