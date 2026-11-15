var Path = require('../../src/curves/path/Path');
var RailTrack = require('../../src/curves/RailTrack');
var Vector2 = require('../../src/math/Vector2');

//  The looped track from the spec:
//
//  line (0,0) -> (30,0), quadratic (30,0) control (0,40) -> (30,40), line -> (0,0)
//
//  Length 134.439658.
function createLoopPath ()
{
    var path = new Path(0, 0);

    path.lineTo(30, 0);
    path.quadraticBezierTo(30, 40, 0, 40);
    path.lineTo(0, 0);

    return path;
}

function createLoopTrack ()
{
    var track = new RailTrack({ closed: true });

    track.lineTo(30, 0);
    track.quadraticBezierTo(30, 40, 0, 40);
    track.lineTo(0, 0);

    return track;
}

//  The short, open track from the spec: line (0,0) -> (30,0), length 30.
function createOpenPath ()
{
    var path = new Path(0, 0);

    path.lineTo(30, 0);

    return path;
}

function createOpenTrack ()
{
    var track = new RailTrack({ closed: false });

    track.lineTo(30, 0);

    return track;
}

//  All sampled values in the spec match to within 0.002.
var TOLERANCE = 0.002;

function expectPoint (actual, expectedX, expectedY)
{
    expect(Math.abs(actual.x - expectedX)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(actual.y - expectedY)).toBeLessThanOrEqual(TOLERANCE);
}

describe('Rail track distance sampling', function ()
{
    describe('loop length', function ()
    {
        it('should measure 134.439658 for the closed track', function ()
        {
            expect(createLoopPath().getLength()).toBeCloseTo(134.439658, 6);
            expect(createLoopTrack().getLength()).toBeCloseTo(134.439658, 6);
        });

        it('should detect that the loop is closed and the short track is not', function ()
        {
            expect(createLoopPath().isClosed()).toBe(true);
            expect(createOpenPath().isClosed()).toBe(false);
        });
    });

    describe('car sampled by traveled distance on the closed track', function ()
    {
        var cases = [
            //  distance, x, y, heading x, heading y
            [ 0, 0, 0, 1, 0 ],
            [ 20, 20, 0, 1, 0 ],
            [ 30, 30, 0, 1, 0 ],
            [ 40, 24.226, 8.164, -0.550, 0.835 ],
            [ 100, 20.664, 27.552, -0.600, -0.800 ],
            [ 125, 5.664, 7.552, -0.600, -0.800 ],
            [ 130, 2.664, 3.552, -0.600, -0.800 ]
        ];

        cases.forEach(function (item)
        {
            it('should place the car at ' + item[1] + ',' + item[2] + ' after ' + item[0] + ' pixels', function ()
            {
                var pathState = createLoopPath().getCarState(item[0]);
                var trackState = createLoopTrack().getCarState(item[0]);

                expectPoint(pathState.point, item[1], item[2]);
                expectPoint(pathState.tangent, item[3], item[4]);

                expectPoint(trackState.point, item[1], item[2]);
                expectPoint(trackState.tangent, item[3], item[4]);
            });
        });

        it('should return the car to the entrance when the distance is exactly one lap', function ()
        {
            var path = createLoopPath();
            var length = path.getLength();

            var state = path.getCarState(length);

            expectPoint(state.point, 0, 0);
            expectPoint(state.tangent, 1, 0);

            var trackState = createLoopTrack().getCarState(length);

            expectPoint(trackState.point, 0, 0);
            expectPoint(trackState.tangent, 1, 0);
        });

        it('should keep going from the entrance when the distance passes one lap', function ()
        {
            var path = createLoopPath();
            var distance = path.getLength() + 15;

            var state = path.getCarState(distance);

            expectPoint(state.point, 15, 0);
            expectPoint(state.tangent, 1, 0);

            var trackState = createLoopTrack().getCarState(distance);

            expectPoint(trackState.point, 15, 0);
            expectPoint(trackState.tangent, 1, 0);
        });

        it('should resolve the traveled distance back into the lap', function ()
        {
            var path = createLoopPath();

            expect(path.resolveDistance(path.getLength())).toBe(0);
            expect(path.resolveDistance(path.getLength() + 15)).toBeCloseTo(15, 10);
            expect(path.resolveDistance(-5)).toBeCloseTo(path.getLength() - 5, 10);
        });
    });

    describe('observation point on the closed track', function ()
    {
        it('should sit 15 pixels ahead of the car at distance 20', function ()
        {
            var pathState = createLoopPath().getObservation(20, 15);
            var trackState = createLoopTrack().getObservation(20, 15);

            expectPoint(pathState.point, 27.051, 4.039);
            expectPoint(pathState.tangent, -0.578, 0.816);

            expectPoint(trackState.point, 27.051, 4.039);
            expectPoint(trackState.tangent, -0.578, 0.816);
        });

        it('should wrap past the finish line and land back on the entrance straight at distance 125', function ()
        {
            //  The car is still on the return straight (5.664, 7.552),
            //  while the observation point has already reappeared on the first segment.
            var car = createLoopPath().getPointAtDistance(125);

            expectPoint(car, 5.664, 7.552);

            var pathState = createLoopPath().getObservation(125, 15);
            var trackState = createLoopTrack().getObservation(125, 15);

            expectPoint(pathState.point, 5.560, 0);
            expectPoint(pathState.tangent, 1, 0);

            expectPoint(trackState.point, 5.560, 0);
            expectPoint(trackState.tangent, 1, 0);
        });

        it('should return the observation point on its own when asked', function ()
        {
            var track = createLoopTrack();

            expectPoint(track.getObservationPoint(20, 15), 27.051, 4.039);
            expectPoint(track.getObservationTangent(125, 15), 1, 0);
        });

        it('should use the track lookAhead value when no lead distance is given', function ()
        {
            var track = new RailTrack({ closed: true, lookAhead: 15 });

            track.lineTo(30, 0);
            track.quadraticBezierTo(30, 40, 0, 40);
            track.lineTo(0, 0);

            expectPoint(track.getObservation(20).point, 27.051, 4.039);
        });
    });

    describe('sampling by normalized position', function ()
    {
        it('should still return 15.457,33.185 at position 0.5', function ()
        {
            var path = createLoopPath();
            var track = createLoopTrack();

            expectPoint(path.getPoint(0.5), 15.457, 33.185);
            expectPoint(path.getTangent(0.5), 0.302, 0.953);

            expectPoint(track.getPoint(0.5), 15.457, 33.185);
            expectPoint(track.getTangent(0.5), 0.302, 0.953);
        });

        it('should still end at 0,0 facing -0.600,-0.800 at position 1', function ()
        {
            var path = createLoopPath();
            var track = createLoopTrack();

            expectPoint(path.getPoint(1), 0, 0);
            expectPoint(path.getTangent(1), -0.600, -0.800);

            expectPoint(track.getPoint(1), 0, 0);
            expectPoint(track.getTangent(1), -0.600, -0.800);
        });

        it('should be a different reading from the distance that completes a lap', function ()
        {
            var track = createLoopTrack();

            var normalizedEnd = track.getTangent(1);
            var lapEnd = track.getTangentAtDistance(track.getLength());

            expectPoint(normalizedEnd, -0.600, -0.800);
            expectPoint(lapEnd, 1, 0);

            expect(normalizedEnd.x).not.toBeCloseTo(lapEnd.x, 3);
        });
    });

    describe('car and observation point on the open short track', function ()
    {
        it('should place the car at 10,0 with the observation point 15 ahead at 25,0', function ()
        {
            var pathState = createOpenPath().getCarState(10);
            var trackState = createOpenTrack().getCarState(10);

            expectPoint(pathState.point, 10, 0);
            expectPoint(pathState.tangent, 1, 0);
            expectPoint(trackState.point, 10, 0);
            expectPoint(trackState.tangent, 1, 0);

            var pathObservation = createOpenPath().getObservation(10, 15);
            var trackObservation = createOpenTrack().getObservation(10, 15);

            expectPoint(pathObservation.point, 25, 0);
            expectPoint(pathObservation.tangent, 1, 0);
            expectPoint(trackObservation.point, 25, 0);
            expectPoint(trackObservation.tangent, 1, 0);
        });

        it('should stop the observation point at the end when the car is at 20', function ()
        {
            var pathObservation = createOpenPath().getObservation(20, 15);
            var trackObservation = createOpenTrack().getObservation(20, 15);

            expectPoint(pathObservation.point, 30, 0);
            expectPoint(pathObservation.tangent, 1, 0);

            expectPoint(trackObservation.point, 30, 0);
            expectPoint(trackObservation.tangent, 1, 0);

            expectPoint(createOpenTrack().getCarState(20).point, 20, 0);
        });

        it('should park both points on 30,0 when the distance is 40', function ()
        {
            var pathState = createOpenPath().getCarState(40);
            var pathObservation = createOpenPath().getObservation(40, 15);

            expectPoint(pathState.point, 30, 0);
            expectPoint(pathState.tangent, 1, 0);
            expectPoint(pathObservation.point, 30, 0);
            expectPoint(pathObservation.tangent, 1, 0);

            var trackState = createOpenTrack().getCarState(40);
            var trackObservation = createOpenTrack().getObservation(40, 15);

            expectPoint(trackState.point, 30, 0);
            expectPoint(trackState.tangent, 1, 0);
            expectPoint(trackObservation.point, 30, 0);
            expectPoint(trackObservation.tangent, 1, 0);
        });

        it('should never wrap the car back to the entrance', function ()
        {
            var path = createOpenPath();

            expect(path.resolveDistance(40)).toBe(30);
            expect(path.resolveDistance(0)).toBe(0);
            expect(path.resolveDistance(-10)).toBe(0);

            var track = createOpenTrack();

            expect(track.resolveDistance(40)).toBe(30);
            expect(track.resolveDistance(-10)).toBe(0);
        });

        it('should clamp the observation point even when it is far ahead', function ()
        {
            var track = createOpenTrack();

            expectPoint(track.getObservationPoint(20, 100), 30, 0);
            expectPoint(track.getObservationPoint(0, 100), 30, 0);
        });
    });

    describe('explicit wrap overrides', function ()
    {
        it('should allow a closed-looking Path to clamp when wrap is false', function ()
        {
            var path = createLoopPath();
            var distance = path.getLength() + 15;

            expectPoint(path.getPointAtDistance(distance, false), 0, 0);
            expectPoint(path.getTangentAtDistance(distance, false), -0.600, -0.800);

            expectPoint(path.getPointAtDistance(distance, true), 15, 0);
            expectPoint(path.getTangentAtDistance(distance, true), 1, 0);
        });

        it('should accept an out vector as the second argument', function ()
        {
            var path = createLoopPath();
            var out = new Vector2();

            var result = path.getPointAtDistance(20, out);

            expect(result).toBe(out);
            expectPoint(result, 20, 0);
        });
    });

    describe('RailTrack geometry', function ()
    {
        it('should expose the start and end points', function ()
        {
            var track = createLoopTrack();

            expectPoint(track.getStartPoint(), 0, 0);
            expectPoint(track.getEndPoint(), 0, 0);
        });

        it('should expose cumulative segment lengths', function ()
        {
            var track = createLoopTrack();

            var lengths = track.getCurveLengths();

            expect(lengths.length).toBe(4);
            expect(lengths[0]).toBe(0);
            expect(lengths[1]).toBeCloseTo(30, 10);
            expect(lengths[2]).toBeCloseTo(84.439658, 6);
            expect(lengths[3]).toBeCloseTo(134.439658, 6);
        });

        it('should return null for normalized positions outside 0..1', function ()
        {
            var track = createLoopTrack();

            expect(track.getPoint(-0.1)).toBeNull();
            expect(track.getPoint(1.1)).toBeNull();
            expect(track.getTangent(-0.1)).toBeNull();
            expect(track.getTangent(1.1)).toBeNull();
        });

        it('should return evenly spaced points across the track', function ()
        {
            var track = createLoopTrack();
            var points = track.getPoints(4);

            expect(points.length).toBe(5);
            expectPoint(points[0], 0, 0);
            expectPoint(points[4], 0, 0);
        });

        it('should round-trip through JSON', function ()
        {
            var track = createLoopTrack();

            var json = track.toJSON();

            expect(json.type).toBe('RailTrack');
            expect(json.closed).toBe(true);
            expect(json.segments.length).toBe(3);
            expect(json.segments[0].type).toBe('line');
            expect(json.segments[1].type).toBe('quadratic');
            expect(json.segments[2].type).toBe('line');
        });

        it('should support the very first segment being a straight line', function ()
        {
            var track = new RailTrack({ closed: false });

            track.lineTo(0, 10);

            expect(track.getLength()).toBeCloseTo(10, 10);
            expectPoint(track.getPointAtDistance(5), 0, 5);
            expectPoint(track.getTangentAtDistance(5), 0, 1);
        });
    });
});
