trestle-rail-kit

npm test

## Rail track distance sampling

`src/curves/RailTrack.js` adds a distance-sampled track on top of the Phaser
curve code. A track is either open (clamps at its ends) or closed (wraps, so a
distance of exactly one full length is back at the start).

```js
var track = new Phaser.Curves.RailTrack({ closed: true, lookAhead: 15 });

track.lineTo(30, 0);
track.quadraticBezierTo(30, 40, 0, 40);
track.lineTo(0, 0);

var car = track.getCarState(125);          // point + heading at 125px
var obs = track.getObservation(125);       // point + heading 15px ahead
```

`Phaser.Curves.Path` also gained the same distance-based helpers
(`isClosed`, `resolveDistance`, `getPointAtDistance`, `getTangentAtDistance`,
`getCarState`, `getObservation`, `getObservationPoint`, `getObservationTangent`),
so an existing `Path` can be sampled by distance without being rebuilt.

Open `preview/rail-track.html` directly in a browser to see the closed track,
the open short track, the car and the observation point. The page loads the
real `src/` modules, no build step needed.

Tests: `tests/curves/RailTrack.test.js`.
