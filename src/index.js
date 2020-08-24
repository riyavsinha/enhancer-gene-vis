import register from 'higlass-register';
import React from 'react';
import ReactDOM from 'react-dom';

import App from './App';
import * as serviceWorker from './serviceWorker';

import createAnnotationOverlayMetaTrack from './annotation-overlay-meta-track';
import createRidgePlotTrack from './ridge-plot-track';
import createStratifiedBedTrack from './stratified-bed-track';
import createScalableArcs1dTrack from './scalable-arcs-track';
import createSnpTrack from './snp-track';
import createStackedBarTrack from './stacked-bar-track';
import createTssTrack from './tss-track';

import './index.css';

register({
  track: createRidgePlotTrack,
  config: createRidgePlotTrack.config,
});

register({
  track: createScalableArcs1dTrack,
  config: createScalableArcs1dTrack.config,
});

register({
  track: createStratifiedBedTrack,
  config: createStratifiedBedTrack.config,
});

register({
  track: createSnpTrack,
  config: createSnpTrack.config,
});

register({
  track: createStackedBarTrack,
  config: createStackedBarTrack.config,
});

register({
  track: createTssTrack,
  config: createTssTrack.config,
});

register({
  track: createAnnotationOverlayMetaTrack,
  config: createAnnotationOverlayMetaTrack.config,
  isMetaTrack: true,
});

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
