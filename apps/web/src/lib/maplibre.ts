/**
 * MapLibre for the web's maps: import its classes from here, not from "maplibre-gl", so they get a
 * working Web Worker.
 *
 * MapLibre 6 finds its worker (which downloads and decodes the vector tiles: roads, buildings, water,
 * labels) next to its own file, from `import.meta.url`. Bundled by Next.js, that is a `file://`
 * placeholder, so MapLibre gives up on it and starts a worker from an empty URL, which fails: only the
 * zoomed-out shaded-relief imagery draws (it is decoded on the main thread), and every street-level
 * view is blank. Naming the worker file here lets the bundler emit it and hand us its real URL.
 */
import { setWorkerUrl } from "maplibre-gl";

setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

export { Map, Marker, NavigationControl, Popup } from "maplibre-gl";
