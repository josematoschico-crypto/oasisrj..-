export {};

declare global {
  interface Window {
    appMounted?: boolean;
    hideSplash?: () => void;
  }
}
