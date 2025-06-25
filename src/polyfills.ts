// Polyfills pour les modules Node.js dans le navigateur
import { Buffer } from 'buffer';
import process from 'process';

// Exposer Buffer comme une variable globale
window.Buffer = Buffer;

// Exposer process comme une variable globale
window.process = process;

// Exposer global comme une variable globale
(window as any).global = window;

// Exposer TextEncoder et TextDecoder si nécessaire pour @solana/web3.js
if (typeof (window as any).TextEncoder === 'undefined') {
  (window as any).TextEncoder = TextEncoder;
}

if (typeof (window as any).TextDecoder === 'undefined') {
  (window as any).TextDecoder = TextDecoder;
}
